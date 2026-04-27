import mobileAds, { AppOpenAd, AdEventType } from 'react-native-google-mobile-ads';
import { APP_OPENING_UNIT_ID } from '../../constants/AdUnits';

class AdManager {
  constructor() {
    this.appOpenAd = null;
    this.isInitialized = false;
  }

  /**
   * AdMob SDK 초기화
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      const adapterStatuses = await mobileAds().initialize();
      console.log('AdMob Initialized:', adapterStatuses);
      this.isInitialized = true;
      
      // 초기화 후 앱 오프닝 광고 미리 로드
      this.loadAppOpenAd();
    } catch (error) {
      console.error('AdMob Initialization Error:', error);
    }
  }

  /**
   * 앱 오프닝 광고 로드
   */
  loadAppOpenAd() {
    if (this.appOpenAd) return;

    this.appOpenAd = AppOpenAd.createForAdRequest(APP_OPENING_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });

    this.appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
      console.log('App Open Ad Loaded');
    });

    this.appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
      this.appOpenAd = null;
      this.loadAppOpenAd(); // 다음 번 노출을 위해 다시 로드
    });

    this.appOpenAd.addAdEventListener(AdEventType.ERROR, (error) => {
      console.error('App Open Ad Error:', error);
      this.appOpenAd = null;
    });

    this.appOpenAd.load();
  }

  /**
   * 앱 오프닝 광고 노출
   */
  showAppOpenAd() {
    if (this.appOpenAd && this.appOpenAd.loaded) {
      this.appOpenAd.show();
    } else {
      console.log('App Open Ad not ready yet');
      this.loadAppOpenAd();
    }
  }
}

export default new AdManager();
