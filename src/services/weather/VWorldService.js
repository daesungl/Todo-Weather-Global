import axios from 'axios';

// 보안을 위해 환경 변수(.env)에서 키를 불러옵니다.
const VWORLD_API_KEY = process.env.EXPO_PUBLIC_VWORLD_API_KEY || '';

/**
 * VWorld Service
 * Used for Reverse Geocoding and determining if location is in Korea
 */
export const checkIsKorea = async (lat, lon) => {
  try {
    // VWorld Reverse Geocoding API
    const response = await axios.get('https://api.vworld.kr/req/address', {
      params: {
        service: 'address',
        request: 'getAddress',
        version: '2.0',
        crs: 'epsg:4326',
        point: `${lon},${lat}`,
        format: 'json',
        type: 'both',
        key: VWORLD_API_KEY,
      },
    });

    if (response.data?.response?.status === 'OK') {
      const result = response.data.response.result[0];
      const structure = result.structure;
      return { 
        isKorea: true, 
        address: result.text,
        region: structure?.level1 || '',
        city: structure?.level2 || '',
        district: structure?.level3 || '',
        street: structure?.level4L || '',
      };
    }
    return { isKorea: false };
  } catch (error) {
    console.error('VWorld API Error:', error);
    // Logic: In case of error (e.g. out of Korea), we return false to trigger fallback
    return { isKorea: false };
  }
};

/**
 * 키워드로 국내 장소 및 주소를 검색합니다. (VWorld Search API)
 */
export const searchPlaces = async (query) => {
  if (!query || query.length < 2) return [];

  try {
    const response = await axios.get('https://api.vworld.kr/req/search', {
      params: {
        service: 'search',
        request: 'search',
        version: '2.0',
        crs: 'epsg:4326',
        size: '10',
        page: '1',
        query: query,
        type: 'place', // 장소 위주 검색
        format: 'json',
        errorformat: 'json',
        key: VWORLD_API_KEY,
      },
    });

    if (response.data?.response?.status === 'OK') {
      const items = response.data.response.result.items || [];
      return items.map(item => ({
        id: item.id || Date.now().toString() + Math.random(),
        name: item.title,
        address: item.address.parcel || item.address.road,
        lat: parseFloat(item.point.y),
        lon: parseFloat(item.point.x),
        type: 'domestic'
      }));
    }
    return [];
  } catch (error) {
    console.error('VWorld Search API Error:', error);
    return [];
  }
};
