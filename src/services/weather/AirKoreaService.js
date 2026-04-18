import axios from 'axios';

// 공공데이터포털(에어코리아) API 키
const SERVICE_KEY = process.env.EXPO_PUBLIC_KMA_SERVICE_KEY || '';
const VWORLD_API_KEY = process.env.EXPO_PUBLIC_VWORLD_API_KEY || '';

/**
 * 1. 주소를 TM 좌표(EPSG:5181)로 변환합니다.
 */
/**
 * 1. 주소를 TM 좌표(EPSG:5181)로 변환합니다. (VWorld Address API)
 */
export const getTMFromAddress = async (address) => {
  if (!address) {
    console.warn('[AirKorea] No address provided for TM conversion');
    return null;
  }
  
  try {
    const response = await axios.get('http://api.vworld.kr/req/address', {
      params: {
        service: 'address',
        request: 'getcoord',
        version: '2.0',
        crs: 'epsg:5181',
        address: address,
        format: 'json',
        type: 'parcel', // 'both' is invalid here, must be 'parcel' or 'road'
        key: VWORLD_API_KEY,
      },
    }).catch(async () => {
       // Fallback to https and try 'road' type if parcel fails
       return await axios.get('https://api.vworld.kr/req/address', {
         params: { service: 'address', request: 'getcoord', version: '2.0', crs: 'epsg:5181', address: address, format: 'json', type: 'road', key: VWORLD_API_KEY }
       });
    });

    if (response.data?.response?.status === 'OK') {
      const point = response.data.response.result.point;
      return { x: point.x, y: point.y };
    } else if (response.data?.response?.status === 'NOT_FOUND') {
      const roadResponse = await axios.get('http://api.vworld.kr/req/address', {
        params: { service: 'address', request: 'getcoord', version: '2.0', crs: 'epsg:5181', address: address, format: 'json', type: 'road', key: VWORLD_API_KEY }
      });
      if (roadResponse.data?.response?.status === 'OK') {
        const point = roadResponse.data.response.result.point;
        return { x: point.x, y: point.y };
      }
      return null;
    }
    return null;
  } catch (error) {
    return null;
  }
};

/**
 * 2. TM 좌표를 기준으로 가장 가까운 측정소를 찾습니다.
 */
export const getNearestStation = async (tmX, tmY) => {
  try {
    const serviceKey = process.env.EXPO_PUBLIC_KMA_SERVICE_KEY || '';
    const response = await axios.get(`https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getNearbyMsrstnList?serviceKey=${serviceKey}`, {
      params: {
        returnType: 'json',
        tmX: tmX,
        tmY: tmY,
        ver: '1.1'
      }
    });

    if (response.data?.response?.body?.items?.length > 0) {
      const station = response.data.response.body.items[0];
      console.log(`[AirKorea] Nearest Station Found: ${station.stationName} (${station.addr})`);
      return station;
    }
    console.warn(`[AirKorea] No Near Stations Found for coords: x=${tmX}, y=${tmY}`);
    return null;
  } catch (error) {
    console.error('[AirKorea] Station Find Error:', error);
    return null;
  }
};

/**
 * 3. 측정소 이름을 기준으로 실시간 대기질 정보를 가져옵니다.
 */
export const getRealtimeAirQuality = async (stationName) => {
  try {
    const serviceKey = process.env.EXPO_PUBLIC_KMA_SERVICE_KEY || '';
    const response = await axios.get(`https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMsrstnAcctoRltmMesureDnsty?serviceKey=${serviceKey}`, {
      params: {
        returnType: 'json',
        numOfRows: '1',
        pageNo: '1',
        stationName: stationName,
        dataTerm: 'DAILY',
        ver: '1.3'
      }
    });

    const result = response.data?.response?.body?.items?.[0];
    if (result) {
      console.log(`[AirKorea] Real-time Data for ${stationName}: PM10=${result.pm10Value}, Khai=${result.khaiValue}`);
      return {
        pm10: result.pm10Value !== '-' ? result.pm10Value : '--',
        pm25: result.pm25Value !== '-' ? result.pm25Value : '--',
        o3: result.o3Value !== '-' ? result.o3Value : '--',
        no2: result.no2Value !== '-' ? result.no2Value : '--',
        co: result.coValue !== '-' ? result.coValue : '--',
        so2: result.so2Value !== '-' ? result.so2Value : '--',
        khaiGrade: result.khaiGrade !== '-' ? result.khaiGrade : '2',
        khaiValue: result.khaiValue !== '-' ? result.khaiValue : '--',
        dataTime: result.dataTime,
        stationName: stationName
      };
    }
    return null;
  } catch (error) {
    console.error('[AirKorea] Air Quality Error:', error);
    return null;
  }
};

/**
 * 4. 미세먼지 예보 정보를 가져옵니다. (국립환경과학원 브리핑)
 */
export const getAirQualityForecast = async () => {
  try {
    const serviceKey = process.env.EXPO_PUBLIC_KMA_SERVICE_KEY || '';
    const today = new Date().toISOString().split('T')[0];
    const response = await axios.get(`https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getMinuDustFrcstDspth?serviceKey=${serviceKey}`, {
      params: {
        returnType: 'json',
        numOfRows: '1',
        pageNo: '1',
        searchDate: today,
        informCode: 'PM10'
      }
    });

    const items = response.data?.response?.body?.items;
    if (items && items.length > 0) {
      return {
        overall: items[0].informOverall, // 전체 예보 브리핑
        cause: items[0].informCause      // 발생 원인
      };
    }
    return null;
  } catch (error) {
    console.error('[AirKorea] Forecast Fetch Error:', error);
    return null;
  }
};

/**
 * 종합 실행 함수: 위경도 또는 주소로부터 가장 정확한 대기질 정보를 가져옵니다.
 */
export const fetchAccurateAirQuality = async (lat, lon, address) => {
  console.log(`[AirKorea] Polling for: ${address || (lat + ',' + lon)}`);
  
  // 1. 주소 -> TM 좌표 획득
  const coords = await getTMFromAddress(address);
  if (!coords) return null;

  // 2. 측정소 찾기
  const station = await getNearestStation(coords.x, coords.y);
  if (!station) return null;

  // 3. 실시간 데이터 및 4. 예보 데이터 병합
  const [realtime, forecast] = await Promise.all([
    getRealtimeAirQuality(station.stationName),
    getAirQualityForecast()
  ]);

  return {
    ...realtime,
    forecast: forecast
  };
};
