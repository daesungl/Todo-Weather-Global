import axios from 'axios';
import { dfs_xy_conv } from './KMAUtils';
import TempRegionCode from './data/Temp_RegionCityCode.json';
import SkyRegionCode from './data/Sky_RegionCityCode.json';
import WeatherWarnStationCode from './data/WeatherWarnStationCode.json';

const KMA_SERVICE_KEY = decodeURIComponent('7tVKsVRy1O3q85q7nMJA7BpHLKZ38NzZN8BMdMtHWhTrIhkoGQJZ%2Flz2X4NNVQ%2Bxygo%2FDFCLk8eHRE9JmB7j0g%3D%3D');

const pad = (n) => n.toString().padStart(2, '0');

const getKSTDate = (date = new Date()) => {
  const kstOffset = 9 * 60 * 60 * 1000;
  return new Date(date.getTime() + kstOffset);
};

const getKSTDateString = (date = new Date()) => {
  const kstDate = getKSTDate(date);
  const year = kstDate.getUTCFullYear();
  const month = pad(kstDate.getUTCMonth() + 1);
  const day = pad(kstDate.getUTCDate());
  return `${year}${month}${day}`;
};

export const fetchKMAWarning = async (region, city) => {
  try {
    let stnId = 108; // 전국 기본
    const locationStr = `${region} ${city}`;
    const matched = WeatherWarnStationCode.find(d => locationStr.includes(d.Region));
    if (matched) stnId = matched.Code;

    const baseDate = getKSTDateString();
    const url = 'https://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrInfo';
    const params = { serviceKey: KMA_SERVICE_KEY, pageNo: '1', numOfRows: '10', dataType: 'JSON', stnId, fromTmFc: baseDate };
    const response = await axios.get(url, { params });
    const item = response.data?.response?.body?.items?.item?.[0];
    return item?.t1 ? item.t1.replace(/STN-ID: \d+/g, '').replace(/\\n/g, '\n').trim() : null;
  } catch (error) {
    return null;
  }
};



const getNcstBaseTime = () => {
  const now = new Date();
  const kst = getKSTDate(now);
  let baseDate = getKSTDateString(now);
  let hour = kst.getUTCHours();
  let minute = kst.getUTCMinutes();
  if (minute < 40) {
    if (hour === 0) {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      baseDate = getKSTDateString(yesterday);
      hour = 23;
    } else { hour -= 1; }
  }
  return { baseDate, baseTime: `${pad(hour)}00` };
};

const getUltraBaseTime = () => {
  const now = new Date();
  const kst = getKSTDate(now);
  let baseDate = getKSTDateString(now);
  let hour = kst.getUTCHours();
  let minute = kst.getUTCMinutes();
  if (minute < 45) {
    if (hour === 0) {
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      baseDate = getKSTDateString(yesterday);
      hour = 23;
    } else { hour -= 1; }
  }
  return { baseDate, baseTime: `${pad(hour)}30` };
}

const getVilageBaseTime = () => {
  const now = new Date();
  const kst = getKSTDate(now);
  const times = [2, 5, 8, 11, 14, 17, 20, 23];
  let hour = kst.getUTCHours();
  let minute = kst.getUTCMinutes();
  let baseHour = 23;
  let baseDate = getKSTDateString(now);
  for (let i = times.length - 1; i >= 0; i--) {
    if (hour > times[i] || (hour === times[i] && minute >= 15)) {
      baseHour = times[i];
      break;
    }
  }
  if (hour < 2 || (hour === 2 && minute < 15)) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    baseDate = getKSTDateString(yesterday);
    baseHour = 23;
  }
  return { baseDate, baseTime: `${pad(baseHour)}00` };
};

const getMidBaseTime = () => {
  const now = new Date();
  const kst = getKSTDate(now);
  let hour = kst.getUTCHours();
  let minute = kst.getUTCMinutes();
  let baseDate = getKSTDateString(now);
  let baseTime = '0600';
  if (hour < 6 || (hour === 6 && minute < 10)) {
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    baseDate = getKSTDateString(yesterday);
    baseTime = '1800';
  } else if (hour >= 18 && minute >= 10) { baseTime = '1800'; }
  else { baseTime = '0600'; }
  return { baseDate, baseTime };
};

const mapKMAtoCondKey = (sky, pty) => {
  if (pty && pty !== '0') {
    if (pty === '1' || pty === '5') return 'light_rain';
    if (pty === '2' || pty === '6') return 'rainy';
    if (pty === '3' || pty === '7') return 'snow';
    if (pty === '4') return 'moderate_rain';
    return 'rainy';
  }
  if (sky === '1') return 'sunny';
  if (sky === '3') return 'partly_cloudy';
  if (sky === '4') return 'cloudy';
  return 'sunny';
};

