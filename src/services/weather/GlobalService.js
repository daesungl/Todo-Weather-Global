import axios from 'axios';

// 보안을 위해 환경 변수(.env)에서 키를 불러옵니다.
const WEATHER_API_KEY = process.env.EXPO_PUBLIC_WEATHER_API_KEY || '';

// Helper to map WeatherAPI condition text to app's icon keys
const mapConditionToKey = (conditionText, isDay = 1) => {
  const text = conditionText.toLowerCase();
  if (text.includes('rain') || text.includes('drizzle')) return 'rainy';
  if (text.includes('snow') || text.includes('ice') || text.includes('sleet')) return 'snow';
  if (text.includes('thunder') || text.includes('storm')) return 'thunderstorm';
  if (text.includes('cloud') || text.includes('overcast')) return 'cloudy';
  if (text.includes('mist') || text.includes('fog')) return 'cloudy'; // Fallback
  return isDay ? 'sunny' : 'clear_night';
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
        alerts: 'yes'
      }
    });

    const data = response.data;
    const current = data.current;
    const today = data.forecast.forecastday[0];

    // Global Alerts parsing
    let alertData = null;
    if (data.alerts && data.alerts.alert && data.alerts.alert.length > 0) {
      const firstAlert = data.alerts.alert[0];
      const alertText = data.alerts.alert
        .map(a => `[${a.event}] ${a.desc}`)
        .join('\n\n');
      alertData = {
        text: alertText,
        region: data.location.name,
        tmFc: firstAlert.effective || current.last_updated
      };
    }

    // Build Daily Forecast
    const dailyForecast = data.forecast.forecastday.map(d => {
      const dateObj = new Date(d.date);
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const dailyPop = `${Math.max(d.day.daily_chance_of_rain, d.day.daily_chance_of_snow)}%`;
      const condKey = mapConditionToKey(d.day.condition.text);

      return {
        day: dateObj.toLocaleDateString('ko-KR', { weekday: 'short' }),
        date: `${mm}.${dd}`,
        high: `${Math.round(d.day.maxtemp_c)}°`,
        low: `${Math.round(d.day.mintemp_c)}°`,
        condition: condKey,
        condKey: condKey,
        amPop: dailyPop,
        pmPop: dailyPop,
      };
    });

    // Build Hourly Forecast (Next 24 hours)
    const allHours = [...today.hour, ...(data.forecast.forecastday[1]?.hour || [])];
    const currentEpoch = current.last_updated_epoch;
    const hourlyForecast = allHours
      .filter(h => h.time_epoch >= currentEpoch)
      .slice(0, 24)
      .map(h => {
        // Extract local hour from "2023-01-01 10:00" -> 10
        const localHour = parseInt(h.time.split(' ')[1].split(':')[0]);
        const condKey = mapConditionToKey(h.condition.text, h.is_day);
        
        return {
          time: `${localHour}시`,
          temp: `${Math.round(h.temp_c)}°`,
          condition: condKey,
          condKey: condKey,
          isDay: !!h.is_day,
          pop: `${Math.max(h.chance_of_rain, h.chance_of_snow)}%`,
          pcp: h.precip_mm > 0 ? (h.precip_mm >= 1 ? `${Math.round(h.precip_mm)}mm` : `~1mm`) : '0mm',
          wind: `${(h.wind_kph / 3.6).toFixed(1)}m/s`,
          windDeg: (h.wind_degree + 180) % 360, // FROM → TO 방향 변환 (KMA와 동일)
          hum: `${h.humidity}%`,
          fullTime: h.time.replace(/[- :]/g, '').slice(0, 10) + '00' // Use local time for fullTime key
        };
      });

    // Air Quality processing
    const aqiData = mapAQI(current.air_quality['us-epa-index'] || 1);
    const pollutants = processPollutants(current.air_quality);

    // Get current local time key for filtering
    const localNowKey = data.location.localtime.replace(/[- :]/g, '').slice(0, 10) + '00';

    return {
      source: 'WeatherAPI.com',
      temp: `${Math.round(current.temp_c)}°`,
      highTemp: `${Math.round(today.day.maxtemp_c)}°`,
      lowTemp: `${Math.round(today.day.mintemp_c)}°`,
      humidity: `${current.humidity}%`,
      windSpeed: `${(current.wind_kph / 3.6).toFixed(1)}m/s`,
      windDeg: current.wind_degree,
      condKey: mapConditionToKey(current.condition.text, current.is_day),
      conditionText: current.condition.text,
      feelsLike: `${Math.round(current.feelslike_c)}°`,
      visibility: `${current.vis_km}km`,
      uvIndex: mapUVLabel(current.uv),
      sunrise: today.astro.sunrise,
      sunset: today.astro.sunset,
      dailyForecast,
      hourlyForecast,
      isDay: !!current.is_day,
      // 현지 타임존 오프셋 계산:
      // localtime("2024-04-24 15:30")을 UTC로 해석한 ms - localtime_epoch(UTC ms)
      // → 예) LA PDT(UTC-7): 15:30 UTC epoch - 22:30 UTC epoch = -7h
      tzOffsetMs: (() => {
        try {
          const [datePart, timePart] = data.location.localtime.split(' ');
          const [y, mo, d] = datePart.split('-').map(Number);
          const [h, mi] = timePart.split(':').map(Number);
          const localAsUtcMs = Date.UTC(y, mo - 1, d, h, mi, 0);
          return Math.round((localAsUtcMs - data.location.localtime_epoch * 1000) / 3600000) * 3600000;
        } catch {
          return 0;
        }
      })(),
      alert: alertData,
      nowKey: localNowKey, // Provide local now key
      
      // Air Quality specific
      airQuality: aqiData.label,
      aqiValue: Math.round(current.air_quality.pm10 || 10).toString(),
      aqiText: aqiData.text,
      aqiColor: aqiData.color,
      aqiIndex: (current.air_quality['us-epa-index'] || 1) / 6,
      pollutants,
      
      timestamp: new Date().toISOString(),
      // WeatherAPI가 반환하는 현지 도시명 (address 없을 때 폴백용)
      apiLocationName: [data.location.name, data.location.region, data.location.country]
        .filter(Boolean).join(', '),
    };
  } catch (error) {
    return null;
  }
};

