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
      timeout: 4000
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

  const searchVWorld = async (searchType, category = null) => {
    try {
      const params = {
        service: 'search',
        request: 'search',
        version: '2.0',
        crs: 'epsg:4326',
        size: '10', 
        page: '1',
        query: query,
        type: searchType, 
        format: 'json',
        errorformat: 'json',
        key: VWORLD_API_KEY,
      };
      if (category) params.category = category;

      const response = await axios.get('https://api.vworld.kr/req/search', { params, timeout: 5000 });
      if (response.data?.response?.status === 'OK') {
        return response.data.response.result.items || [];
      }
      return [];
    } catch (error) {
      return [];
    }
  };

  // 주소에서 마지막 3단어만 추출 (Todo Weather 스타일)
  const formatNickName = (fullTitle) => {
    const words = fullTitle.trim().split(' ');
    if (words.length > 3) {
      return words.slice(-3).join(' ');
    }
    return fullTitle;
  };

  try {
    const [places, parcels, roads] = await Promise.all([
      searchVWorld('place'),
      searchVWorld('address', 'parcel'),
      searchVWorld('address', 'road')
    ]);

    const formatResult = (items, categoryKey, searchSubType = 'place') => items.map(item => {
      const roadAddr = item.address?.road || '';
      const parcelAddr = item.address?.parcel || '';
      const title = item.title || '';
      
      // 닉네임 결정: 
      // 1. 도로명 검색이면 도로명 주소 우선
      // 2. 지번 검색이면 지번 주소 우선
      // 3. 둘 다 없으면 title 사용
      let displayName = '';
      if (searchSubType === 'road') displayName = roadAddr || title;
      else if (searchSubType === 'parcel') displayName = parcelAddr || title;
      else displayName = title;

      return {
        id: `${categoryKey}-${searchSubType}-${item.id || Math.random().toString(36).substr(2, 9)}`,
        name: `[KR] ${formatNickName(displayName)}`,
        address: parcelAddr || roadAddr || title, // 하단 서브 텍스트는 지번 우선 (KMA 연동용)
        lat: parseFloat(item.point?.y || 0),
        lon: parseFloat(item.point?.x || 0),
        type: 'domestic',
        category: categoryKey 
      };
    }).filter(item => item.lat !== 0 && item.lon !== 0);

    const allResults = [
      ...formatResult(places, 'search.place', 'place'),
      ...formatResult(parcels, 'search.address', 'parcel'),
      ...formatResult(roads, 'search.address', 'road')
    ];

    // 최종 중복 제거 (ID 기준)
    const uniqueMap = new Map();
    allResults.forEach(item => {
      if (!uniqueMap.has(item.id)) {
        uniqueMap.set(item.id, item);
      }
    });

    return Array.from(uniqueMap.values());
  } catch (error) {
    console.error('Unified Domestic Search Error:', error);
    return [];
  }
};
