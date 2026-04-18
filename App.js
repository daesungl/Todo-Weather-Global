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
  const [navState, setNavState] = useState({ screen: 'Weather', params: {} });
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const navigate = (screenName, params = {}) => {
    opacity.setValue(0);
    setNavState({ screen: screenName, params });
  };

  useEffect(() => {
    const isForward = navState.screen === 'WeatherDetail';
    
    opacity.setValue(0);
    if (isForward) {
      translateY.setValue(120);
    } else {
      translateY.setValue(-20);
    }

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
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
          {
            opacity,
            transform: [{ translateY }],
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
    backgroundColor: '#f7f9ff', // 전환 시 검은색 배경이 보이지 않도록 기본 배경색 고정
  },
});