export const fetchExtraMetrics = async (lat, lon) => {
  // Utility for KMA regions to grab missing extra elements natively asynchronously
  try {
    const response = await axios.get(`https://api.weatherapi.com/v1/current.json/`, {
      params: { key: WEATHER_API_KEY, q: `${lat},${lon}`, aqi: 'yes' }
    });
    
    const current = response.data.current;
    
    // Process Air Quality if available
    let airQuality = null;
    if (current.air_quality) {
       const aqiData = mapAQI(current.air_quality['us-epa-index'] || 1);
       const pollutants = processPollutants(current.air_quality);
       airQuality = {
         airQuality: aqiData.label,
         aqiValue: Math.round(current.air_quality.pm10 || 10).toString(),
         aqiText: aqiData.text,
         aqiColor: aqiData.color,
         aqiIndex: (current.air_quality['us-epa-index'] || 1) / 6,
         pollutants,
         aqiSource: 'WeatherAPI' // Explicit flag for fallback identification
       };
    }

    return {
      visibility: `${current.vis_km}km`,
      uvIndex: mapUVLabel(current.uv),
      feelsLike: `${Math.round(current.feelslike_c)}°`,
      ...(airQuality || {})
    };
  } catch (err) {
    return null;
  }
};

/**
 * 전 세계 도시 및 지역을 검색합니다. (WeatherAPI Search API)
 */
export const searchLocations = async (query) => {
  if (!query || query.length < 2) return [];

  try {
    const response = await axios.get(`https://api.weatherapi.com/v1/search.json`, {
      params: {
        key: WEATHER_API_KEY,
        q: query
      }
    });

    const data = response.data || [];
    return data.map(item => {
      return {
        id: (item.id || Date.now() + Math.random()).toString(),
        name: item.name,
        address: `${item.region ? item.region + ', ' : ''}${item.country}`,
        lat: item.lat,
        lon: item.lon,
        type: 'global',
        category: 'search.place'
      };
    });
  } catch (error) {
    console.error('WeatherAPI Search API Error:', error);
    return [];
  }
};
