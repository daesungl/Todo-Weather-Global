import { checkIsKorea } from './VWorldService';
import { fetchKMAWeather, fetchKMAWarning } from './KMAService';
import { fetchSunInfo } from './SunService';
import { fetchGlobalWeather } from './GlobalService';
import AirService from './AirService';

import { getCache, saveCache } from '../StorageService';

/**
 * Main Weather Engine
 * Strategy: Cache Check -> VWorld (Check Location) -> KMA (Local) -> Global (Fallback)
 */
export const getWeather = async (lat, lon, force = false, regionId = '', providedAddress = '') => {
  const cacheKey = `weather_v6_${lat.toFixed(4)}_${lon.toFixed(4)}_${regionId}`;

  try {
    // 0. Preliminary Cache Check
    if (!force) {
      const cachedData = await getCache(cacheKey);
      if (cachedData) {
        // 캐시된 데이터를 현재 시각 기준으로 isDay 재계산
        // tzOffsetMs가 있으면 해당 지역 현지 시간 사용, 없으면 KST 폴백 (구 캐시 호환)
        const now = new Date();
        let offsetMs;
        if (cachedData.tzOffsetMs !== undefined) {
          // 신규 캐시: 저장된 현지 타임존 오프셋 사용
          offsetMs = cachedData.tzOffsetMs;
        } else if (cachedData.lon !== undefined) {
          // 구 캐시(tzOffsetMs 없음): 경도 기반 근사 타임존 (15° = 1시간)
          offsetMs = Math.round(cachedData.lon / 15) * 3600000;
        } else {
          // 최후 폴백: KST
          offsetMs = 9 * 60 * 60 * 1000;
        }
        const localHour = new Date(now.getTime() + offsetMs).getUTCHours();
        cachedData.isDay = localHour >= 6 && localHour < 18;

        // isDay 변화에 따라 condKey도 교정 (맑음 ↔ 맑은 밤)
        if (!cachedData.isDay && (cachedData.condKey === 'sunny' || cachedData.condKey === 'clear' || cachedData.condKey === 'mostly_sunny')) {
          cachedData.condKey = 'clear_night';
        } else if (cachedData.isDay && cachedData.condKey === 'clear_night') {
          cachedData.condKey = 'sunny';
        }
        
        // Ensure addressName exists for subtitle display
        if (!cachedData.addressName && cachedData.locationName) {
          cachedData.addressName = cachedData.locationName;
        }

        // Save corrected isDay/condKey back to cache so next read is already correct
        saveCache(cacheKey, cachedData).catch(() => {});

        return cachedData;
      }
    }

    // 1. Determine location info (Resilient VWorld check)
    let locationInfo = { isKorea: false };
    try {
      const koreaLatRange = lat >= 33 && lat <= 39;
      const koreaLonRange = lon >= 124 && lon <= 132;
      const coordBasedIsKorea = koreaLatRange && koreaLonRange;

      // 한국 광역시/도 리스트 (검증용)
      const validProvinces = ['서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주'];
      const isFullAddress = providedAddress && validProvinces.some(p => providedAddress.startsWith(p));

      // 1. 주소가 상위 행정구역 정보를 포함한 정석적인 주소인 경우에만 지름길 사용
      if (isFullAddress && coordBasedIsKorea) {
        locationInfo = { 
          isKorea: true, 
          address: providedAddress,
          region: providedAddress.split(' ')[0],
          city: providedAddress.split(' ')[1] || ''
        };
      } else {
        // 주소 정보가 불완전하거나 없는 경우 반드시 API를 통해 정확한 행정구역(Region/City)을 가져옴
        locationInfo = await checkIsKorea(lat, lon);
        // 디스플레이용 주소는 유저가 저장한 명칭을 유지하되, 내부 데이터는 API 결과를 우선함
        if (providedAddress) {
          locationInfo.address = providedAddress;
        }
      }
    } catch (locErr) {
      console.warn('[WeatherService] Location Check (VWorld) failed, assuming Global.', locErr);
      locationInfo = { isKorea: false };
    }
    
    const { isKorea, address, region, city } = locationInfo;

    // 2. Domestic Priority Path (KMA)
    if (isKorea) {
      try {
        console.log(`[${address}] 날씨 데이터 ( KMA ) 조회 중`);
        const [kma, sun, alert] = await Promise.all([
          fetchKMAWeather(lat, lon, locationInfo), // Internal timeouts added
          fetchSunInfo(lat, lon).catch(() => null),
          fetchKMAWarning(region, city).catch(() => null)
        ]);

          if (kma && kma.temp !== '--°') {
            console.log(`[${address}] 날씨 데이터 ( KMA ) 조회 완료`);
            const result = { 
              ...kma, 
              ...sun, 
              alert: alert, 
              locationName: regionId || address, 
              addressName: address, 
              lat,
              lon,
              isAccurateSource: true 
            };

            // Final isDay Correction using local timezone
            const now = new Date();
            const offsetMs = result.tzOffsetMs ?? (9 * 60 * 60 * 1000); // KMA is usually +9h
            const localHour = new Date(now.getTime() + offsetMs).getUTCHours();
            result.isDay = localHour >= 6 && localHour < 18;

            await saveCache(cacheKey, result);
            return result;
          }
        throw new Error('KMA data invalid or empty');
      } catch (kmaErr) {
        console.warn(`[${address}] 날씨 데이터 ( KMA ) 조회 실패 (에러코드: ${kmaErr.response?.status || kmaErr.message})`);
        console.warn('[WeatherService] Domestic Path failed, falling back to Global Source (WeatherAPI).');
        // Fall through to Global path
      }
    }

    // 3. Global Fallback Path (WeatherAPI) - High Availability
    try {
      const globalName = address || 'Global Location';
      console.log(`[${globalName}] 날씨 데이터 ( weatherAPI ) 조회 중`);
      const weatherData = await fetchGlobalWeather(lat, lon);

      // address 없을 때 WeatherAPI가 반환한 도시명으로 폴백 (e.g. "Cupertino, California, United States")
      const resolvedName = address || weatherData?.apiLocationName || 'Global Location';

      console.log(`[${resolvedName}] 날씨 데이터 ( weatherAPI ) 조회 완료`);
      const result = {
        ...weatherData,
        locationName: regionId || resolvedName,
        addressName: resolvedName,
        lat,
        lon,
        isAccurateSource: false
      };

      // Final isDay Correction using local timezone
      const now = new Date();
      const offsetMs = result.tzOffsetMs ?? 0;
      const localHour = new Date(now.getTime() + offsetMs).getUTCHours();
      result.isDay = localHour >= 6 && localHour < 18;

      await saveCache(cacheKey, result);
      return result;
    } catch (globalErr) {
      const globalName = address || 'Global Location';
      console.error(`[${globalName}] 날씨 데이터 ( weatherAPI ) 조회 실패 (에러코드: ${globalErr.response?.status || globalErr.message})`);
      console.error('[WeatherService] Critical: Global Path failed too!', globalErr);
      throw globalErr; // Ultimate failure handled by outer catch
    }

  } catch (error) {
    console.error('[WeatherService] Final Engine Error:', error);
    return {
      source: 'System Fallback',
      temp: '--°',
      humidity: '--%',
      condKey: 'cloudy',
      locationName: 'Error Loading',
      lat,
      lon,
      dailyForecast: [],
      hourlyForecast: []
    };
  }
};


const WeatherService = {
  getWeather,
};

export default WeatherService;
