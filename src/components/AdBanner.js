import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useSubscription } from '../contexts/SubscriptionContext';
import { BANNER_UNIT_ID } from '../constants/AdUnits';

const AdBanner = ({ unitId = BANNER_UNIT_ID, size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER }) => {
  const { isPremium } = useSubscription();
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);

  if (isPremium) {
    return null;
  }

  return (
    <View style={[styles.container, !adLoaded && !adError && styles.loadingMinHeight]}>
      <BannerAd
        unitId={unitId}
        size={size}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => {
          setAdLoaded(true);
          setAdError(false);
        }}
        onAdFailedToLoad={(error) => {
          console.warn('[AdBanner] Failed to load ad:', error);
          setAdError(true);
          setAdLoaded(false);
        }}
      />
      {/* 광고 로드에 실패했거나 아직 로딩 중일 때 최소한의 여백 보장 */}
      {(adError || !adLoaded) && <View style={styles.errorSpacer} />}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  loadingMinHeight: {
    minHeight: 60, // 배너 로딩 중일 때 깜빡임 방지
  },
  errorSpacer: {
    height: 30, // 광고 로드 실패 시 보장할 여백
    width: '100%',
  },
});

export default AdBanner;
