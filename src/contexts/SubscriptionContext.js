import React, { createContext, useState, useContext, useEffect } from 'react';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { RC_API_KEY, RC_ENTITLEMENT_ID } from '../constants/RevenueCat';

const SubscriptionContext = createContext();

export const LIMITS = {
  FREE: {
    regions: 5,
    flows: 5,
    stepsPerFlow: 300,
    stepWeatherLimit: 3,
  },
  PREMIUM: {
    regions: 15,
    flows: 15,
    stepsPerFlow: 1000,
    stepWeatherLimit: 10,
  },
};

export const SubscriptionProvider = ({ children }) => {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [offerings, setOfferings] = useState(null);

  useEffect(() => {
    initPurchases();
  }, []);

  const initPurchases = async () => {
    try {
      if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
      await Purchases.configure({ apiKey: RC_API_KEY });
      await checkSubscriptionStatus();
      await loadOfferings();
    } catch (e) {
      console.error('[RC] Init error:', e);
    } finally {
      setLoading(false);
    }
  };

  const checkSubscriptionStatus = async () => {
    try {
      const info = await Purchases.getCustomerInfo();
      const active = info.entitlements.active[RC_ENTITLEMENT_ID];
      setIsPremium(!!active);
    } catch (e) {
      console.error('[RC] checkSubscriptionStatus error:', e);
    }
  };

  const loadOfferings = async () => {
    try {
      const result = await Purchases.getOfferings();
      if (result.current) setOfferings(result.current);
    } catch (e) {
      console.error('[RC] loadOfferings error:', e);
    }
  };

  const purchasePackage = async (pkg) => {
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      const active = customerInfo.entitlements.active[RC_ENTITLEMENT_ID];
      setIsPremium(!!active);
      return { success: true };
    } catch (e) {
      if (!e.userCancelled) console.error('[RC] purchasePackage error:', e);
      return { success: false, userCancelled: e.userCancelled };
    }
  };

  const restorePurchases = async () => {
    try {
      const info = await Purchases.restorePurchases();
      const active = info.entitlements.active[RC_ENTITLEMENT_ID];
      setIsPremium(!!active);
      return !!active;
    } catch (e) {
      console.error('[RC] restorePurchases error:', e);
      return false;
    }
  };

  // 개발용 토글 (dev only)
  const devTogglePremium = (val) => {
    if (__DEV__) setIsPremium(val);
  };

  // 사업자 등록 전까지 임시로 모든 제한 해제 (광고는 유지)
  // 단, 새롭게 도입된 스텝 날씨 설정 제한(stepWeatherLimit)은 실제 구독 상태(isPremium)를 따르도록 합니다.
  const actualLimits = isPremium ? LIMITS.PREMIUM : LIMITS.FREE;
  const limits = {
    ...LIMITS.PREMIUM,
    stepWeatherLimit: actualLimits.stepWeatherLimit
  };

  return (
    <SubscriptionContext.Provider value={{
      isPremium,
      loading,
      limits,
      offerings,
      purchasePackage,
      restorePurchases,
      checkSubscriptionStatus,
      devTogglePremium,
    }}>
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
