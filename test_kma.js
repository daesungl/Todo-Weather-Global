const axios = require('axios');
(async () => {
  const KMA_SERVICE_KEY = 'j0bE44B%2BM8n%2FFUXYfksOiooN3hBhhU%2FF36qPZl1Wz1TttqjZ9y64b73X9G6f2t%2BgC71iYdE49eQ%2Fw7E9vNnCig%3D%3D';
  const tmFc = '202604180600'; // Today's 6 AM
  try {
    const res = await axios.get(`http://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst?serviceKey=${KMA_SERVICE_KEY}&pageNo=1&numOfRows=10&dataType=JSON&regId=11B00000&tmFc=${tmFc}`);
    console.log(JSON.stringify(res.data.response.body.items.item[0], null, 2));
  } catch (e) {
    console.error(e.message);
  }
})();
