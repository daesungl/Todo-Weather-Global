import axios from 'axios';

const AIR_KOREA_SERVICE_KEY = decodeURIComponent('7tVKsVRy1O3q85q7nMJA7BpHLKZ38NzZN8BMdMtHWhTrIhkoGQJZ%2Flz2X4NNVQ%2Bxygo%2FDFCLk8eHRE9JmB7j0g%3D%3D');
const VWORLD_API_KEY = '81A27DF2-32B9-33CA-91A3-A3FAF5F6A2CC';

/**
 * Air Quality Service (Integration with AirKorea)
 */

// 1. Convert Address to TM Coordinate (epsg:5181) via VWorld
export const getTMCoord = async (address) => {
  try {
    const url = 'https://api.vworld.kr/req/address';
    const response = await axios.get(url, {
      params: {
        service: 'address',
        request: 'getcoord',
        version: '2.0',
        refine: true,
        simple: false,
        format: 'json',
        type: 'both',
        address: address,
        crs: 'epsg:5181', // TM Coord used by AirKorea
        key: VWORLD_API_KEY
      }
    });

    if (response.data?.response?.status === 'OK') {
      const { x, y } = response.data.response.result.point;
      return { x, y };
    }
    return null;
  } catch (error) {
    console.error('getTMCoord Error:', error);
    return null;
  }
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
      return items[0].stationName; // Get the closest station
    }
    return null;
  } catch (error) {
    console.error('getNearestStation Error:', error);
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

// 4. Get Real-time Air Quality Data
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
      return {
        aqiValue: data.khaiValue || '--',
        airQuality: pm10Info.label,
        aqiText: pm10Info.text,
        aqiColor: pm10Info.color,
        aqiIndex: pm10Info.index, // Position for the gauge pointer [0, 1]
        pm10: data.pm10Value,
        pm25: data.pm25Value,
        no2: data.no2Value,
        o3: data.o3Value,
        co: data.coValue,
        so2: data.so2Value
      };
    }
    return null;
  } catch (error) {
    console.error('fetchAirQuality Error:', error);
    return null;
  }
};

const AirService = {
  getTMCoord,
  getNearestStation,
  fetchAirQuality
};

export default AirService;
