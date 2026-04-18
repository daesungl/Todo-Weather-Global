const axios = require('axios');
require('dotenv').config();

const test = async () => {
    try {
        const res = await axios.get('https://api.vworld.kr/req/search', {
            params: {
                service: 'search',
                request: 'search',
                version: '2.0',
                crs: 'epsg:4326',
                size: '10',
                page: '1',
                query: '역삼동 804', // Address query
                type: 'place,address,road', // testing multiple types
                format: 'json',
                errorformat: 'json',
                key: process.env.EXPO_PUBLIC_VWORLD_API_KEY
            }
        });
        console.log("Multi type:", res.data?.response?.status);
        if (res.data?.response?.status === 'OK') {
            console.log(res.data.response.result.items.length, "items found");
            console.log(res.data.response.result.items[0]);
        } else {
             console.log("Multi type failed.");
        }
    } catch (e) { console.error('error', e.response?.data || e.message) }
};
test();
