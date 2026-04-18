import axios from 'axios';

// API Keys from Environment
// decodeURIComponent 필요: env에 이미 인코딩된 값이 들어있어 axios params로 넘기면 이중인코딩 → 401
const SERVICE_KEY = decodeURIComponent(process.env.EXPO_PUBLIC_KMA_SERVICE_KEY || '');
const VWORLD_API_KEY = process.env.EXPO_PUBLIC_VWORLD_API_KEY || '';

// 5분 메모리 캐시: 같은 측정소 중복 호출 방지 (429 에러 절감)
const _cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5분

/**
 * 1. Convert Position to TM Coordinate (epsg:5181)
 */
export const getTMCoordinates = async (lat, lon, address = '') => {
  try {
    // Strategy A: 주소 기반 TM 좌표 변환 (가장 정확)
    if (address && address.trim()) {
      const response = await axios.get('https://api.vworld.kr/req/address', {
        params: {
          service: 'address',
          request: 'getcoord',
          version: '2.0',
          crs: 'epsg:5181',
          address: address,
          format: 'json',
          type: 'parcel',
          key: VWORLD_API_KEY,
        },
        timeout: 5000
      }).catch(() => null);

      if (response?.data?.response?.status === 'OK') {
        const point = response.data.response.result.point;
        console.log(`[AirService] TM via Address: x=${point.x}, y=${point.y}`);
        return { x: point.x, y: point.y };
      }
      console.warn('[AirService] Strategy A failed, trying math fallback');
    }

    // Strategy B: WGS84 → EPSG:5181 수학적 정밀 변환 (Transverse Mercator)
    const d2r = Math.PI / 180;
    const a = 6378137.0;
    const f = 1 / 298.257222101;
    const b = a * (1 - f);
    const e2 = (a * a - b * b) / (a * a);
    const lat0 = 38 * d2r, lon0 = 127 * d2r, k0 = 1.0, dx = 200000, dy = 500000;
    const latR = lat * d2r, lonR = lon * d2r;
    const N = a / Math.sqrt(1 - e2 * Math.sin(latR) ** 2);
    const T = Math.tan(latR) ** 2;
    const C = (e2 / (1 - e2)) * Math.cos(latR) ** 2;
    const A = Math.cos(latR) * (lonR - lon0);
    const e4 = e2 * e2, e6 = e4 * e2;
    const Mfn = (r) => a * (
      (1 - e2/4 - 3*e4/64 - 5*e6/256) * r
      - (3*e2/8 + 3*e4/32 + 45*e6/1024) * Math.sin(2*r)
      + (15*e4/256 + 45*e6/1024) * Math.sin(4*r)
      - (35*e6/3072) * Math.sin(6*r)
    );
    const M = Mfn(latR), M0 = Mfn(lat0);
    const x = Math.round(k0 * N * (A + (1-T+C)*A**3/6 + (5-18*T+T*T+72*C-58*(e2/(1-e2)))*A**5/120) + dx);
    const y = Math.round(k0 * (M - M0 + N*Math.tan(latR)*(A*A/2 + (5-T+9*C+4*C*C)*A**4/24 + (61-58*T+T*T+600*C-330*(e2/(1-e2)))*A**6/720)) + dy);
    console.log(`[AirService] TM via Math: x=${x}, y=${y} (lat=${lat}, lon=${lon})`);
    return { x, y };
  } catch (error) {
    console.error('[AirService] getTMCoordinates error:', error);
    return null;
  }
};

/**
 * 2. Find Nearest Measuring Station
 */
export const getNearestStation = async (tmX, tmY) => {
  if (!tmX || !tmY) return null;
  try {
    console.log(`[AirService] Searching station near TM(${tmX}, ${tmY})`);
    const response = await axios.get(`https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList`, {
      params: {
        serviceKey: SERVICE_KEY,
        returnType: 'json',
        tmX: tmX,
        tmY: tmY,
        ver: '1.1'
      },
      timeout: 5000
    });

    const items = response.data?.response?.body?.items;
    if (items && items.length > 0) {
      console.log(`[AirService] Station found: ${items[0].stationName} (${items[0].tm}km)`);
      return items[0];
    }
    console.warn('[AirService] No station found for TM coords');
    return null;
  } catch (error) {
    console.error('[AirService] getNearestStation error:', error?.response?.status, error?.message);
    return null;
  }
};

/**
 * 3. Grade Info Mapping
 */
const getGradeInfo = (grade) => {
  const g = parseInt(grade);
  if (g === 1) return { label: '좋음', color: '#34C759', text: '지금 공기는 매우 깨끗해요! 나들이 가기 딱 좋은 날입니다.', index: 0.15 };
  if (g === 2) return { label: '보통', color: '#FFCC00', text: '공기가 평범한 수준입니다. 일상적인 활동에 문제 없어요.', index: 0.4 };
  if (g === 3) return { label: '나쁨', color: '#FF9500', text: '공기가 탁합니다. 가급적 마스크를 착용하세요.', index: 0.7 };
  if (g === 4) return { label: '매우나쁨', color: '#FF3B30', text: '주의하세요! 공기가 매우 나쁩니다. 외출을 자제하세요.', index: 0.9 };
  return { label: '보통', color: '#FFCC00', text: '현재 대기 정보를 확인 중입니다.', index: 0.5 };
};

