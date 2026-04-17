import React, { useState } from 'react';
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

  const navigate = (screenName, params = {}) => {
    setScreenParams(params);
    setCurrentScreen(screenName);
  };

  const renderScreen = () => {
    switch(currentScreen) {
      case 'Weather':
        return <HomeScreen navigation={{ navigate }} />;
      case 'Tasks':
        return <TasksScreen navigation={{ navigate }} />;
      case 'Flow':
        return <FlowScreen navigation={{ navigate, goBack: () => navigate('Weather') }} />;
      case 'RegionManagement':
        return <RegionManagementScreen navigation={{ navigate, goBack: () => navigate('Weather') }} />;
      case 'WeatherDetail':
        return <WeatherDetailScreen navigation={{ navigate, goBack: () => navigate('Weather') }} route={{ params: screenParams }} />;
      default:
        return <HomeScreen navigation={{ navigate }} />;
    }
  };

  return (
    <>
      <StatusBar style="dark" />
      {renderScreen()}
    </>
  );
}
