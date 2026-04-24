import axios from 'axios';
import { dfs_xy_conv } from './KMAUtils';
import TempRegionCode from './data/Temp_RegionCityCode.json';
import SkyRegionCode from './data/Sky_RegionCityCode.json';
import SummaryRegionCode from './data/Summary_RegionCode.json';
import WeatherWarnStationCode from './data/WeatherWarnStationCode.json';
import { fetchAirQuality } from './AirService';

// 보안을 위해 환경 변수(.env)에서 키를 불러옵니다.
const KMA_SERVICE_KEY = decodeURIComponent(process.env.EXPO_PUBLIC_KMA_SERVICE_KEY || '');

const pad = (n) => n.toString().padStart(2, '0');

const getKSTDate = (date = new Date()) => {
  // Convert standard epoch time directly into a +9h shifted Date object
  // Using getUTC* functions on this object guarantees perfect KST mapping
  return new Date(date.getTime() + 9 * 60 * 60 * 1000);
};

const getKSTDateString = (date = new Date()) => {
  const kst = getKSTDate(date);
  const year = kst.getUTCFullYear();
  const month = pad(kst.getUTCMonth() + 1);
  const day = pad(kst.getUTCDate());
  return `${year}${month}${day}`;
};

export const fetchKMAWarning = async (region, city) => {
  try {
    let stnId = 108; // 전국 기본
    const locationStr = `${region} ${city}`;

    // 더 정교한 지점 매칭
    const matched = WeatherWarnStationCode.find(d => locationStr.includes(d.Region));
    if (matched) stnId = matched.Code;

    const fromDate = getKSTDateString(new Date());

    const url = 'https://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrInfo';
    const params = { serviceKey: KMA_SERVICE_KEY, pageNo: '1', numOfRows: '10', dataType: 'JSON', stnId, fromTmFc: fromDate };

    const response = await axios.get(url, { params, timeout: 5000 }); // 5초 타임아웃
    const rawItems = response?.data?.response?.body?.items?.item;

    const itemsArray = Array.isArray(rawItems) ? rawItems : (rawItems ? [rawItems] : []);
    if (itemsArray.length === 0) return null;
    // 특보 현황이 포함된 항목 우선, 없으면 첫 번째 항목
    const item = itemsArray.find(i => i.t1?.includes('특보 현황')) ?? itemsArray[0];

    if (!item?.t1) return null;

    // 데이터 정제: STN-ID 제거, 중복 줄바꿈 처리 등
    let cleanedText = item.t1
      //   .replace(/STN-ID: \d+/g, '')
      .replace(/\\n/g, '\n')
      //  .replace(/\n\n+/g, '\n')
      .trim();

    console.log('[KMAService] Warning Date:', item.tmFc); //charles test log

    return {
      text: cleanedText,
      region: matched ? matched.Region : region,
      tmFc: item.tmFc
    };
  } catch (error) {
    console.warn('[KMAService] Alert Fetch Failed:', error.message);
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

const mapKMAtoCondKey = (sky, pty, isDay = true) => {
  if (pty && pty !== '0') {
    if (pty === '1' || pty === '5') return 'light_rain';
    if (pty === '2' || pty === '6') return 'rainy';
    if (pty === '3' || pty === '7') return 'snow';
    if (pty === '4') return 'moderate_rain';
    return 'rainy';
  }
  if (sky === '1') return isDay ? 'sunny' : 'clear_night';
  if (sky === '3') return isDay ? 'partly_cloudy' : 'mostly_clear_night';
  if (sky === '4') return 'cloudy';
  return isDay ? 'sunny' : 'clear_night';
};

const findMidRegionCodes = (addressObj) => {
  const fullName = addressObj.address || '';
  const region = addressObj.region || '';
  const city = addressObj.city || '';
  let taCode = TempRegionCode.find(d => (fullName.includes(d.Region1) && (fullName.includes(d.City) || fullName.includes(d.Region2) || fullName.includes(d.Region3))))?.Code;
  if (!taCode) { taCode = TempRegionCode.find(d => fullName.includes(d.City))?.Code || '11B10101'; }
  let landCode = SkyRegionCode.find(d => region.includes(d.Region) && city.includes(d.City))?.Code;
  if (!landCode) { landCode = SkyRegionCode.find(d => fullName.includes(d.Region))?.Code || '11B00000'; }

  // 전망 구역 코드 (stnId)
  let stnId = SummaryRegionCode.find(d => region.includes(d.Region))?.Code || '108';

  console.log(`[KMA] region="${region}" city="${city}" → landCode=${landCode} taCode=${taCode} stnId=${stnId}`);
  return { taCode, landCode, stnId };
};

// Safe helper to extract item array from complex KMA responses
const safeGetItemArray = (res) => {
  const items = res?.data?.response?.body?.items;
  if (!items) return [];
  if (Array.isArray(items.item)) return items.item;
  if (items.item) return [items.item]; // Handle single item object
  return [];
};

export const fetchKMAWeather = async (lat, lon, addressObj = {}) => {
  try {
    const { x, y } = dfs_xy_conv('toXY', lat, lon);
    const ncstTime = getNcstBaseTime();
    const ultraTime = getUltraBaseTime();
    const vilageTime = getVilageBaseTime();
    const midTime = getMidBaseTime();
    const { taCode, landCode, stnId } = findMidRegionCodes(addressObj);

    const baseUrl = 'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0';
    const midUrl = 'https://apis.data.go.kr/1360000/MidFcstInfoService';
    // Use raw key in URL to prevent Axios double encoding issues
    const serviceKey = process.env.EXPO_PUBLIC_KMA_SERVICE_KEY || '';

    const [ncstRes, ultraRes, vilageRes, midLandRes, midTaRes, midFcstRes] = await Promise.all([
      axios.get(`${baseUrl}/getUltraSrtNcst?serviceKey=${serviceKey}`, {
        params: { pageNo: 1, numOfRows: 10, dataType: 'JSON', base_date: ncstTime.baseDate, base_time: ncstTime.baseTime, nx: x, ny: y },
        timeout: 5000
      }).catch(() => null),
      axios.get(`${baseUrl}/getUltraSrtFcst?serviceKey=${serviceKey}`, {
        params: { pageNo: 1, numOfRows: 60, dataType: 'JSON', base_date: ultraTime.baseDate, base_time: ultraTime.baseTime, nx: x, ny: y },
        timeout: 5000
      }).catch(() => null),
      axios.get(`${baseUrl}/getVilageFcst?serviceKey=${serviceKey}`, {
        params: { pageNo: 1, numOfRows: 1000, dataType: 'JSON', base_date: vilageTime.baseDate, base_time: vilageTime.baseTime, nx: x, ny: y },
        timeout: 5000
      }).catch(() => null),
      axios.get(`${midUrl}/getMidLandFcst?serviceKey=${serviceKey}`, {
        params: { pageNo: 1, numOfRows: 10, dataType: 'JSON', regId: landCode, tmFc: midTime.baseDate + midTime.baseTime },
        timeout: 5000
      }).catch(() => null),
      axios.get(`${midUrl}/getMidTa?serviceKey=${serviceKey}`, {
        params: { pageNo: 1, numOfRows: 10, dataType: 'JSON', regId: taCode, tmFc: midTime.baseDate + midTime.baseTime },
        timeout: 5000
      }).catch(() => null),
      axios.get(`${midUrl}/getMidFcst?serviceKey=${serviceKey}`, {
        params: { pageNo: 1, numOfRows: 10, dataType: 'JSON', stnId: stnId, tmFc: midTime.baseDate + midTime.baseTime },
        timeout: 5000
      }).catch(() => null)
    ]);

    const liveItems = safeGetItemArray(ncstRes);
    const ultraItems = safeGetItemArray(ultraRes);
    const forecastItems = safeGetItemArray(vilageRes);

    if (liveItems.length === 0 && forecastItems.length === 0) return null;

    const midLandData = safeGetItemArray(midLandRes)?.[0] || {};
    const midTaData = safeGetItemArray(midTaRes)?.[0] || {};
    const midFcstData = safeGetItemArray(midFcstRes)?.[0] || {};
    const wfSv = midFcstData.wfSv || '';

    const liveWeather = {};
    liveItems.forEach(item => {
      if (item.category === 'T1H') liveWeather.temp = item.obsrValue;
      if (item.category === 'REH') liveWeather.humidity = item.obsrValue;
      if (item.category === 'PTY') liveWeather.pty = item.obsrValue;
      if (item.category === 'WSD') liveWeather.wsd = item.obsrValue;
    });

    ultraItems.forEach(item => {
      if (item.category === 'SKY' && !liveWeather.sky) liveWeather.sky = item.fcstValue;
      if (item.category === 'PTY' && (!liveWeather.pty || liveWeather.pty === '0')) liveWeather.pty = item.fcstValue;
    });

    const hourlyMap = {};
    // 1. Base: Village Forecast (Updated every 3 hours)
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
      if (item.category === 'PCP') hourlyMap[key].pcp = item.fcstValue;
    });

    // 2. Override: Ultra-Short-Term Forecast (Updated every hour, highly accurate for next 6h)
    ultraItems.forEach(item => {
      const key = `${item.fcstDate}${item.fcstTime}`;
      if (!hourlyMap[key]) return; // Forecast items are primary timeline
      if (item.category === 'T1H') hourlyMap[key].temp = item.fcstValue; // Use temp from ultra
      if (item.category === 'RN1') hourlyMap[key].pcp = item.fcstValue; // Use 1h precipitation from ultra
      if (item.category === 'SKY') hourlyMap[key].sky = item.fcstValue;
      if (item.category === 'PTY') hourlyMap[key].pty = item.fcstValue;
      if (item.category === 'WSD') hourlyMap[key].wind = item.fcstValue;
      if (item.category === 'REH') hourlyMap[key].hum = item.fcstValue;
      if (item.category === 'VEC') hourlyMap[key].windDeg = item.fcstValue;
    });

    const nowRaw = new Date();
    const nowKST = getKSTDate(nowRaw);
    const nowTimeKey = `${getKSTDateString(nowRaw)}${pad(nowKST.getUTCHours())}00`;

    const hourlyForecast = Object.values(hourlyMap)
      .filter(h => `${h.date}${h.time}` >= nowTimeKey)
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
      .slice(0, 120)
      .map(h => {
        const hour = parseInt(h.time.slice(0, 2));
        const hourLabel = hour === 0 ? '0시' : (hour === 12 ? '12시' : `${hour}시`);
        let pcpVal = h.pcp;
        if (!pcpVal || pcpVal === '강수없음' || pcpVal === '0') pcpVal = '0mm';
        else if (pcpVal === '1mm 미만') pcpVal = '~1mm';
        else if (!pcpVal.includes('mm') && !isNaN(pcpVal)) pcpVal = `${pcpVal}mm`;

        const isHourDay = hour >= 6 && hour < 18;
        return {
          time: hourLabel,
          temp: `${h.temp}°`,
          condKey: mapKMAtoCondKey(h.sky, h.pty, isHourDay),
          pop: `${h.pop}%`,
          pcp: pcpVal,
          wind: `${Math.round(h.wind)}m/s`,
          windDeg: (parseInt(h.windDeg) + 180) % 360,
          hum: `${h.hum}%`,
          fullTime: `${h.date}${h.time}`,
          isDay: isHourDay
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

    const midBaseYear = parseInt(midTime.baseDate.substring(0, 4));
    const midBaseMonth = parseInt(midTime.baseDate.substring(4, 6)) - 1;
    const midBaseDay = parseInt(midTime.baseDate.substring(6, 8));
    const midBaseDateObj = new Date(Date.UTC(midBaseYear, midBaseMonth, midBaseDay));

    const getWorstPty = (cur, newVal) => {
      if (newVal !== '0' && cur === '0') return newVal;
      if (newVal === '3' || newVal === '7') return newVal;
      return cur;
    };

    const safeMapKMA = (sky, pty) => {
      if (pty && pty !== '0') {
        if (pty === '1' || pty === '4' || pty === '5') return 'rainy';
        if (pty === '2' || pty === '6') return 'snow_rain';
        if (pty === '3' || pty === '7') return 'snow';
      }
      const s = parseInt(sky);
      if (s <= 1) return 'sunny';
      if (s <= 3) return 'partly_cloudy';
      return 'cloudy';
    };

    const getMidCond = (status) => {
      if (!status) return 'sunny';
      if (status.includes('비')) return 'rainy';
      if (status.includes('눈')) return 'snow';
      if (status.includes('소나기')) return 'moderate_rain';
      if (status.includes('구름많음')) return 'partly_cloudy';
      if (status.includes('흐림')) return 'cloudy';
      return 'sunny';
    };

    const getMidIdx = (dayOffset) => {
      const kstNow = getKSTDate(now);
      const todayUTC = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()));
      const targetUTC = new Date(todayUTC.getTime() + dayOffset * 24 * 60 * 60 * 1000);
      const diffDays = Math.round((targetUTC.getTime() - midBaseDateObj.getTime()) / (24 * 60 * 60 * 1000));
      return diffDays;
    };

    console.log(`[KMA-Debug] MidBaseDate: ${midBaseDateObj.toISOString().split('T')[0]}, Now: ${getKSTDate(now).toISOString()}`);

    for (let i = 0; i < 10; i++) {
      const targetDate = new Date(now.getTime() + (i * 24 * 60 * 60 * 1000));
      const kstTarget = getKSTDate(targetDate);
      const dStr = getKSTDateString(targetDate);
      const dayLabel = i === 0 ? '오늘' : (i === 1 ? '내일' : weekdays[kstTarget.getUTCDay()]);

      let amPop = '0', pmPop = '0';
      let amCond = 'sunny', pmCond = 'sunny';
      let highTemp = highLimit, lowTemp = lowLimit;

      if (i < 3) {
        let dayHigh = -100, dayLow = 100;
        let ptyAm = '0', ptyPm = '0';
        let skyAm = '1', skyPm = '1';
        let amPopMax = 0, pmPopMax = 0;
        let hasData = false;
        forecastItems.forEach(item => {
          if (item.fcstDate === dStr) {
            hasData = true;
            const val = parseFloat(item.fcstValue);
            if (item.category === 'TMP' || item.category === 'TMX' || item.category === 'TMN') {
              if (val > dayHigh) dayHigh = val;
              if (val < dayLow) dayLow = val;
            }
            const h = parseInt(item.fcstTime.slice(0, 2));
            if (h < 12) {
              if (item.category === 'PTY') ptyAm = getWorstPty(ptyAm, item.fcstValue);
              if (item.category === 'SKY') skyAm = Math.max(parseInt(skyAm), parseInt(item.fcstValue)).toString();
              if (item.category === 'POP') amPopMax = Math.max(amPopMax, parseInt(item.fcstValue));
            } else {
              if (item.category === 'PTY') ptyPm = getWorstPty(ptyPm, item.fcstValue);
              if (item.category === 'SKY') skyPm = Math.max(parseInt(skyPm), parseInt(item.fcstValue)).toString();
              if (item.category === 'POP') pmPopMax = Math.max(pmPopMax, parseInt(item.fcstValue));
            }
          }
        });
        if (hasData) {
          highTemp = dayHigh !== -100 ? dayHigh : highLimit;
          lowTemp = dayLow !== 100 ? dayLow : lowLimit;
          amPop = amPopMax.toString();
          pmPop = pmPopMax.toString();
          amCond = safeMapKMA(skyAm, ptyAm);
          pmCond = safeMapKMA(skyPm, ptyPm);
        } else {
          const idx = getMidIdx(i);
          amPop = String(midLandData[`rnSt${idx}Am`] ?? midLandData[`rnSt${idx}`] ?? '0');
          pmPop = String(midLandData[`rnSt${idx}Pm`] ?? midLandData[`rnSt${idx}`] ?? '0');
          amCond = getMidCond(midLandData[`wf${idx}Am`] ?? midLandData[`wf${idx}`]);
          pmCond = getMidCond(midLandData[`wf${idx}Pm`] ?? midLandData[`wf${idx}`]);
        }
      } else {
        const idx = getMidIdx(i);
        const taMax = midTaData[`taMax${idx}`];
        const taMin = midTaData[`taMin${idx}`];
        highTemp = taMax !== undefined ? taMax : Math.round(highLimit - (i * 0.5));
        lowTemp = taMin !== undefined ? taMin : Math.round(lowLimit - (i * 0.5));
        if (idx >= 3 && idx <= 7) {
          amPop = String(midLandData[`rnSt${idx}Am`] ?? '0');
          pmPop = String(midLandData[`rnSt${idx}Pm`] ?? '0');
          amCond = getMidCond(midLandData[`wf${idx}Am`]);
          pmCond = getMidCond(midLandData[`wf${idx}Pm`]);
        } else if (idx >= 8 && idx <= 10) {
          const pop = String(midLandData[`rnSt${idx}`] ?? '0');
          const wf = midLandData[`wf${idx}`];
          amPop = pmPop = pop;
          amCond = pmCond = getMidCond(wf);
        }
      }

      const mm = String(kstTarget.getUTCMonth() + 1).padStart(2, '0');
      const dd = String(kstTarget.getUTCDate()).padStart(2, '0');
      const dateStr = `${mm}.${dd}`;

      console.log(`[KMA-Forecast] D+${i} (${dayLabel}): H=${highTemp}, L=${lowTemp}, idx=${i < 3 ? 'ShortTerm' : getMidIdx(i)}`);
      dailyForecast.push({
        day: dayLabel,
        date: dateStr,
        high: Math.round(highTemp),
        low: Math.round(lowTemp),
        amPop: `${amPop}%`,
        pmPop: `${pmPop}%`,
        amCond,
        pmCond,
        condition: pmCond
      });
    }

    console.log(`[KMA] Success! Returning accurate weather data for ${addressObj.address || 'Korea'}`);

    return {
      source: 'KOREA METEOROLOGICAL ADMINISTRATION & AIR KOREA',
      temp: `${liveWeather.temp || Math.round(highLimit)}°`,
      highTemp: `${Math.round(highLimit)}°`,
      lowTemp: `${Math.round(lowLimit)}°`,
      humidity: `${liveWeather.humidity || '--'}%`,
      feelsLike: liveWeather.temp ? `${Math.round(liveWeather.temp)}°` : '--°',
      condKey: mapKMAtoCondKey(liveWeather.sky, liveWeather.pty, nowKST.getUTCHours() >= 6 && nowKST.getUTCHours() < 18),
      dailyForecast,
      hourlyForecast,
      wfSv: wfSv,
      airQuality: '--',
      aqiValue: '--',
      aqiText: '대기질 정보를 업데이트 중입니다.',
      stationName: '',
      aqiForecast: '',
      aqiColor: '#bdbdbd',
      aqiIndex: 0,
      pollutants: null,
      isDay: nowKST.getUTCHours() >= 6 && nowKST.getUTCHours() < 18,
      tzOffsetMs: 9 * 60 * 60 * 1000, // KST = UTC+9 고정
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('KMA API Error Details:', error);
    return null;
  }
};

/**
 * 대기질 등급별 행동 가이드를 반환합니다.
 */
const getActionGuide = (grade) => {
  const g = parseInt(grade);
  if (g <= 1) return '쾌적한 공기입니다. 야외 활동에 아주 좋습니다.';
  if (g <= 2) return '전반적으로 괜찮으나, 민감군은 실외 활동 시 유의하세요.';
  if (g <= 3) return '공기가 탁합니다. 장시간 야외 활동은 자제하는 것이 좋습니다.';
  if (g <= 4) return '매우 해로운 수준입니다. 긴급한 용무 외엔 반드시 실내에 머무르세요.';
  return '실시간 대기질 정보를 업데이트 중입니다.';
};

const getGradeLevel = (val, type) => {
  const v = parseFloat(val);
  if (isNaN(v)) return 2;
  if (type === 'khai') return Math.max(1, Math.min(4, Math.round(v)));
  if (type === 'pm10') { if (v <= 30) return 1; if (v <= 80) return 2; if (v <= 150) return 3; return 4; }
  if (type === 'pm25') { if (v <= 15) return 1; if (v <= 35) return 2; if (v <= 75) return 3; return 4; }
  if (type === 'o3') { if (v <= 0.03) return 1; if (v <= 0.09) return 2; if (v <= 0.15) return 3; return 4; }
  if (type === 'no2') { if (v <= 0.03) return 1; if (v <= 0.06) return 2; if (v <= 0.2) return 3; return 4; }
  if (type === 'co') { if (v <= 2) return 1; if (v <= 9) return 2; if (v <= 15) return 3; return 4; }
  if (type === 'so2') { if (v <= 0.02) return 1; if (v <= 0.05) return 2; if (v <= 0.15) return 3; return 4; }
  return 2;
};

const getGradeText = (val, type) => {
  const level = getGradeLevel(val, type);
  return ['-', '좋음', '보통', '나쁨', '매우나쁨'][level] || '보통';
};

const getGradeColor = (grade) => {
  const g = parseInt(grade);
  if (g <= 1) return '#4CAF50';
  if (g <= 2) return '#FFC107';
  if (g <= 3) return '#FF9800';
  return '#F44336';
};
