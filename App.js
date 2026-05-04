import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Easing, StyleSheet, AppState, Animated, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import './src/i18n';
import { UnitProvider } from './src/contexts/UnitContext';
import { SubscriptionProvider } from './src/contexts/SubscriptionContext';
import { useSubscription } from './src/contexts/SubscriptionContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import AdManager from './src/services/ad/AdManager';
import { refillTaskNotifications, refillStepNotifications, setupAndroidChannel, cancelPastNotifications } from './src/services/NotificationService';
import { getTasks, updateTask } from './src/services/task/TaskSyncService';
import { getFlows, saveFlows } from './src/services/FlowSyncService';
import { incrementLaunchCount } from './src/services/ReviewService';

// 스플래시 화면 자동 숨김 방지
SplashScreen.preventAutoHideAsync().catch(() => {
  /* ignore error */
});

// AdMob 초기화 (AdManager 사용)
AdManager.initialize();

import HomeScreen from './src/screens/HomeScreen';
import TasksScreen from './src/screens/TasksScreen';
import FlowScreen from './src/screens/FlowScreen';
import RegionManagementScreen from './src/screens/RegionManagementScreen';
import WeatherDetailScreen from './src/screens/WeatherDetailScreen';
import PaywallScreen from './src/screens/PaywallScreen';
import CustomTabBar from './src/components/CustomTabBar';
import { useAuth } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import ProfileScreen from './src/screens/ProfileScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// 오른쪽에서 슬라이드 인, 기존 화면 제자리 유지
const slideFromRight = {
  cardStyleInterpolator: ({ current, layouts }) => ({
    cardStyle: {
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [0, 1],
            outputRange: [layouts.screen.width, 0],
            extrapolate: 'clamp',
          }),
        },
      ],
    },
  }),
  transitionSpec: {
    open: { animation: 'timing', config: { duration: 300, easing: Easing.out(Easing.cubic) } },
    close: { animation: 'timing', config: { duration: 280, easing: Easing.out(Easing.cubic) } },
  },
};

// 탭 네비게이터: 하단 글래스 탭바로 Weather/Tasks/Flow 관리
function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Weather" component={HomeScreen} />
      <Tab.Screen name="Tasks" component={TasksScreen} />
      <Tab.Screen name="Flow" component={FlowScreen} />
    </Tab.Navigator>
  );
}

function AppOpenAdHandler() {
  const { isPremium } = useSubscription();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active' && !isPremium) {
        AdManager.showAppOpenAd();
      }
    });
    return () => subscription.remove();
  }, [isPremium]);

  return null;
}

function NotificationRefillHandler() {
  const appStateRef = React.useRef(AppState.currentState);

  useEffect(() => {
    const runRefill = async () => {
      try {
        const tasks = await getTasks();
        await refillTaskNotifications(tasks, async (id, patch) => {
          await updateTask(id, patch);
        });

        const flows = await getFlows();
        await refillStepNotifications(flows, async (flowId, stepId, patch) => {
          const updatedFlows = flows.map(f => {
            if (f.id !== flowId) return f;
            return { ...f, steps: f.steps.map(s => s.id === stepId ? { ...s, ...patch } : s) };
          });
          await saveFlows(updatedFlows);
        });
      } catch (e) {
        console.warn('[NotificationRefill]', e);
      }
    };

    // 앱 시작 시 1회 실행: 과거 알림 정리 후 refill
    setupAndroidChannel();
    cancelPastNotifications().then(runRefill);

    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        runRefill();
      }
      appStateRef.current = nextAppState;
    });
    return () => subscription.remove();
  }, []);

  return null;
}

function AppContent({ navigationRef, routeNameRef, slideFromRight }) {
  const { user, isGuest, loading } = useAuth();
  
  if (loading) return null;

  return (
    <SubscriptionProvider>
      <UnitProvider>
        <SafeAreaProvider>
          <AppOpenAdHandler />
          <NotificationRefillHandler />
          <StatusBar style="dark" />
          <NavigationContainer
            ref={navigationRef}
            onReady={() => {
              routeNameRef.current = navigationRef.current.getCurrentRoute()?.name;
            }}
            onStateChange={async () => {
              const previousRouteName = routeNameRef.current;
              const currentRouteName = navigationRef.current.getCurrentRoute()?.name;

              if (previousRouteName !== currentRouteName) {
                await logEvent(getAnalytics(), 'screen_view', {
                  screen_name: currentRouteName,
                  screen_class: currentRouteName,
                });
              }
              routeNameRef.current = currentRouteName;
            }}
          >
            <Stack.Navigator
              screenOptions={{
                headerShown: false,
                gestureEnabled: true,
                gestureDirection: 'horizontal',
                ...slideFromRight,
              }}
            >
              <Stack.Screen name="MainTabs" component={TabNavigator} options={{ gestureEnabled: false }} />
              <Stack.Screen name="WeatherDetail" component={WeatherDetailScreen} options={{ gestureEnabled: false }} />
              <Stack.Screen name="RegionManagement" component={RegionManagementScreen} />
              <Stack.Screen name="Paywall" component={PaywallScreen} />
              <Stack.Screen name="Profile" component={ProfileScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </SafeAreaProvider>
      </UnitProvider>
    </SubscriptionProvider>
  );
}

export default function App() {
  const routeNameRef = React.useRef();
  const navigationRef = React.useRef();
  const [appIsReady, setAppIsReady] = React.useState(false);
  const splashOpacity = React.useRef(new Animated.Value(1)).current;
  // 안드로이드는 fake splash 없이 native splash만 사용
  const [showSplash, setShowSplash] = React.useState(Platform.OS === 'ios');
  const hideSplashTriggeredRef = React.useRef(false);

  useEffect(() => {
    const prepare = async () => {
      try {
        incrementLaunchCount();
        if (Platform.OS === 'ios') {
          const { status } = await requestTrackingPermissionsAsync();
          if (status === 'granted') {
            AdManager.initialize();
          }
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    };
    prepare();
  }, []);

  useEffect(() => {
    if (!appIsReady || hideSplashTriggeredRef.current) return;
    hideSplashTriggeredRef.current = true;

    if (Platform.OS === 'android') {
      // 안드로이드: fake splash 없이 native splash만 즉시 숨김
      SplashScreen.hideAsync().catch(() => {});
    } else {
      // iOS: fake splash 페이드아웃 후 숨김
      SplashScreen.hideAsync().catch(() => {});
      Animated.timing(splashOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }).start(() => setShowSplash(false));
    }
  }, [appIsReady]);

  return (
    <GestureHandlerRootView 
      style={styles.root}
    >
      <AuthProvider>
        <AppContent 
          navigationRef={navigationRef}
          routeNameRef={routeNameRef}
          slideFromRight={slideFromRight}
        />
      </AuthProvider>

      {/* 가짜 스플래시 레이어 (페이드아웃용) - 최상위 레벨로 이동 */}
      {showSplash && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: '#b2ebf2',
              opacity: splashOpacity,
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 9999,
            },
          ]}
        >
          <Animated.Image
            source={require('./assets/splash-icon-v3.png')}
            style={{
              width: '100%',
              height: '100%',
              resizeMode: 'contain',
            }}
          />
        </Animated.View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f7f9ff',
  },
});

