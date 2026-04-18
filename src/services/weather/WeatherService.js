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
  const cacheKey = `weather_v4_${lat.toFixed(4)}_${lon.toFixed(4)}_${regionId}`;

  try {
    // 0. Preliminary Cache Check
    if (!force) {
      const cachedData = await getCache(cacheKey);
      if (cachedData) return cachedData;
    }

    // 1. Determine location info (Resilient VWorld check)
    let locationInfo = { isKorea: false };
    try {
      const koreaLatRange = lat >= 33 && lat <= 39;
      const koreaLonRange = lon >= 124 && lon <= 132;
      const coordBasedIsKorea = koreaLatRange && koreaLonRange;

      if (providedAddress && coordBasedIsKorea) {
        locationInfo = { 
          isKorea: true, 
          address: providedAddress,
          region: providedAddress.split(' ')[0],
          city: providedAddress.split(' ')[1] || ''
        };
      } else if (providedAddress && !coordBasedIsKorea) {
        locationInfo = { isKorea: false, address: providedAddress, region: '', city: '' };
      } else {
        // VWorld call inside try-catch with timeout
        locationInfo = await checkIsKorea(lat, lon);
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
            locationName: address,
            lat,
            lon,
            isAccurateSource: true 
          };
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
      
      console.log(`[${globalName}] 날씨 데이터 ( weatherAPI ) 조회 완료`);
      const result = { 
        ...weatherData, 
        locationName: globalName, 
        lat, 
        lon,
        isAccurateSource: false 
      };
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
