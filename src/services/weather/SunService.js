import axios from 'axios';
import { saveCache, getCache } from '../StorageService';

const SERVICE_KEY = decodeURIComponent('7tVKsVRy1O3q85q7nMJA7BpHLKZ38NzZN8BMdMtHWhTrIhkoGQJZ%2Flz2X4NNVQ%2Bxygo%2FDFCLk8eHRE9JmB7j0g%3D%3D');

const DAY_MS = 24 * 60 * 60 * 1000; // 하루 = 86,400,000ms

const pad = (n) => n.toString().padStart(2, '0');

const getKSTDateString = () => {
  const kstOffset = 9 * 60 * 60 * 1000;
  const kstDate = new Date(new Date().getTime() + kstOffset);
  const year = kstDate.getUTCFullYear();
  const month = pad(kstDate.getUTCMonth() + 1);
  const day = pad(kstDate.getUTCDate());
  return `${year}${month}${day}`;
};

const formatTime = (timeStr) => {
  if (!timeStr || timeStr.length < 4) return '--:--';
  const h = timeStr.slice(0, 2);
  const m = timeStr.slice(2, 4);
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
  return `${pad(displayHour)}:${m} ${ampm}`;
};

/**
 * Fetch Sunrise and Sunset info from KASI (하루 1회 캐싱)
 * @param {number} lat Latitude
 * @param {number} lon Longitude
 */
export const fetchSunInfo = async (lat, lon) => {
  const locdate = getKSTDateString();
  const cacheKey = `sun_${locdate}_${lat}_${lon}`;

  // 캐시 확인 (만료: 24시간)
  const cached = await getCache(cacheKey, DAY_MS);
  if (cached) {
    console.log(`[SunService] Cache HIT: ${cacheKey}`);
    return cached;
  }

  try {
    console.log(`[SunService] Fetching sun info for ${lat}, ${lon} (${locdate})`);
    const response = await axios.get('http://apis.data.go.kr/B090041/openapi/service/RiseSetInfoService/getLCRiseSetInfo', {
      params: {
        serviceKey: SERVICE_KEY,
        locdate: locdate,
        longitude: lon,
        latitude: lat,
        dnYn: 'Y'
      },
      timeout: 8000 // 4초→8초로 늘려 타임아웃 에러 감소
    });

    const item = response.data?.response?.body?.items?.item;
    if (!item) return null;

    const result = {
      sunrise: formatTime(item.sunrise.toString()),
      sunset: formatTime(item.sunset.toString()),
      moonrise: formatTime(item.moonrise.toString()),
      moonset: formatTime(item.moonset.toString()),
    };

    // 하루치 캐시 저장
    await saveCache(cacheKey, result);
    console.log(`[SunService] Cached sun info for ${locdate}`);

    return result;
  } catch (error) {
    console.error('Sun Info API Error:', error);
    return null;
  }
};