const findMidRegionCodes = (addressObj) => {
  const fullName = addressObj.address || '';
  const region = addressObj.region || '';
  const city = addressObj.city || '';
  let taCode = TempRegionCode.find(d => (fullName.includes(d.Region1) && (fullName.includes(d.City) || fullName.includes(d.Region2) || fullName.includes(d.Region3))))?.Code;
  if (!taCode) { taCode = TempRegionCode.find(d => fullName.includes(d.City))?.Code || '11B10101'; }
  let landCode = SkyRegionCode.find(d => region.includes(d.Region) && city.includes(d.City))?.Code;
  if (!landCode) { landCode = SkyRegionCode.find(d => fullName.includes(d.Region))?.Code || '11B00000'; }
  return { taCode, landCode };
};

export const fetchKMAWeather = async (lat, lon, addressObj = {}) => {
  try {
    const { x, y } = dfs_xy_conv('toXY', lat, lon);
    const ncstTime = getNcstBaseTime();
    const ultraTime = getUltraBaseTime();
    const vilageTime = getVilageBaseTime();
    const midTime = getMidBaseTime();
    const { taCode, landCode } = findMidRegionCodes(addressObj);

    const [ncstRes, ultraRes, vilageRes, midLandRes, midTaRes] = await Promise.all([
      axios.get('http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst', {
        params: { serviceKey: KMA_SERVICE_KEY, pageNo: 1, numOfRows: 10, dataType: 'JSON', base_date: ncstTime.baseDate, base_time: ncstTime.baseTime, nx: x, ny: y }
      }).catch(() => null),
      axios.get('http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst', {
        params: { serviceKey: KMA_SERVICE_KEY, pageNo: 1, numOfRows: 60, dataType: 'JSON', base_date: ultraTime.baseDate, base_time: ultraTime.baseTime, nx: x, ny: y }
      }).catch(() => null),
      axios.get('http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst', {
        params: { serviceKey: KMA_SERVICE_KEY, pageNo: 1, numOfRows: 1000, dataType: 'JSON', base_date: vilageTime.baseDate, base_time: vilageTime.baseTime, nx: x, ny: y }
      }).catch(() => null),
      axios.get('http://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst', {
        params: { serviceKey: KMA_SERVICE_KEY, pageNo: 1, numOfRows: 10, dataType: 'JSON', regId: landCode, tmFc: midTime.baseDate + midTime.baseTime }
      }).catch(() => null),
      axios.get('http://apis.data.go.kr/1360000/MidFcstInfoService/getMidTa', {
        params: { serviceKey: KMA_SERVICE_KEY, pageNo: 1, numOfRows: 10, dataType: 'JSON', regId: taCode, tmFc: midTime.baseDate + midTime.baseTime }
      }).catch(() => null)
    ]);

    const liveItems = ncstRes?.data?.response?.body?.items?.item || [];
    const ultraItems = ultraRes?.data?.response?.body?.items?.item || [];
    const forecastItems = vilageRes?.data?.response?.body?.items?.item || [];
    const midLandData = midLandRes?.data?.response?.body?.items?.item?.[0] || {};
    const midTaData = midTaRes?.data?.response?.body?.items?.item?.[0] || {};

    const liveWeather = {};
    liveItems.forEach(item => {
      if (item.category === 'T1H') liveWeather.temp = item.obsrValue;
      if (item.category === 'REH') liveWeather.humidity = item.obsrValue;
      if (item.category === 'PTY') liveWeather.pty = item.obsrValue;
    });

    ultraItems.forEach(item => {
      if (item.category === 'SKY' && !liveWeather.sky) liveWeather.sky = item.fcstValue;
      if (item.category === 'PTY' && (!liveWeather.pty || liveWeather.pty === '0')) liveWeather.pty = item.fcstValue;
    });

    const hourlyMap = {};
    forecastItems.forEach(item => {
      const key = `${item.fcstDate}${item.fcstTime}`;
      if (!hourlyMap[key]) hourlyMap[key] = { date: item.fcstDate, time: item.fcstTime };
      if (item.category === 'TMP') hourlyMap[key].temp = item.fcstValue;
      if (item.category === 'SKY') hourlyMap[key].sky = item.fcstValue;
      if (item.category === 'PTY') hourlyMap[key].pty = item.fcstValue;
      if (item.category === 'POP') hourlyMap[key].pop = item.fcstValue;
      if (item.category === 'WSD') hourlyMap[key].wind = item.fcstValue;
      if (item.category === 'REH') hourlyMap[key].hum = item.fcstValue;
      if (item.category === 'VEC') hourlyMap[key].windDeg = item.fcstValue;
    });

    const nowKST = getKSTDate();
    const nowTimeKey = `${getKSTDateString(nowKST)}${pad(nowKST.getUTCHours())}00`;
    
    const hourlyForecast = Object.values(hourlyMap)
      .filter(h => `${h.date}${h.time}` >= nowTimeKey)
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
      .slice(0, 120)
      .map(h => {
        const hour = parseInt(h.time.slice(0, 2));
        const hourLabel = hour === 0 ? '0시' : (hour === 12 ? '12시' : `${hour}시`);
        return {
          time: hourLabel,
          temp: `${h.temp}°`,
          condKey: mapKMAtoCondKey(h.sky, h.pty),
          pop: `${h.pop}%`,
          wind: `${Math.round(h.wind)}m/s`,
          windDeg: h.windDeg,
          hum: `${h.hum}%`,
          fullTime: `${h.date}${h.time}`
        };
      });

    let highLimit = -100, lowLimit = 100;
    const todayStr = getKSTDateString(new Date());
    forecastItems.forEach(item => {
      if (item.fcstDate === todayStr) {
        const val = parseFloat(item.fcstValue);
        if (item.category === 'TMP' || item.category === 'TMX' || item.category === 'TMN') {
          if (val > highLimit) highLimit = val;
          if (val < lowLimit) lowLimit = val;
        }
      }
    });

    const dailyForecast = [];
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const now = new Date();
    
    for (let i = 0; i < 10; i++) {
      const targetDate = new Date(now.getTime() + (i * 24 * 60 * 60 * 1000));
      const kstTarget = getKSTDate(targetDate);
      const dStr = getKSTDateString(targetDate);
      const dayLabel = i === 0 ? 'Today' : (i === 1 ? 'Tomorrow' : weekdays[kstTarget.getUTCDay()]);
      
      let curHigh = 0;
      let curLow = 0;
      let curCond = 'sunny';

      let viFound = false;
      let viHigh = -100, viLow = 100, viSky = '1', viPty = '0';
      forecastItems.forEach(item => {
        if (item.fcstDate === dStr) {
          viFound = true;
          const val = parseFloat(item.fcstValue);
          if (item.category === 'TMP' || item.category === 'TMX' || item.category === 'TMN') {
            if (val > viHigh) viHigh = val;
            if (val < viLow) viLow = val;
          }
          if (item.category === 'SKY') viSky = item.fcstValue;
          if (item.category === 'PTY') viPty = item.fcstValue;
        }
      });

      // Strategy: Use VilageFcst (Short-term) for Day 0, 1, 2, 3 (High precision)
      // Use Mid (Mid-term) for Day 4 and onwards, or if Vilage data is incomplete
      const hasVilageTemps = viHigh !== -100 && viLow !== 100;
      if (viFound && i < 4 && hasVilageTemps) {
        curHigh = viHigh;
        curLow = viLow;
        curCond = mapKMAtoCondKey(viSky, viPty);
      } else {
        // Mid-term data fallback
        const idx = i; 
        const taMax = midTaData[`taMax${idx}`];
        const taMin = midTaData[`taMin${idx}`];
        
        curHigh = taMax !== undefined ? taMax : Math.round(highLimit - (i * 0.8));
        curLow = taMin !== undefined ? taMin : Math.round(lowLimit - (i * 0.8));
        
        const status = midLandData[`wf${idx}Pm`] || midLandData[`wf${idx}`] || '';
        if (status.includes('비')) curCond = 'rainy';
        else if (status.includes('눈')) curCond = 'snow';
        else if (status.includes('소나기')) curCond = 'moderate_rain';
        else if (status.includes('구름많음')) curCond = 'partly_cloudy';
        else if (status.includes('흐림')) curCond = 'cloudy';
        else curCond = 'sunny';
      }
      dailyForecast.push({ day: dayLabel, high: `${Math.round(curHigh)}°`, low: `${Math.round(curLow)}°`, condition: curCond });
    }

    return {
      source: 'KOREA METEOROLOGICAL ADMINISTRATION',
      temp: `${liveWeather.temp || Math.round(highLimit)}°`,
      highTemp: `${Math.round(highLimit)}°`,
      lowTemp: `${Math.round(lowLimit)}°`,
      humidity: `${liveWeather.humidity || '50'}%`,
      condKey: mapKMAtoCondKey(liveWeather.sky, liveWeather.pty),
      dailyForecast,
      hourlyForecast,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('KMA API Error Details:', error);
    return null;
  }
};
