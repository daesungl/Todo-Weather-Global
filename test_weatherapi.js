const axios = require('axios');
require('dotenv').config();

const test = async () => {
    try {
        const res = await axios.get('https://api.weatherapi.com/v1/search.json', {
            params: {
                key: process.env.EXPO_PUBLIC_WEATHER_API_KEY,
                q: 'London'
            }
        });
        console.log(res.data[0]);
    } catch (e) { console.error(e) }
};
test();
