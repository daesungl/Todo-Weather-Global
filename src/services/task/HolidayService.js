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
      // Set language to Korean if available, fallback to English
      const hd = new Holidays(countryCode);
      const holidays = hd.getHolidays(year);
      
      holidays.forEach(h => {
        const dates = [];
        if (h.start && h.end) {
          let curr = new Date(h.start);
          const end = new Date(h.end);
          
          // Special adjustment for Korean Seollal (Lunar New Year)
          // Library rule sometimes starts on the day of Seollal, but KR law is Day-1, Day, Day+1
          const isSeollal = countryCode === 'KR' && (h.name.includes('설날') || h.name.toLowerCase().includes('seollal'));
          if (isSeollal) {
            curr.setDate(curr.getDate() - 1);
            end.setDate(end.getDate() - 1);
          }

          while (curr < end) {
            // Use local date string parts to avoid timezone shifts
            const y = curr.getFullYear();
            const m = String(curr.getMonth() + 1).padStart(2, '0');
            const d = String(curr.getDate()).padStart(2, '0');
            dates.push(`${y}-${m}-${d}`);
            curr.setDate(curr.getDate() + 1);
          }
        } else {
          dates.push(h.date.split(' ')[0]);
        }

        dates.forEach(dateStr => {
          if (!allHolidays[dateStr]) {
            allHolidays[dateStr] = [];
          }
          allHolidays[dateStr].push({
            name: h.name,
            type: h.type,
            country: countryCode
          });
        });
      });
    } catch (e) {
      console.error(`Error fetching holidays for ${countryCode}:`, e);
    }
  });

  // Manual injection for KR 2026+ new holidays (based on latest legislation)
  if (countries.includes('KR') && year >= 2026) {
    const lDay = `${year}-05-01`;
    if (!allHolidays[lDay]) {
      allHolidays[lDay] = [{ name: '노동절', type: 'public', country: 'KR' }];
    } else if (!allHolidays[lDay].some(h => h.name.includes('노동') || h.name.includes('Labour'))) {
      allHolidays[lDay].push({ name: '노동절', type: 'public', country: 'KR' });
    }
  }

  // Post-processing for Korea's substitute holidays (KR specific enhancement)
  if (countries.includes('KR')) {
    const substitutes = {};
    Object.keys(allHolidays).forEach(ds => {
      const hols = allHolidays[ds];
      hols.forEach(h => {
        if (h.country === 'KR' && h.type === 'public') {
          const date = new Date(ds);
          const day = date.getDay(); // 0: Sun, 6: Sat
          
          // Support both Korean and English names from the library
          const name = h.name.toLowerCase();
          const isGroupA = ['설날', '추석', 'lunar new year', 'thanksgiving'].some(n => name.includes(n.toLowerCase()));
          const isGroupB = [
            '삼일절', '3·1절', '3.1절', '어린이날', '부처님오신날', '석가탄신일', '광복절', '개천절', '한글날', '성탄절', '기독탄신일', '제헌절', '노동절', '근로자의 날',
            'independence movement', 'children\'s day', 'buddha\'s birthday', 'liberation day', 'national foundation day', 'hangul day', 'christmas', 'constitution day', 'labour day'
          ].some(n => name.includes(n.toLowerCase()));
          
          let shouldSub = false;
          let offset = 0;

          if (isGroupA && day === 0) {
            shouldSub = true;
            offset = 1;
          } else if (isGroupB) {
            if (day === 0) {
              shouldSub = true;
              offset = 1;
            } else if (day === 6) {
              shouldSub = true;
              offset = 2;
            }
          }

          if (shouldSub) {
            let subDate = new Date(date);
            subDate.setDate(date.getDate() + offset);
            let subDateStr = subDate.toISOString().split('T')[0];
            
            // Skip existing public holidays to find the next available business day
            while (allHolidays[subDateStr] && allHolidays[subDateStr].some(xh => xh.type === 'public' && xh.country === 'KR')) {
              subDate.setDate(subDate.getDate() + 1);
              subDateStr = subDate.toISOString().split('T')[0];
            }
            
            if (!substitutes[subDateStr]) {
              substitutes[subDateStr] = [];
            }
            // Use a clean Korean name for the substitute
            let cleanName = h.name;
            if (name.includes('independence') || name.includes('3·1') || name.includes('3.1') || name.includes('삼일')) cleanName = '3·1절';
            else if (name.includes('children')) cleanName = '어린이날';
            else if (name.includes('buddha') || name.includes('석가')) cleanName = '부처님오신날';
            else if (name.includes('liberation')) cleanName = '광복절';
            else if (name.includes('foundation')) cleanName = '개천절';
            else if (name.includes('hangul')) cleanName = '한글날';
            else if (name.includes('christmas') || name.includes('기독')) cleanName = '성탄절';
            else if (name.includes('constitution')) cleanName = '제헌절';
            else if (name.includes('labour')) cleanName = '노동절';

            const subName = cleanName.includes('대체') ? cleanName : `${cleanName} 대체공휴일`;
            substitutes[subDateStr].push({
              name: subName,
              type: 'public',
              country: 'KR'
            });
          }
        }
      });
    });

    // Merge substitutes back, ensuring no duplicates and handling overlaps
    Object.keys(substitutes).forEach(sDate => {
      if (!allHolidays[sDate]) {
        allHolidays[sDate] = substitutes[sDate];
      } else {
        substitutes[sDate].forEach(sh => {
          if (!allHolidays[sDate].some(existing => existing.name.includes(sh.name.split(' ')[0]))) {
            allHolidays[sDate].push(sh);
          }
        });
      }
    });
  }

  return allHolidays;
};

export const getDefaultCountry = () => {
  const locales = Localization.getLocales();
  if (locales && locales.length > 0 && locales[0].regionCode) {
    return locales[0].regionCode;
  }
  return Localization.region || 'KR'; // 한국 사용자 우선 고려하여 기본값 KR로 설정
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
