import Holidays from 'date-holidays';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@user_holiday_countries';

/**
 * Get holidays for a given year and countries
 * @param {number} year 
 * @param {string[]} countries e.g. ['KR', 'US']
 */
export const getHolidaysForYear = (year, countries) => {
  const allHolidays = {};
  
  countries.forEach(countryCode => {
    try {
      const hd = new Holidays(countryCode);
      const holidays = hd.getHolidays(year);
      
      holidays.forEach(h => {
        // Date format: YYYY-MM-DD
        const dateStr = h.date.split(' ')[0];
        if (!allHolidays[dateStr]) {
          allHolidays[dateStr] = [];
        }
        allHolidays[dateStr].push({
          name: h.name,
          type: h.type,
          country: countryCode
        });
      });
    } catch (e) {
      console.error(`Error fetching holidays for ${countryCode}:`, e);
    }
  });

  return allHolidays;
};

/**
 * Get the default country code based on device locale
 */
export const getDefaultCountry = () => {
  const regionCode = Localization.region;
  return regionCode || 'US'; // Fallback to US
};

/**
 * Load saved holiday countries from storage
 */
export const loadSavedCountries = async () => {
  try {
    const saved = await AsyncStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
    return [getDefaultCountry()];
  } catch (e) {
    console.error('Failed to load holiday countries', e);
    return [getDefaultCountry()];
  }
};

/**
 * Save holiday countries to storage
 */
export const saveCountries = async (countries) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(countries));
  } catch (e) {
    console.error('Failed to save holiday countries', e);
  }
};

/**
 * Check if a date is a public holiday
 * @param {string} dateStr YYYY-MM-DD
 * @param {Object} holidaysMap Map of dateStr to holiday details
 */
export const isPublicHoliday = (dateStr, holidaysMap) => {
  const holidays = holidaysMap[dateStr];
  if (!holidays) return false;
  // Check if any of the holidays are of type 'public'
  return holidays.some(h => h.type === 'public');
};
const KOREAN_COUNTRY_NAMES = {
  'KR': '대한민국',
  'US': '미국',
  'JP': '일본',
  'CN': '중국',
  'GB': '영국',
  'FR': '프랑스',
  'DE': '독일',
  'CA': '캐나다',
  'AU': '호주',
  'VN': '베트남',
  'TH': '태국',
  'PH': '필리핀',
  'ID': '인도네시아',
  'MY': '말레이시아',
  'SG': '싱가포르',
  'BR': '브라질',
  'MX': '멕시코',
  'RU': '러시아',
  'IT': '이탈리아',
  'ES': '스페인',
  'IN': '인도',
  'TW': '대만',
  'HK': '홍콩',
  'MO': '마카오',
  'CH': '스위스',
  'NL': '네덜란드',
  'BE': '벨기에',
  'AT': '오스트리아',
  'SE': '스웨덴',
  'NO': '노르웨이',
  'DK': '덴마크',
  'FI': '핀란드',
  'PT': '포르투갈',
  'TR': '터키',
  'SA': '사우디아라비아',
  'AE': '아랍에미리트',
  'EG': '이집트',
  'ZA': '남아프리카공화국',
  'NZ': '뉴질랜드',
  'AR': '아르헨티나',
  'CL': '칠레',
  'CO': '콜롬비아',
  'PE': '페루',
  'GR': '그리스',
  'PL': '폴란드',
  'CZ': '체코',
  'HU': '헝가리',
  'RO': '루마니아',
  'UA': '우크라이나',
};

const ENGLISH_COUNTRY_NAMES = {
  'KR': 'South Korea',
  'JP': 'Japan',
  'CN': 'China',
  'TW': 'Taiwan',
  'HK': 'Hong Kong',
  'MO': 'Macao',
  'KP': 'North Korea',
  'VN': 'Vietnam',
};

/**
 * Get list of all supported countries
 * @returns {Array<{code: string, name: string, kname: string, ename: string}>}
 */
export const getSupportedCountries = () => {
  const hd = new Holidays();
  const countries = hd.getCountries();
  return Object.keys(countries).map(code => ({
    code,
    name: countries[code],
    kname: KOREAN_COUNTRY_NAMES[code] || '',
    ename: ENGLISH_COUNTRY_NAMES[code] || countries[code]
  })).sort((a, b) => a.ename.localeCompare(b.ename));
};