const getPollutantInfo = (value, type) => {
  const v = parseFloat(value);
  if (isNaN(v)) return { label: '보통', color: '#FFCC00' };
  let grade = 1;
  switch(type) {
    case 'pm10': if (v > 150) grade = 4; else if (v > 80) grade = 3; else if (v > 30) grade = 2; break;
    case 'pm25': if (v > 75) grade = 4; else if (v > 35) grade = 3; else if (v > 15) grade = 2; break;
    case 'o3': if (v > 0.15) grade = 4; else if (v > 0.09) grade = 3; else if (v > 0.03) grade = 2; break;
    case 'no2': if (v > 0.20) grade = 4; else if (v > 0.06) grade = 3; else if (v > 0.03) grade = 2; break;
    case 'co': if (v > 15) grade = 4; else if (v > 9) grade = 3; else if (v > 2) grade = 2; break;
    case 'so2': if (v > 0.15) grade = 4; else if (v > 0.05) grade = 3; else if (v > 0.02) grade = 2; break;
  }
  return getGradeInfo(grade);
};

/**
 * 4. Get Air Quality & Forecast
 */
export const fetchAirQuality = async (lat, lon, address = '') => {
  // 한국 좌표 범위 밖이면 즉시 종료 (해외 지역에 불필요한 API 호출 방지)
  const isDomesticCoord = lat >= 33 && lat <= 39 && lon >= 124 && lon <= 132;
  if (!isDomesticCoord) {
    console.log('[AirService] Skipping: overseas coordinates');
    return null;
  }

  // 5분 메모리 캐시 조회 (같은 좌표 중복 호출 방지)
  const cacheKey = `${lat.toFixed(4)}_${lon.toFixed(4)}`;
  const cached = _cache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
    console.log(`[AirService] Cache HIT for ${cacheKey} (station: ${cached.data?.stationName})`);
    return cached.data;
  }

  try {
    console.log(`[AirService] fetchAirQuality start: lat=${lat}, lon=${lon}, addr="${address}"`);
    const tm = await getTMCoordinates(lat, lon, address);
    if (!tm) { console.warn('[AirService] TM conversion failed, aborting'); return null; }

    const station = await getNearestStation(tm.x, tm.y);
    if (!station) { console.warn('[AirService] No station found, aborting'); return null; }

    console.log(`[AirService] Fetching realtime for station: ${station.stationName}`);
    const [realtimeRes, forecastRes] = await Promise.all([
      axios.get('https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty', {
        params: { serviceKey: SERVICE_KEY, returnType: 'json', stationName: station.stationName, dataTerm: 'DAILY', ver: '1.3', numOfRows: 1 },
        timeout: 8000
      }).catch(e => {
        console.error('[AirService] Realtime API error:', e?.response?.status, e?.message);
        if (e.response?.status === 429) return { _error: '429' };
        return null;
      }),
      axios.get('https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMinuDustFrcstDspth', {
        params: { serviceKey: SERVICE_KEY, returnType: 'json', searchDate: new Date().toISOString().split('T')[0], informCode: 'PM10' },
        timeout: 5000
      }).catch(() => null)
    ]);

    if (realtimeRes?._error === '429') return { error: 'LIMIT_HIT', stationName: station.stationName };

    const data = realtimeRes?.data?.response?.body?.items?.[0];
    if (!data) { console.warn('[AirService] No realtime data returned'); return null; }

    // 에어코리아 API는 미측정 시 '-' 문자열을 반환함 → 정상 파싱 필요
    const safeGrade = (val) => {
      const n = parseInt(val);
      return isNaN(n) || n <= 0 ? null : n; // '-', null, '0' 모두 null 처리
    };
    const safeVal = (val) => (!val || val === '-' || val === 'NaN') ? '--' : val;

    const khaiGradeNum = safeGrade(data.khaiGrade);
    const baseInfo = getGradeInfo(khaiGradeNum || 2); // null이면 보통(2) 기본값

    console.log(`[AirService] Raw data - khaiGrade=${data.khaiGrade}, khaiValue=${data.khaiValue}, pm10=${data.pm10Value}, pm25=${data.pm25Value}`);

    const forecast = forecastRes?.data?.response?.body?.items?.[0];

    const result = {
      aqiValue: safeVal(data.khaiValue),
      airQuality: khaiGradeNum ? baseInfo.label : '--',
      aqiText: khaiGradeNum ? baseInfo.text : '측정 데이터가 없거나 준비 중입니다.',
      aqiColor: baseInfo.color,
      aqiIndex: baseInfo.index,
      stationName: station.stationName,
      aqiForecast: forecast ? forecast.informOverall : null,
      pollutants: {
        pm10: { value: safeVal(data.pm10Value), unit: 'μg/m³', ...getPollutantInfo(data.pm10Value, 'pm10') },
        pm25: { value: safeVal(data.pm25Value), unit: 'μg/m³', ...getPollutantInfo(data.pm25Value, 'pm25') },
        o3:   { value: safeVal(data.o3Value),   unit: 'ppm',   ...getPollutantInfo(data.o3Value,   'o3') },
        no2:  { value: safeVal(data.no2Value),  unit: 'ppm',   ...getPollutantInfo(data.no2Value,  'no2') },
        co:   { value: safeVal(data.coValue),   unit: 'ppm',   ...getPollutantInfo(data.coValue,   'co') },
        so2:  { value: safeVal(data.so2Value),  unit: 'ppm',   ...getPollutantInfo(data.so2Value,  'so2') },
      }
    };

    // 결과를 메모리 캐시에 저장 (5분간 중복 호출 방지)
    _cache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  } catch (error) {
    return null;
  }
};

const AirService = {
  fetchAirQuality,
  getTMCoordinates,
  getNearestStation
};

export default AirService;
