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
export const getWeather = async (lat, lon, force = false, regionId = '') => {
  const cacheKey = `weather_v3_${lat.toFixed(4)}_${lon.toFixed(4)}_${regionId}`;

  try {
    // 0. Preliminary Cache Check (20 min expiry)
    // If force is true, we skip caching and hit the API
    if (!force) {
      const cachedData = await getCache(cacheKey);
      if (cachedData) return cachedData;
    }

    // 1. Check if location is in Korea using VWorld
    const locationInfo = await checkIsKorea(lat, lon);
    const { isKorea, address, region, city } = locationInfo;

    let weatherData = null;
    let sunData = null;
    let alertData = null;
    let airData = null;

    if (isKorea) {
      console.log(`[WeatherService] Running Domestic Mode for: ${address}`);
      // Try KMA & AirKorea First
      const [kma, sun, alert] = await Promise.all([
        fetchKMAWeather(lat, lon, locationInfo).catch(err => {
          console.warn('[WeatherService] KMA Main Fetch Failed, will fallback to Global.', err);
          return null;
        }),
        fetchSunInfo(lat, lon).catch(() => null),
        fetchKMAWarning(region, city).catch(() => null)
      ]);

      // If KMA data successfully returned, use it with its included AirKorea data
      if (kma && kma.temp !== '--°') {
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
      console.warn('[WeatherService] KMA data is invalid/missing. Falling back to Global Source (WeatherAPI).');
    }

    // 3. Fallback to Global Source if not in Korea OR KMA failed
    console.log(`[WeatherService] Running Global Mode for: ${address || 'Global Location'}`);
    weatherData = await fetchGlobalWeather(lat, lon);
    
    const result = { 
      ...weatherData, 
      locationName: address || 'Global Location', 
      lat, 
      lon,
      isAccurateSource: false // Use Global Fallback
    };
    await saveCache(cacheKey, result);
    return result;

  } catch (error) {
    // Ultimate fallback to hardcoded dummy if everything fails
    return {
      source: 'System Fallback',
      temp: '--°',
      humidity: '--%',
      condKey: 'sunny',
      locationName: 'Unknown',
    };
  }
};

const WeatherService = {
  getWeather,
};

export default WeatherService;
