import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import './src/i18n'; 
import HomeScreen from './src/screens/HomeScreen';
import TasksScreen from './src/screens/TasksScreen';
import FlowScreen from './src/screens/FlowScreen';
import RegionManagementScreen from './src/screens/RegionManagementScreen';
import WeatherDetailScreen from './src/screens/WeatherDetailScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Weather');
  const [screenParams, setScreenParams] = useState({});
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const navigate = (screenName, params = {}) => {
    // 1. 데이터 업데이트
    setScreenParams(params);

    // 2. 극한의 리듬감을 위해 5ms의 '초미세 숨표' 부여
    Animated.timing(opacity, {
      toValue: 0,
      duration: 5, 
      useNativeDriver: true,
    }).start(() => {
      // 3. 눈 깜빡할 새도 없이 화면 전환
      setCurrentScreen(screenName);
    });
  };

  // 3. 새 화면 진입 애니메이션 (즉시 실행 버전)
  useEffect(() => {
    const isForward = currentScreen === 'WeatherDetail';
    
    // [중요] 애니메이션 시작 전 값을 즉시 초기화하여 번쩍임을 방지
    opacity.setValue(0);
    if (isForward) {
      translateY.setValue(120); // 조금 더 깊은 곳에서 등장 (80 -> 120)
    } else {
      translateY.setValue(-20);
    }

    // 초기화 직후 즉시 애니메이션 시작
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300, // 페이드 인 성분도 조금 더 부드럽게
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 450, // 350 -> 450으로 늘려 묵직하고 우아한 느낌 복원
        easing: Easing.out(Easing.cubic), // 부드러운 감속 효과 추가
        useNativeDriver: true,
      }),
    ]).start();
  }, [currentScreen]); // currentScreen이 바뀌고 렌더링이 완료된 후 실행됨

  const renderScreen = () => {
    switch(currentScreen) {
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
            route={{ params: screenParams }} 
            key={`detail-${screenParams?.weatherData?.locationName || 'new'}`}
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
          {
            opacity,
            transform: [{ translateY }],
            backgroundColor: '#f7f9ff', // 전체 배경색을 설정하여 "완전 흰색" 방지
          },
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
  },
});
