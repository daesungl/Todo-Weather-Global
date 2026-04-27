import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SubscriptionContext = createContext();

const PREMIUM_STORAGE_KEY = '@is_premium_user';

export const LIMITS = {
  FREE: {
    regions: 5,
    flows: 5,
    stepsPerFlow: 10,
  },
  PREMIUM: {
    regions: 15,
    flows: 30,
    stepsPerFlow: 30,
  },
};

export const SubscriptionProvider = ({ children }) => {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

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

  const updateSubscriptionStatus = async (status) => {
    try {
      await AsyncStorage.setItem(PREMIUM_STORAGE_KEY, JSON.stringify(status));
      setIsPremium(status);
    } catch (e) {
      console.error('Failed to save subscription status', e);
    }
  };

  const limits = isPremium ? LIMITS.PREMIUM : LIMITS.FREE;

  return (
    <SubscriptionContext.Provider value={{ isPremium, updateSubscriptionStatus, loading, limits }}>
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
