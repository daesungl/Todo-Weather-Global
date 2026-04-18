const axios = require('axios');
const KMA_SERVICE_KEY = "7tVKsVRy1O3q85q7nMJA7BpHLKZ38NzZN8BMdMtHWhTrIhkoGQJZ%2Flz2X4NNVQ%2Bxygo%2FDFCLk8eHRE9JmB7j0g%3D%3D";

// 제주 지역
const landCode = '11G00000';
const taCode = '11G00201';

const getKMABaseTime = (availableHours, minOffset) => {
  const kst = new Date(new Date().getTime() + (9 * 60 * 60 * 1000));
  const currentHour = kst.getUTCHours();
  const currentMinute = kst.getUTCMinutes();
  const currentTotalMins = currentHour * 60 + currentMinute;
  
  let targetHour = availableHours[0];
  let targetDate = new Date(kst);

  // Find the most recent available hour considering the offset
  for (let i = availableHours.length - 1; i >= 0; i--) {
    const requiredMins = availableHours[i] * 60 + minOffset;
    if (currentTotalMins >= requiredMins) {
      targetHour = availableHours[i];
      break;
    }
    if (i === 0) {
      targetHour = availableHours[availableHours.length - 1];
      targetDate = new Date(kst.getTime() - 24 * 60 * 60 * 1000); // Back one day
    }
  }

  const baseDate = `${targetDate.getUTCFullYear()}${String(targetDate.getUTCMonth() + 1).padStart(2, '0')}${String(targetDate.getUTCDate()).padStart(2, '0')}`;
  const baseTime = `${String(targetHour).padStart(2, '0')}00`;
  
  return { baseDate, baseTime };
};

const getMidBaseTime = () => getKMABaseTime([6, 18], 0);

async function run() {
  const midTime = getMidBaseTime();
  console.log('midTime:', midTime);
  const midRes = await axios.get('http://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst', {
        params: { serviceKey: KMA_SERVICE_KEY, pageNo: 1, numOfRows: 10, dataType: 'JSON', regId: landCode, tmFc: midTime.baseDate + midTime.baseTime }
  }).catch(e => { console.log(e.message); return null;});

  const midTaRes = await axios.get('http://apis.data.go.kr/1360000/MidFcstInfoService/getMidTa', {
        params: { serviceKey: KMA_SERVICE_KEY, pageNo: 1, numOfRows: 10, dataType: 'JSON', regId: taCode, tmFc: midTime.baseDate + midTime.baseTime }
  }).catch(e => { console.log(e.message); return null;});

  console.log('MidLand:', midRes?.data?.response?.body?.items?.item[0]);
  console.log('MidTa:', midTaRes?.data?.response?.body?.items?.item[0]);

  // vilage fcst
  const vilageTime = getKMABaseTime([2, 5, 8, 11, 14, 17, 20, 23], 15);
  // 제주 x: 52 y: 38 (approx)
  console.log('vilageTime:', vilageTime);
  const vilRes = await axios.get('http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst', {
        params: { serviceKey: KMA_SERVICE_KEY, pageNo: 1, numOfRows: 1000, dataType: 'JSON', base_date: vilageTime.baseDate, base_time: vilageTime.baseTime, nx: 52, ny: 38 }
  }).catch(e => { console.log(e.message); return null;});

  const items = vilRes?.data?.response?.body?.items?.item || [];
  console.log(`Vilage items count: ${items.length}`);
  
  const dStr = "20260419"; // tomorrow
  const tmrs = items.filter(i => i.fcstDate === dStr && i.category === 'POP');
  console.log('Tomorrow POPs:');
  tmrs.forEach(i => console.log(`  ${i.fcstTime}: ${i.fcstValue}%`));
}
run();
