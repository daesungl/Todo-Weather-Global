import axios from 'axios';
import { dfs_xy_conv } from './KMAUtils';

// Encoded Key provided: 7tVKsVRy1O3q85q7nMJA7BpHLKZ38NzZN8BMdMtHWhTrIhkoGQJZ%2Flz2X4NNVQ%2Bxygo%2FDFCLk8eHRE9JmB7j0g%3D%3D
const KMA_SERVICE_KEY = decodeURIComponent('7tVKsVRy1O3q85q7nMJA7BpHLKZ38NzZN8BMdMtHWhTrIhkoGQJZ%2Flz2X4NNVQ%2Bxygo%2FDFCLk8eHRE9JmB7j0g%3D%3D');

/**
 * Get current date/time formatted for KMA API
 * KMA UltraSrtNcst updates at 40 mins past every hour
 */
const getKMABaseTime = () => {
  const now = new Date();
  let baseDate = now.toISOString().slice(0, 10).replace(/-/g, '');
  
  // If current time is before 40 mins past, take the previous hour
  let hour = now.getHours();
  let minute = now.getMinutes();
  
  if (minute < 40) {
    if (hour === 0) {
      // Go back to previous day
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      baseDate = yesterday.toISOString().slice(0, 10).replace(/-/g, '');
      hour = 23;
    } else {
      hour -= 1;
    }
  }
  
  const baseTime = `${hour.toString().padStart(2, '0')}00`;
  return { baseDate, baseTime };
};

/**
 * Fetch Live Weather from KMA
 */
export const fetchKMAWeather = async (lat, lon) => {
  try {
    const { x, y } = dfs_xy_conv('toXY', lat, lon);
    const { baseDate, baseTime } = getKMABaseTime();

    const response = await axios.get('http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst', {
      params: {
        serviceKey: KMA_SERVICE_KEY,
        pageNo: 1,
        numOfRows: 1000,
        dataType: 'JSON',
        base_date: baseDate,
        base_time: baseTime,
        nx: x,
        ny: y,
      },
    });

    const items = response.data?.response?.body?.items?.item;
    if (!items) return null;

    // Mapping KMA codes to common weather object
    // T1H: Temp, REH: Humidity, PTY: Rain Type
    const weather = {};
    items.forEach(item => {
      if (item.category === 'T1H') weather.temp = item.obsrValue;
      if (item.category === 'REH') weather.humidity = item.obsrValue;
      if (item.category === 'PTY') weather.pty = item.obsrValue; // 0: None, 1: Rain, etc.
    });

    return {
      source: 'KMA',
      temp: `${weather.temp}°`,
      humidity: `${weather.humidity}%`,
      condKey: weather.pty === '0' ? 'sunny' : 'light_rain', // Simplified for now
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('KMA API Error:', error);
    return null;
  }
};
