import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SubscriptionContext = createContext();

const PREMIUM_STORAGE_KEY = '@is_premium_user';

export const SubscriptionProvider = ({ children }) => {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  // 앱 시작 시 구독 상태 불러오기
  useEffect(() => {
    loadSubscriptionStatus();
  }, []);

  const loadSubscriptionStatus = async () => {
    try {
      const value = await AsyncStorage.getItem(PREMIUM_STORAGE_KEY);
      if (value !== null) {
        setIsPremium(JSON.parse(value));
      }
    } catch (e) {
      console.error('Failed to load subscription status', e);
    } finally {
      setLoading(false);
    }
  };

  // 구독 상태 업데이트 (나중에 결제 성공 시 호출)
  const updateSubscriptionStatus = async (status) => {
    try {
      setIsPremium(status);
      await AsyncStorage.setItem(PREMIUM_STORAGE_KEY, JSON.stringify(status));
    } catch (e) {
      console.error('Failed to save subscription status', e);
    }
  };

  return (
    <SubscriptionContext.Provider value={{ isPremium, updateSubscriptionStatus, loading }}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
