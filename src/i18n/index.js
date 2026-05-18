import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en.json';
import ko from './locales/ko.json';
import zhTW from './locales/zh-TW.json';
import zhCN from './locales/zh-CN.json';
import ja from './locales/ja.json';

const resources = {
  en: { translation: en },
  ko: { translation: ko },
  'zh-TW': { translation: zhTW },
  'zh-CN': { translation: zhCN },
  ja: { translation: ja },
};

export const LANGUAGE_STORAGE_KEY = '@user_language';

const getDeviceLanguage = () => {
  const locales = Localization.getLocales();
  const locale = locales?.[0];
  const code = locale?.languageCode || 'en';
  const region = locale?.regionCode || '';

  if (code === 'ko') return 'ko';
  if (code === 'ja') return 'ja';
  if (code === 'zh') {
    const isTraditional = region === 'TW' || region === 'HK' || region === 'MO';
    return isTraditional ? 'zh-TW' : 'zh-CN';
  }
  return 'en';
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: getDeviceLanguage(),
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

// 앱 시작 시 저장된 언어 설정 불러오기. 없으면 기기 언어 기준 유지.
export const initLanguage = async () => {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    const lang = saved || getDeviceLanguage();
    if (i18n.language !== lang) await i18n.changeLanguage(lang);
  } catch (_) {}
};

export default i18n;
