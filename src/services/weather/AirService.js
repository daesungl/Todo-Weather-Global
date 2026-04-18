import axios from 'axios';

const AIR_KOREA_SERVICE_KEY = decodeURIComponent('7tVKsVRy1O3q85q7nMJA7BpHLKZ38NzZN8BMdMtHWhTrIhkoGQJZ%2Flz2X4NNVQ%2Bxygo%2FDFCLk8eHRE9JmB7j0g%3D%3D');
const VWORLD_API_KEY = '81A27DF2-32B9-33CA-91A3-A3FAF5F6A2CC';

/**
 * Air Quality Service (Integration with AirKorea)
 * Strategy: WGS84 lat/lon → TM(epsg:5181) via VWorld → Nearest Station → AirKorea
 */

// 1. Convert WGS84 (lat/lon) to TM Coordinate (epsg:5181) directly via VWorld
export const getTMCoord = async (lat, lon) => {
  try {
    const url = 'https://api.vworld.kr/req/data';
    const response = await axios.get(url, {
      params: {
        service: 'data',
        request: 'getFeature',
        data: 'LT_C_ADEMD_INFO',
        key: VWORLD_API_KEY,
        domain: '',
        attrFilter: '',
        format: 'json',
        size: 1,
        page: 1,
        geometry: false,
        attribute: true,
        crs: 'EPSG:4326',
        geomFilter: `POINT(${lon} ${lat})`
      }
    });

    // VWorld data API may not give TM coords — use coordinate transform instead
    // Try the coordinate transform approach
    const transformUrl = 'https://api.vworld.kr/req/address';
    const transformRes = await axios.get(transformUrl, {
      params: {
        service: 'address',
        request: 'getAddress',
        version: '2.0',
        crs: 'epsg:4326',
        point: `${lon},${lat}`,
        format: 'json',
        type: 'both',
        key: VWORLD_API_KEY,
      }
    });

    if (transformRes.data?.response?.status === 'OK') {
      // We have the address — now use lat/lon with proj4 math to get TM
      // TM (Korean 5181) conversion from WGS84 using formula
      const tmCoord = wgs84ToTm(lat, lon);
      return tmCoord;
    }

    // Fallback: Always use direct math conversion
    const tmCoord = wgs84ToTm(lat, lon);
    return tmCoord;
  } catch (error) {
    // Always fallback to math conversion
    const tmCoord = wgs84ToTm(lat, lon);
    return tmCoord;
  }
};

/**
 * WGS84 → Korean TM (EPSG:5181) coordinate conversion
 * Based on standard Transverse Mercator projection for Korea
 */
const wgs84ToTm = (lat, lon) => {
  const d2r = Math.PI / 180;
  const a = 6378137.0; // GRS80 semi-major axis
  const f = 1 / 298.257222101;
  const b = a * (1 - f);
  const e2 = (a * a - b * b) / (a * a);
  const e = Math.sqrt(e2);

  // Korean TM parameters (epsg:5181)
  const lat0 = 38 * d2r;
  const lon0 = 127 * d2r;
  const k0 = 1.0;
  const dx = 200000;
  const dy = 500000;

  const latR = lat * d2r;
  const lonR = lon * d2r;

  const N = a / Math.sqrt(1 - e2 * Math.sin(latR) * Math.sin(latR));
  const T = Math.tan(latR) * Math.tan(latR);
  const C = (e2 / (1 - e2)) * Math.cos(latR) * Math.cos(latR);
  const A = Math.cos(latR) * (lonR - lon0);

  const e4 = e2 * e2;
  const e6 = e4 * e2;
  const M = a * (
    (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * latR
    - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * latR)
    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * latR)
    - (35 * e6 / 3072) * Math.sin(6 * latR)
  );

  const M0 = a * (
    (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * lat0
    - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * lat0)
    + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * lat0)
    - (35 * e6 / 3072) * Math.sin(6 * lat0)
  );

  const x = k0 * N * (A + (1 - T + C) * A * A * A / 6
    + (5 - 18 * T + T * T + 72 * C - 58 * (e2 / (1 - e2))) * A * A * A * A * A / 120) + dx;

  const y = k0 * (M - M0 + N * Math.tan(latR) * (A * A / 2
    + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24
    + (61 - 58 * T + T * T + 600 * C - 330 * (e2 / (1 - e2))) * A * A * A * A * A * A / 720)) + dy;

  return { x: Math.round(x), y: Math.round(y) };
};

