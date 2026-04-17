import { checkIsKorea } from './VWorldService';
import { fetchKMAWeather } from './KMAService';
import { fetchGlobalWeather } from './GlobalService';

/**
 * Main Weather Engine
 * Strategy: VWorld (Check Location) -> KMA (Local) -> Global (Fallback)
 */
export const getWeather = async (lat, lon) => {
  try {
    // 1. Check if location is in Korea using VWorld
    const { isKorea, address } = await checkIsKorea(lat, lon);
    console.log(`Location Analysis: ${isKorea ? 'Korea' : 'Outside Korea'} (${address || 'Unknown'})`);

    let weatherData = null;

    if (isKorea) {
      // 2. Try KMA First for high precision in Korea
      weatherData = await fetchKMAWeather(lat, lon);
      if (weatherData) {
        return { ...weatherData, locationName: address };
      }
    }

    // 3. Fallback to Global Source if not in Korea or KMA failed
    weatherData = await fetchGlobalWeather(lat, lon);
    return { ...weatherData, locationName: address || 'Global Location' };

  } catch (error) {
    console.error('Weather Service Orchestrator Error:', error);
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
