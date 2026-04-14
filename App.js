import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import './src/i18n'; 
import HomeScreen from './src/screens/HomeScreen';
import TasksScreen from './src/screens/TasksScreen';
import FlowScreen from './src/screens/FlowScreen';
import RegionManagementScreen from './src/screens/RegionManagementScreen';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('Weather');

  const navigate = (screenName) => {
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
