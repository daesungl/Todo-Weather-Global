import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { Easing, StyleSheet, AppState } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import './src/i18n';
import { UnitProvider } from './src/contexts/UnitContext';
import { SubscriptionProvider } from './src/contexts/SubscriptionContext';
import { useSubscription } from './src/contexts/SubscriptionContext';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import AdManager from './src/services/ad/AdManager';

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

export default function App() {
  const routeNameRef = React.useRef();
  const navigationRef = React.useRef();

  useEffect(() => {
    // 앱이 로드된 후 최소 1.5초간 스플래시 유지
    const prepare = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (e) {
        console.warn(e);
      } finally {
        await SplashScreen.hideAsync();
      }
    };

    prepare();
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SubscriptionProvider>
        <UnitProvider>
          <SafeAreaProvider>
            <AppOpenAdHandler />
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
                    firebase_screen: currentRouteName,
                    firebase_screen_class: currentRouteName,
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
                {/* 탭 화면 그룹 */}
                <Stack.Screen name="MainTabs" component={TabNavigator} options={{ gestureEnabled: false }} />

                {/* 상세 화면: 탭바 위에 오른쪽에서 슬라이드 인 */}
                <Stack.Screen name="WeatherDetail" component={WeatherDetailScreen} options={{ gestureEnabled: false }} />
                <Stack.Screen name="RegionManagement" component={RegionManagementScreen} />
                <Stack.Screen name="Paywall" component={PaywallScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          </SafeAreaProvider>
        </UnitProvider>
      </SubscriptionProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#f7f9ff',
  },
});
