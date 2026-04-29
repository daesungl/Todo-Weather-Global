import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useSubscription } from '../contexts/SubscriptionContext';
import { BANNER_UNIT_ID } from '../constants/AdUnits';

const AdBanner = ({ unitId = BANNER_UNIT_ID, size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER }) => {
  const { isPremium } = useSubscription();
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);

  if (isPremium || adError) {
    return null;
  }

  return (
    <View style={styles.container}>
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
          console.log('[AdBanner] Failed to load ad:', error);
          setAdError(true);
          setAdLoaded(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    // 광고가 로드되기 전까지는 높이를 차지하지 않음
  },
});

export default AdBanner;
