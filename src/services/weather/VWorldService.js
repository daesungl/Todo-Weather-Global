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
