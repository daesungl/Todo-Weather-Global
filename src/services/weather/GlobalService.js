/**
 * Stub Global Weather Service
 * To be replaced with real OpenWeatherMap or other global source
 */
export const fetchGlobalWeather = async (lat, lon) => {
  console.log('Fetching from Global Source (Fallback)...');
  // Simulated global weather data
  return {
    source: 'Global DB',
    temp: '22°',
    humidity: '40%',
    condKey: 'partly_cloudy',
    timestamp: new Date().toISOString(),
  };
};
