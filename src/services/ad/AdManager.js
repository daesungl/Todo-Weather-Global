import mobileAds, { AppOpenAd, AdEventType } from 'react-native-google-mobile-ads';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_OPENING_UNIT_ID } from '../../constants/AdUnits';

const AD_COOLDOWN = 4 * 60 * 60 * 1000; // 4시간 (밀리초 단위)
const LAST_AD_KEY = '@last_app_open_ad_time';
const FIRST_RUN_KEY = '@first_run_completed';

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
   * 앱 오프닝 광고 노출 (빈도 제한 로직 포함)
   */
  async showAppOpenAd() {
    try {
      // 1. 첫 실행 여부 확인
      const firstRunCompleted = await AsyncStorage.getItem(FIRST_RUN_KEY);
      if (!firstRunCompleted) {
        console.log('AdManager: First run detected. Skipping ad and marking as completed.');
        await AsyncStorage.setItem(FIRST_RUN_KEY, 'true');
        // 첫 실행 시에는 마지막 광고 시간을 현재로 설정해서 4시간 쿨타임 시작
        await AsyncStorage.setItem(LAST_AD_KEY, Date.now().toString());
        return;
      }

      // 2. 빈도 제한(쿨타임) 확인
      const lastAdTime = await AsyncStorage.getItem(LAST_AD_KEY);
      const now = Date.now();

      if (lastAdTime) {
        const timeDiff = now - parseInt(lastAdTime);
        if (timeDiff < AD_COOLDOWN) {
          const remainingMinutes = Math.ceil((AD_COOLDOWN - timeDiff) / (60 * 1000));
          console.log(`AdManager: Cooldown active. ${remainingMinutes} minutes left.`);
          return;
        }
      }

      // 3. 광고 노출 시도
      if (this.appOpenAd && this.appOpenAd.loaded) {
        this.appOpenAd.show();
        // 노출 시점 저장
        await AsyncStorage.setItem(LAST_AD_KEY, Date.now().toString());
      } else {
        console.log('AdManager: App Open Ad not ready yet');
        this.loadAppOpenAd();
      }
    } catch (error) {
      console.error('AdManager: Error in showAppOpenAd:', error);
    }
  }
}

export default new AdManager();
