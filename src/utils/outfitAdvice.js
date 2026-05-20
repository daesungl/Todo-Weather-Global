const numberFrom = (value) => {
  if (typeof value === 'number') return value;
  const parsed = Number.parseFloat(String(value || '').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const percentFrom = (value) => {
  const parsed = Number.parseInt(String(value || '').replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getTimeLabelKey = (hour) => {
  if (hour < 12) return 'outfit.time_morning';
  if (hour < 17) return 'outfit.time_afternoon';
  if (hour < 21) return 'outfit.time_evening';
  return 'outfit.time_night';
};

const getForecastContext = (weather, useNextDay) => {
  const daily = useNextDay ? weather.dailyForecast?.[1] : weather.dailyForecast?.[0];
  const cond = String(
    useNextDay
      ? (daily?.condition || daily?.condKey || daily?.pmCond || daily?.amCond || weather.condKey || '')
      : (weather.condKey || '')
  ).toLowerCase();
  const highTemp = numberFrom((useNextDay ? daily?.high : weather.highTemp) ?? weather.highTemp ?? weather.dailyForecast?.[0]?.high);
  const lowTemp = numberFrom((useNextDay ? daily?.low : weather.lowTemp) ?? weather.lowTemp ?? weather.dailyForecast?.[0]?.low);
  const temp = useNextDay && highTemp != null && lowTemp != null
    ? Math.round((highTemp + lowTemp) / 2)
    : numberFrom(weather.feelsLike ?? weather.temp);
  const pop = useNextDay
    ? Math.max(percentFrom(daily?.amPop), percentFrom(daily?.pmPop))
    : Math.max(percentFrom(weather.hourlyForecast?.[0]?.pop), percentFrom(weather.dailyPop), percentFrom(weather.pop));

  return { cond, highTemp, lowTemp, temp, pop };
};

export const getOutfitAdvice = ({ weather }) => {
  if (!weather) return null;

  const now = new Date();
  const hour = now.getHours();
  const useNextDay = hour >= 20 && Array.isArray(weather.dailyForecast) && weather.dailyForecast.length > 1;
  const { cond, highTemp, lowTemp, temp, pop } = getForecastContext(weather, useNextDay);
  const actualTemp = numberFrom(weather.temp);
  const wind = numberFrom(weather.windSpeed);
  const uv = numberFrom(weather.uvIndex);

  const rainy = cond.includes('rain') || cond.includes('thunder') || pop >= 50;
  const snowy = cond.includes('snow');
  const windy = wind != null && wind >= 7;
  const hot = temp != null && temp >= 29;
  const warm = temp != null && temp >= 23 && temp < 29;
  const cool = temp != null && temp >= 10 && temp < 18;
  const cold = temp != null && temp < 10;
  const tempGap = highTemp != null && lowTemp != null ? Math.abs(highTemp - lowTemp) : 0;
  const bigTempGap = tempGap >= 10;
  const uvHigh = !useNextDay && uv != null && uv >= 6;
  const timeLabelKey = useNextDay ? 'outfit.time_tomorrow' : getTimeLabelKey(hour);
  const isEveningOrNight = !useNextDay && hour >= 17;

  let outfitKey = 'outfit.light_layers';
  if (snowy || cold) outfitKey = 'outfit.warm_layers';
  else if (cool || windy) outfitKey = 'outfit.light_outer';
  else if (hot) outfitKey = 'outfit.cool_breathable';
  else if (warm) outfitKey = 'outfit.light_comfort';

  const carryKeys = [];
  if (rainy) carryKeys.push('outfit.carry_umbrella');
  if (snowy) carryKeys.push('outfit.carry_non_slip');
  if (windy) carryKeys.push('outfit.carry_windbreaker');
  if (bigTempGap || isEveningOrNight || useNextDay) carryKeys.push('outfit.carry_extra_layer');
  if (uvHigh || hot) carryKeys.push('outfit.carry_sun');
  if (carryKeys.length === 0) carryKeys.push('outfit.carry_simple');

  let noteKey = 'outfit.note_default';
  if (snowy) noteKey = 'outfit.note_snow';
  else if (rainy) noteKey = 'outfit.note_rain';
  else if (bigTempGap) noteKey = 'outfit.note_temp_gap';
  else if (useNextDay) noteKey = 'outfit.note_next_day';
  else if (isEveningOrNight) noteKey = 'outfit.note_evening';
  else if (windy) noteKey = 'outfit.note_wind';

  return {
    mode: useNextDay ? 'next' : 'weather',
    timeLabelKey,
    temp: temp ?? actualTemp,
    outfitKey,
    carryKeys: [...new Set(carryKeys)].slice(0, 3),
    noteKey,
  };
};
