import React, { useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useSubscription } from '../contexts/SubscriptionContext';
import { BANNER_UNIT_ID } from '../constants/AdUnits';
import i18n from '../i18n';

const { width: screenWidth } = Dimensions.get('window');
// Google adaptive banner height formula (portrait, capped 50–90dp)
const ADAPTIVE_HEIGHT = Math.max(50, Math.min(90, Math.floor(screenWidth * 0.15)));

const RESERVED_HEIGHT = {
  [BannerAdSize.MEDIUM_RECTANGLE]: 250,
};

const AdBanner = ({ unitId = BANNER_UNIT_ID, size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER, onLoad, onFail }) => {
  const { isPremium } = useSubscription();
  const [adLoaded, setAdLoaded] = useState(false);
  const [adError, setAdError] = useState(false);

  if (isPremium || adError) {
    return null;
  }

  const reservedHeight = RESERVED_HEIGHT[size] ?? ADAPTIVE_HEIGHT;

  return (
    // Outer view always holds the fixed height — never changes after mount
    <View style={{ width: '100%', height: reservedHeight }}>
      {/* Placeholder: in normal flow, sets the height, fades out when ad is ready */}
      <View style={[StyleSheet.absoluteFill, styles.placeholder, adLoaded && styles.hidden]}>
        <Text style={styles.placeholderText}>{i18n.t('ad.placeholder')}</Text>
      </View>
      {/* Ad: absolutely overlaid on the same space, invisible until loaded */}
      <View style={[styles.adOverlay, !adLoaded && styles.hidden]}>
        <BannerAd
          unitId={unitId}
          size={size}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdLoaded={() => {
            setAdLoaded(true);
            setAdError(false);
            if (onLoad) onLoad();
          }}
          onAdFailedToLoad={(error) => {
            console.log('[AdBanner] Failed to load ad:', error);
            setAdError(true);
            setAdLoaded(false);
            if (onFail) onFail(error);
          }}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f4f8',
    borderRadius: 4,
  },
  placeholderText: {
    fontSize: 12,
    color: '#9ca3af',
    letterSpacing: 0.2,
  },
  adOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: {
    opacity: 0,
  },
});

export default AdBanner;
