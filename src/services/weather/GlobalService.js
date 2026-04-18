import axios from 'axios';

const WEATHER_API_KEY = '9ec649060fca47d8ac621847261804';

// Helper to map WeatherAPI condition text to app's icon keys
const mapConditionToKey = (conditionText, isDay = 1) => {
  const text = conditionText.toLowerCase();
  if (text.includes('rain') || text.includes('drizzle')) return 'rainy';
  if (text.includes('snow') || text.includes('ice') || text.includes('sleet')) return 'snow';
  if (text.includes('thunder') || text.includes('storm')) return 'thunderstorm';
  if (text.includes('cloud') || text.includes('overcast')) return 'cloudy';
  if (text.includes('mist') || text.includes('fog')) return 'cloudy'; // Fallback
  return isDay ? 'sunny' : 'clear-night';
};

const mapUVLabel = (uv) => {
  if (uv <= 2) return `${uv} (낮음)`;
  if (uv <= 5) return `${uv} (보통)`;
  if (uv <= 7) return `${uv} (높음)`;
  if (uv <= 10) return `${uv} (매우 높음)`;
  return `${uv} (위험)`;
};

const mapAQI = (usAqiIndex) => {
  // US EPA Index: 1=Good, 2=Moderate, 3=Unhealthy for sensitive, 4=Unhealthy, 5=Very Unhealthy, 6=Hazardous
  switch(usAqiIndex) {
    case 1: return { label: '좋음', text: '쾌적한 공기입니다. 야외 활동에 좋습니다.', color: '#4CAF50' };
    case 2: return { label: '보통', text: '전반적으로 괜찮으나, 민감군은 주의하세요.', color: '#FFC107' };
    case 3: return { label: '나쁨', text: '민감군은 장시간 야외 활동을 피하세요.', color: '#FF9800' };
    case 4: return { label: '매우 나쁨', text: '모두의 건강에 해롭습니다. 야외 활동을 자제하세요.', color: '#F44336' };
    default: return { label: '위험', text: '가급적 실내에 머무르세요.', color: '#9C27B0' };
  }
};

const processPollutants = (aqData) => {
  if (!aqData) return null;
  const getSeverityColor = (val, thresholds) => {
    if (val <= thresholds[0]) return '#4CAF50';
    if (val <= thresholds[1]) return '#FFC107';
    if (val <= thresholds[2]) return '#FF9800';
    return '#F44336';
  };

  return {
    pm10: { value: Math.round(aqData.pm10), unit: 'µg/m³', label: 'PM10', color: getSeverityColor(aqData.pm10, [30, 80, 150]) },
    pm25: { value: Math.round(aqData.pm2_5), unit: 'µg/m³', label: 'PM2.5', color: getSeverityColor(aqData.pm2_5, [15, 35, 75]) },
    o3: { value: aqData.o3.toFixed(3), unit: 'μg', label: '오존', color: getSeverityColor(aqData.o3, [60, 120, 200]) },
    no2: { value: aqData.no2.toFixed(3), unit: 'μg', label: '이산화질소', color: getSeverityColor(aqData.no2, [40, 100, 200]) },
    co: { value: (aqData.co/1000).toFixed(2), unit: 'mg', label: '일산화탄소', color: getSeverityColor(aqData.co, [4000, 9000, 15000]) },
    so2: { value: aqData.so2.toFixed(3), unit: 'μg', label: '아황산가스', color: getSeverityColor(aqData.so2, [50, 200, 400]) },
  };
};

export const fetchGlobalWeather = async (lat, lon) => {
  console.log(`[GlobalService] Fetching from WeatherAPI (HTTPS) for ${lat}, ${lon}`);
  
  try {
    const response = await axios.get(`https://api.weatherapi.com/v1/forecast.json`, {
      params: {
        key: WEATHER_API_KEY,
        q: `${lat},${lon}`,
        days: 10,
        aqi: 'yes',
        alerts: 'no'
      }
    });

    const data = response.data;
    const current = data.current;
    const today = data.forecast.forecastday[0];

    // Build Daily Forecast
    const dailyForecast = data.forecast.forecastday.map(d => ({
      day: new Date(d.date).toLocaleDateString('ko-KR', { weekday: 'short' }),
      high: `${Math.round(d.day.maxtemp_c)}°`,
      low: `${Math.round(d.day.mintemp_c)}°`,
      condition: mapConditionToKey(d.day.condition.text)
    }));

    // Build Hourly Forecast (Next 24 hours)
    const allHours = [...today.hour, ...(data.forecast.forecastday[1]?.hour || [])];
    const currentEpoch = current.last_updated_epoch;
    const hourlyForecast = allHours
      .filter(h => h.time_epoch >= currentEpoch)
      .slice(0, 24)
      .map(h => {
        const d = new Date(h.time_epoch * 1000);
        return {
          time: `${d.getHours()}시`,
          temp: `${Math.round(h.temp_c)}°`,
          condition: mapConditionToKey(h.condition.text, h.is_day)
        };
      });

    // Air Quality processing
    const aqiData = mapAQI(current.air_quality['us-epa-index'] || 1);
    const pollutants = processPollutants(current.air_quality);

    return {
      source: 'WeatherAPI.com',
      temp: `${Math.round(current.temp_c)}°`,
      highTemp: `${Math.round(today.day.maxtemp_c)}°`,
      lowTemp: `${Math.round(today.day.mintemp_c)}°`,
      humidity: `${current.humidity}%`,
      condKey: mapConditionToKey(current.condition.text, current.is_day),
      conditionText: current.condition.text,
      feelsLike: `${Math.round(current.feelslike_c)}°`,
      visibility: `${current.vis_km}km`,
      uvIndex: mapUVLabel(current.uv),
      sunrise: today.astro.sunrise,
      sunset: today.astro.sunset,
      dailyForecast,
      hourlyForecast,
      
      // Air Quality specific
      airQuality: aqiData.label,
      aqiValue: Math.round(current.air_quality.pm10 || 10).toString(),
      aqiText: aqiData.text,
      aqiColor: aqiData.color,
      aqiIndex: (current.air_quality['us-epa-index'] || 1) / 6,
      pollutants,
      
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[GlobalService] WeatherAPI Fetch Error:', error.message);
    return null;
  }
};

export const fetchExtraMetrics = async (lat, lon) => {
  // Utility for KMA regions to grab missing extra elements natively asynchronously
  console.log(`[GlobalService] Extra fetch for lat:${lat}, lon:${lon}`);
  try {
    const response = await axios.get(`https://api.weatherapi.com/v1/current.json`, {
      params: { key: WEATHER_API_KEY, q: `${lat},${lon}`, aqi: 'no' }
    });
    console.log(`[GlobalService] Extra data received: UV=${response.data.current.uv}, Vis=${response.data.current.vis_km}`);
    return {
      visibility: `${response.data.current.vis_km}km`,
      uvIndex: mapUVLabel(response.data.current.uv),
      feelsLike: `${Math.round(response.data.current.feelslike_c)}°`,
    };
  } catch (err) {
    console.warn('[GlobalService] Extra fetch failed:', err.message);
    return null;
  }
};
