import mobileAds, { AppOpenAd, AdEventType } from 'react-native-google-mobile-ads';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_OPENING_UNIT_ID } from '../../constants/AdUnits';

const AD_COOLDOWN = 24 * 60 * 60 * 1000; // 24시간 (밀리초 단위)
const MIN_DAYS_BEFORE_ADS = 2; // 첫 오픈 후 2일이 지나야 광고 노출 (3일째부터)
const LAST_AD_KEY = '@last_app_open_ad_time';
const FIRST_INSTALL_DATE_KEY = '@first_install_date';

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
      const msg = error?.message || String(error);
      // 다른 뷰컨트롤러가 이미 표시 중인 경우 → 광고는 여전히 유효하므로 유지
      if (msg.includes('already presenting')) return;
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
      const now = Date.now();

      // 1. 첫 오픈 날짜 기록
      let firstInstallDate = await AsyncStorage.getItem(FIRST_INSTALL_DATE_KEY);
      if (!firstInstallDate) {
        await AsyncStorage.setItem(FIRST_INSTALL_DATE_KEY, now.toString());
        console.log('AdManager: First install date recorded. Skipping ad.');
        return;
      }

      // 2. 첫 오픈 후 3일째(48시간 경과) 이전이면 스킵
      const daysSinceInstall = (now - parseInt(firstInstallDate)) / (24 * 60 * 60 * 1000);
      if (daysSinceInstall < MIN_DAYS_BEFORE_ADS) {
        console.log(`AdManager: Day ${Math.floor(daysSinceInstall) + 1} since install. Ads start on day 3.`);
        return;
      }

      // 3. 빈도 제한(쿨타임) 확인
      const lastAdTime = await AsyncStorage.getItem(LAST_AD_KEY);

      if (lastAdTime) {
        const timeDiff = now - parseInt(lastAdTime);
        if (timeDiff < AD_COOLDOWN) {
          const remainingMinutes = Math.ceil((AD_COOLDOWN - timeDiff) / (60 * 1000));
          console.log(`AdManager: Cooldown active. ${remainingMinutes} minutes left.`);
          return;
        }
      }

      // 4. 광고 노출 시도
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