// 2. Find Nearest Measuring Station via AirKorea
export const getNearestStation = async (tmX, tmY) => {
  try {
    const url = 'https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList';
    const response = await axios.get(url, {
      params: {
        serviceKey: AIR_KOREA_SERVICE_KEY,
        returnType: 'json',
        tmX,
        tmY,
        ver: '1.0'
      }
    });

    const items = response.data?.response?.body?.items || [];
    if (items.length > 0) {
      return items[0].stationName;
    }
    return null;
  } catch (error) {
    return null;
  }
};

// 3. Map numeric grade to readable text and design tokens
const mapGradeToInfo = (grade) => {
  const g = parseInt(grade);
  if (g === 1) return { label: '좋음', color: '#34C759', text: '공기 질이 매우 깨끗합니다.', index: 0.15 };
  if (g === 2) return { label: '보통', color: '#FFCC00', text: '공기가 평범한 수준입니다.', index: 0.4 };
  if (g === 3) return { label: '나쁨', color: '#FF9500', text: '공기가 다소 탁합니다. 마스크를 권장합니다.', index: 0.7 };
  if (g === 4) return { label: '매우나쁨', color: '#FF3B30', text: '공기 질이 매우 좋지 않습니다. 외출을 자제하세요.', index: 0.9 };
  return { label: '보통', color: '#FFCC00', text: '데이터 확인 중...', index: 0.5 };
};

// 4. Pollutant grade standards (AirKorea)
const getPollutantGrade = (value, type) => {
  const v = parseFloat(value);
  if (isNaN(v)) return mapGradeToInfo(0);

  let grade = 1;
  switch(type) {
    case 'pm10':
      if (v <= 30) grade = 1; else if (v <= 80) grade = 2; else if (v <= 150) grade = 3; else grade = 4;
      break;
    case 'pm25':
      if (v <= 15) grade = 1; else if (v <= 35) grade = 2; else if (v <= 75) grade = 3; else grade = 4;
      break;
    case 'o3':
      if (v <= 0.03) grade = 1; else if (v <= 0.09) grade = 2; else if (v <= 0.15) grade = 3; else grade = 4;
      break;
    case 'no2':
      if (v <= 0.03) grade = 1; else if (v <= 0.06) grade = 2; else if (v <= 0.20) grade = 3; else grade = 4;
      break;
    case 'co':
      if (v <= 2) grade = 1; else if (v <= 9) grade = 2; else if (v <= 15) grade = 3; else grade = 4;
      break;
    case 'so2':
      if (v <= 0.02) grade = 1; else if (v <= 0.05) grade = 2; else if (v <= 0.15) grade = 3; else grade = 4;
      break;
  }
  return mapGradeToInfo(grade);
};

// 5. Get Real-time Air Quality Data
export const fetchAirQuality = async (stationName) => {
  try {
    const url = 'https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty';
    const response = await axios.get(url, {
      params: {
        serviceKey: AIR_KOREA_SERVICE_KEY,
        returnType: 'json',
        numOfRows: 1,
        pageNo: 1,
        stationName: stationName,
        dataTerm: 'DAILY',
        ver: '1.0'
      }
    });

    const data = response.data?.response?.body?.items?.[0];
    if (data) {
      const pm10Info = mapGradeToInfo(data.pm10Grade);
      const result = {
        aqiValue: data.khaiValue || '--',
        airQuality: pm10Info.label,
        aqiText: pm10Info.text,
        aqiColor: pm10Info.color,
        aqiIndex: pm10Info.index,
        pollutants: {
          pm10: { value: data.pm10Value, unit: 'μg/m³', ...getPollutantGrade(data.pm10Value, 'pm10') },
          pm25: { value: data.pm25Value, unit: 'μg/m³', ...getPollutantGrade(data.pm25Value, 'pm25') },
          o3:   { value: data.o3Value,   unit: 'ppm',   ...getPollutantGrade(data.o3Value,   'o3') },
          no2:  { value: data.no2Value,  unit: 'ppm',   ...getPollutantGrade(data.no2Value,  'no2') },
          co:   { value: data.coValue,   unit: 'ppm',   ...getPollutantGrade(data.coValue,   'co') },
          so2:  { value: data.so2Value,  unit: 'ppm',   ...getPollutantGrade(data.so2Value,  'so2') },
        }
      };
      return result;
    }
    return null;
  } catch (error) {
    return null;
  }
};

const AirService = {
  getTMCoord,
  getNearestStation,
  fetchAirQuality
};

export default AirService;
