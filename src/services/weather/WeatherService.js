import { checkIsKorea } from './VWorldService';
import { fetchKMAWeather, fetchKMAWarning } from './KMAService';
import { fetchSunInfo } from './SunService';
import { fetchGlobalWeather } from './GlobalService';
import AirService from './AirService';

/**
 * Main Weather Engine
 * Strategy: VWorld (Check Location) -> KMA (Local) -> Global (Fallback)
 */
export const getWeather = async (lat, lon) => {
  try {
    // 1. Check if location is in Korea using VWorld
    const locationInfo = await checkIsKorea(lat, lon);
    const { isKorea, address, region, city } = locationInfo;
    console.log(`Location Analysis: ${isKorea ? 'Korea' : 'Outside Korea'} (${address || 'Unknown'})`);

    let weatherData = null;
    let sunData = null;
    let alertData = null;
    let airData = null;

    if (isKorea) {
      // 2. Try KMA First for high precision in Korea
      // Fetch Weather, Sun, and Alerts concurrently
      const [kma, sun, alert] = await Promise.all([
        fetchKMAWeather(lat, lon, locationInfo),
        fetchSunInfo(lat, lon),
        fetchKMAWarning(region, city)
      ]);
      weatherData = kma;
      sunData = sun;
      alertData = alert;

      // 2.1 Fetch Korean Air Quality (Sequential because it needs address -> station)
      try {
        const tm = await AirService.getTMCoord(address);
        if (tm) {
          const station = await AirService.getNearestStation(tm.x, tm.y);
          if (station) {
            airData = await AirService.fetchAirQuality(station);
          }
        }
      } catch (airErr) {
        console.warn('Air Quality Fetch Failed:', airErr);
      }
      
      if (weatherData) {
        return { 
          ...weatherData, 
          ...sunData, 
          ...airData, // Merging Air Quality Data
          alert: alertData, 
          locationName: address 
        };
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
