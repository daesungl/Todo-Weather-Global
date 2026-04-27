import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

// 실제 배포 시에는 아래 ID들을 사용하고, 개발 시에는 TestIds를 사용합니다.
const AD_UNITS = {
  BANNER: Platform.select({
    ios: 'ca-app-pub-9445741126920983/1764136281',
    android: 'ca-app-pub-9445741126920983/4014150245',
  }),
  NATIVE: Platform.select({
    ios: 'ca-app-pub-9445741126920983/1387986901',
    android: 'ca-app-pub-9445741126920983/5331620866',
  }),
  APP_OPENING: Platform.select({
    ios: 'ca-app-pub-9445741126920983/2513885833',
    android: 'ca-app-pub-9445741126920983/1392375850',
  }),
};

// 개발 모드(__DEV__)일 때는 구글에서 제공하는 테스트 광고 ID를 사용하도록 설정합니다.
export const BANNER_UNIT_ID = __DEV__ ? TestIds.ADAPTIVE_BANNER : AD_UNITS.BANNER;
export const NATIVE_UNIT_ID = __DEV__ ? TestIds.NATIVE : AD_UNITS.NATIVE;
export const APP_OPENING_UNIT_ID = __DEV__ ? TestIds.APP_OPEN : AD_UNITS.APP_OPENING;

export default AD_UNITS;
