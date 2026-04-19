import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import './src/i18n';
import HomeScreen from './src/screens/HomeScreen';
import TasksScreen from './src/screens/TasksScreen';
import FlowScreen from './src/screens/FlowScreen';
import RegionManagementScreen from './src/screens/RegionManagementScreen';
import WeatherDetailScreen from './src/screens/WeatherDetailScreen';

const { width } = Dimensions.get('window');
const TAB_ORDER = { Weather: 0, Tasks: 1, Flow: 2 };
const DETAIL_SCREENS = ['WeatherDetail', 'RegionManagement'];

export default function App() {
  const [navState, setNavState] = useState({ screen: 'Weather', from: 'Weather', params: {} });
  const currentScreenRef = useRef('Weather');
  const lastTabRef = useRef('Weather'); // 마지막으로 활성화된 탭 화면을 별도 기억
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const navigate = (screenName, params = {}) => {
    const from = currentScreenRef.current;
    // 탭 화면으로 이동 시에만 lastTabRef 갱신
    if (TAB_ORDER[screenName] !== undefined) {
      lastTabRef.current = screenName;
    }
    currentScreenRef.current = screenName;
    setNavState({ screen: screenName, from, params });
  };

  useEffect(() => {
    const current = navState.screen;
    const prev = navState.from;

    opacity.setValue(0);
    translateX.setValue(0);
    translateY.setValue(0);

    if (DETAIL_SCREENS.includes(current)) {
      // 상세 진입: 아래→위
      translateY.setValue(120);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 450, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else if (DETAIL_SCREENS.includes(prev)) {
      // 상세 복귀: 위→아래 (fade만 사용, 슬라이드 없음)
      translateY.setValue(-30);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 350, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    } else {
      // 탭 전환: 1(Weather)→2(Tasks)→3(Flow) 오른쪽 이동이면 새 화면이 오른쪽에서 진입
      // prev가 탭 화면이 아닐 경우 lastTabRef를 폴백으로 사용
      const fromTabKey = TAB_ORDER[prev] !== undefined ? prev : lastTabRef.current;
      const fromIndex = TAB_ORDER[fromTabKey] ?? 0;
      const toIndex = TAB_ORDER[current] ?? 0;
      
      if (fromIndex === toIndex) {
        // 같은 탭이면 그냥 페이드만
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        return;
      }

      // fromIndex < toIndex : 오른쪽 탭 → 새 화면이 오른쪽(+)에서 진입
      // fromIndex > toIndex : 왼쪽 탭 → 새 화면이 왼쪽(-)에서 진입
      const direction = toIndex > fromIndex ? 1 : -1;
      translateX.setValue(direction * width * 0.4);
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    }
  }, [navState.screen]);

  const renderScreen = () => {
    const { screen, params } = navState;
    switch(screen) {
      case 'Weather':
        return <HomeScreen navigation={{ navigate }} key="home" />;
      case 'Tasks':
        return <TasksScreen navigation={{ navigate }} key="tasks" />;
      case 'Flow':
        return <FlowScreen navigation={{ navigate, goBack: () => navigate('Weather') }} key="flow" />;
      case 'RegionManagement':
        return <RegionManagementScreen navigation={{ navigate, goBack: () => navigate('Weather') }} key="region" />;
      case 'WeatherDetail':
        return (
          <WeatherDetailScreen
            navigation={{ navigate, goBack: () => navigate('Weather') }}
            route={{ params }}
            key={`detail-${params?.regionId || params?.weatherData?.lat || 'new'}`}
          />
        );
      default:
        return <HomeScreen navigation={{ navigate }} key="default" />;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Animated.View
        style={[
          styles.container,
          { opacity, transform: [{ translateX }, { translateY }] },
        ]}
      >
        {renderScreen()}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f9ff', // 전환 시 검은색 배경이 보이지 않도록 기본 배경색 고정
  },
});
