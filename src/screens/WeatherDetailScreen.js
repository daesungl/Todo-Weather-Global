import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Animated, Easing, InteractionManager, PanResponder } from 'react-native';
import {
  ChevronLeft, Sun, Moon, Cloud, CloudRain, Wind, Droplets,
  SunMedium, AlertTriangle, Calendar, Navigation,
  Eye, Thermometer, Gauge, Activity, CloudLightning,
  Info, Umbrella, X, CloudSnow, RefreshCw
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, Typography } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import AirService from '../services/weather/AirService';
import { fetchExtraMetrics } from '../services/weather/GlobalService';
import { saveCache } from '../services/StorageService';

const { width, height } = Dimensions.get('window');

// 특보 발표 시각 포맷터 (YYYY.MM.DD hh:mm AM/PM)
const formatAlertTime = (tmFc) => {
  if (!tmFc) return null;
  const s = String(tmFc);
  let date;

  if (s.length === 12) { // KMA: YYYYMMDDHHMM
    date = new Date(`${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:00`);
  } else { // Global: ISO or String
    date = new Date(s);
  }

  if (isNaN(date.getTime())) return s;

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  let hh = date.getHours();
  const min = String(date.getMinutes()).padStart(2, '0');
  const ampm = hh >= 12 ? 'PM' : 'AM';
  hh = hh % 12 || 12;
  const hhStr = String(hh).padStart(2, '0');

  return `${yyyy}.${mm}.${dd} ${hhStr}:${min} ${ampm}`;
};

const WeatherDetailScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { weatherData: initialData = {} } = route?.params || {};

  const defaultData = {
    locationName: '--',
    addressName: '--',
    temp: '--°',
    highTemp: '--°',
    lowTemp: '--°',
    condKey: 'sunny',
    conditionText: '--',
    humidity: '--%',
    windSpeed: '--',
    windDir: '--',
    airQuality: '--',
    aqiValue: '--',
    aqiText: '데이터를 불러오는 중입니다...',
    visibility: '--',
    feelsLike: '--°',
    pressure: '--',
    uvIndex: '--',
    sunrise: '--',
    sunset: '--',
    source: 'KOREA METEOROLOGICAL ADMINISTRATION'
  };

  const [weatherData, setWeatherData] = useState({ ...defaultData, ...initialData });
  const hasAccurateAQInit = !!initialData?.pollutants &&
    initialData?.aqiValue !== '--' &&
    initialData?.aqiText !== '실시간 대기질 정보를 업데이트 중입니다.';
  const [loadingAir, setLoadingAir] = useState(!hasAccurateAQInit);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  // Pulse animation for loading skeleton
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.9,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Helper to calculate sun position on the arc
  const getSunPosition = () => {
    const timeToMinutes = (timeStr) => {
      if (!timeStr || timeStr === '--:--' || timeStr === '--') return null;
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return null;
      let [_, h, m, ampm] = match;
      let hours = parseInt(h);
      let minutes = parseInt(m);
      if (ampm.toUpperCase() === 'PM' && hours < 12) hours += 12;
      if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };

    const sunriseMins = timeToMinutes(weatherData.sunrise);
    const sunsetMins = timeToMinutes(weatherData.sunset);

    // Get current time
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();

    if (sunriseMins === null || sunsetMins === null) return null;

    let progress = (nowMins - sunriseMins) / (sunsetMins - sunriseMins);
    progress = Math.max(0, Math.min(1, progress));

    const angle = Math.PI - (progress * Math.PI);
    const radius = 60;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);

    return {
      left: 60 + x - 6,
      bottom: y - 6
    };
  };

  const sunPos = getSunPosition();

  useEffect(() => {
    const lat = initialData?.lat;
    const lon = initialData?.lon;

    const interaction = InteractionManager.runAfterInteractions(() => {
      // aqiValue가 실제로 유효한 값(숫자 또는 문자)인지 확인 - undefined와 '--' 모두 누락으로 처리
      const aqiOk = initialData?.aqiValue !== undefined &&
        initialData?.aqiValue !== '--' &&
        initialData?.aqiValue !== null &&
        String(initialData?.aqiValue).trim() !== '';
      const hasAccurateAQ = aqiOk && (!!initialData?.pollutants || !!initialData?.stationName);
      const needsExtra = !initialData?.uvIndex || initialData?.uvIndex === '--';

      console.log(`[Detail] hasAccurateAQ=${hasAccurateAQ}, stationName=${initialData?.stationName}, aqiValue=${initialData?.aqiValue}`);

      if (!hasAccurateAQ && lat && lon) {
        loadAsyncData(lat, lon, needsExtra);
      } else {
        setLoadingAir(false);
      }
    });

    return () => interaction.cancel();
  }, [initialData?.lat, initialData?.lon]);

  const loadAsyncData = async (lat, lon, needsExtra) => {
    try {
      // fetchExtraMetrics for things KMA might not have (UV, Visibility etc if missing)
      const extra = needsExtra ? await fetchExtraMetrics(lat, lon).catch(() => null) : null;

      // Minimum loading time for "演出" (visual effect)
      const minDelay = new Promise(resolve => setTimeout(resolve, 1200));

      // AirQuality re-fetch
      let airData = null;
      const isDomestic = lat > 32 && lat < 39 && lon > 124 && lon < 132;
      const address = initialData.locationName || '';

      if (isDomestic) {
        try {
          console.log(`[${address}] 대기질 데이터 ( AirKorea ) 조회 중`);
          const result = await AirService.fetchAirQuality(lat, lon, address);

          if (result && result.error === 'LIMIT_HIT') {
            console.warn(`[${address}] 대기질 데이터 ( AirKorea ) 조회 실패 (에러코드: 429 - Limit Hit)`);
            // 429 Limit Hit: Try Global Fallback immediately
            const fallback = extra || await fetchExtraMetrics(lat, lon).catch(() => null);
            if (fallback && fallback.aqiSource === 'WeatherAPI') {
              console.log(`[${address}] 대기질 데이터 ( weatherAPI ) 조회 완료 (Fallback)`);
              airData = fallback;
              airData.aqiText = `에어코리아 사용량 초과로 글로벌 데이터를 대신 표시합니다.`;
            } else {
              airData = {
                airQuality: '--',
                aqiValue: '--',
                aqiText: '에어코리아 사용량이 초과되었습니다. 잠시 후 서버가 안정되면 다시 시도해주세요.',
                aqiColor: Colors.outline,
                stationName: result.stationName || 'Limit Reached'
              };
            }
          } else if (result) {
            console.log(`[${address}] 대기질 데이터 ( AirKorea ) 조회 완료`);
            airData = result;
          }
        } catch (aqErr) {
          console.error(`[${address}] 대기질 데이터 ( AirKorea ) 조회 실패 (에러코드: ${aqErr.response?.status || aqErr.message})`);

          // Fallback to WeatherAPI data if domestic fetch fails drastically
          const fallback = extra || await fetchExtraMetrics(lat, lon).catch(() => null);
          if (fallback && fallback.aqiSource === 'WeatherAPI') {
            console.log(`[${address}] 대기질 데이터 ( weatherAPI ) 조회 완료 (Fallback)`);
            airData = fallback;
            airData.aqiText = `${fallback.aqiText} (에어코리아 통신 에러로 글로벌 소스를 제공합니다)`;
          }
        }
      }

      // Wait for both data and minimum delay
      await Promise.all([minDelay]);

      if (extra || airData) {
        let finalData = null;
        setWeatherData(prev => {
          const updated = {
            ...prev,
            ...(airData || {}),
            ...(extra || {}),
          };
          updated.stationName = airData?.stationName || (extra?.aqiSource === 'WeatherAPI' ? 'Global Source' : '');
          finalData = updated;
          return updated;
        });

        // Sync new accurate data back to cache
        const cacheKey = `weather_v6_${lat.toFixed(4)}_${lon.toFixed(4)}_${initialData?.regionId || ''}`;
        if (finalData) {
          await saveCache(cacheKey, finalData);
        }
      }
    } catch (err) {
      console.error('[Detail] Async load error:', err);
    } finally {
      setLoadingAir(false);
    }
  };

  const handleRefresh = () => {
    setLoadingAir(true);
    const lat = weatherData.lat;
    const lon = weatherData.lon;
    if (lat && lon) {
      loadAsyncData(lat, lon, true);
    }
  };

  useEffect(() => {
    if (alertModalVisible) {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 350,
        easing: Easing.out(Easing.back(0.5)),
        useNativeDriver: true,
      }).start();
    }
  }, [alertModalVisible]);

  const handleCloseAlert = () => {
    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 250,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      setAlertModalVisible(false);
    });
  };

  const goBack = () => navigation.goBack();
  
  // Real-time swipe tracking for premium UX
  const swipeX = useRef(new Animated.Value(0)).current;

  // Swipe to go back gesture logic with visual tracking
  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      const { dx, dy, x0 } = gestureState;
      // Accept gesture only if starting from the left edge
      return x0 < width * 0.15 && dx > 10 && Math.abs(dx) > Math.abs(dy);
    },
    onPanResponderMove: (_, gestureState) => {
      // Prevent swiping to the left
      if (gestureState.dx > 0) {
        swipeX.setValue(gestureState.dx);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      // If swiped more than 30% of width, complete the navigation
      if (gestureState.dx > width * 0.3) {
        Animated.timing(swipeX, {
          toValue: width,
          duration: 200,
          useNativeDriver: true,
        }).start(() => goBack());
      } else {
        // Otherwise spring back to center
        Animated.spring(swipeX, {
          toValue: 0,
          useNativeDriver: true,
          friction: 8,
          tension: 40
        }).start();
      }
    }
  }), [navigation]);

  const renderHourlyIcon = (condKey, isDay = true) => {
    const size = 20;
    const isNight = isDay === false || condKey === 'clear-night';
    const moonColor = "#A1C9FF"; // 푸르스름한 달빛 색상

    switch (condKey) {
      case 'rainy':
      case 'rain':
      case 'light_rain':
      case 'moderate_rain':
        return <CloudRain size={size} color="#64b5f6" />;
      case 'snowy':
      case 'snow':
        return <CloudSnow size={size} color="#90caf9" />;
      case 'cloudy':
      case 'overcast':
        return <Cloud size={size} color="#90a4ae" />;
      case 'partly_cloudy':
      case 'mostly_sunny':
      case 'mostly_clear':
      case 'clear-night':
        return (
          <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            {!isNight ? (
              <Sun size={size * 0.8} color="#FFD700" strokeWidth={2.5} />
            ) : (
              <Moon size={size * 0.75} color={moonColor} fill={moonColor} strokeWidth={2.2} />
            )}
            <Cloud size={size * 0.9} color="#CFD8DC" strokeWidth={1.8} style={{ position: 'absolute', bottom: -6, right: -8 }} />
          </View>
        );
      case 'sunny':
      case 'clear':
        return !isNight ? (
          <Sun size={size} color="#FFD700" strokeWidth={2.5} />
        ) : (
          <Moon size={size} color={moonColor} fill={moonColor} strokeWidth={2.2} />
        );
      default:
        return !isNight ? (
          <Sun size={size} color="#FFD700" strokeWidth={2.5} />
        ) : (
          <Moon size={size} color={moonColor} fill={moonColor} strokeWidth={2.2} />
        );
    }
  };

  const [currentHourlyDay, setCurrentHourlyDay] = useState('오늘');

  const hourlyForecast = useMemo(() => {
    if (weatherData.hourlyForecast && weatherData.hourlyForecast.length > 0) {
      // Use nowKey provided by service (especially for Global source which adds it in destination's local time)
      // Otherwise fallback to system time (KST) for KMA or old cache
      let nowKey = weatherData.nowKey;
      
      if (!nowKey) {
        const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
        const y = nowKST.getUTCFullYear();
        const mo = String(nowKST.getUTCMonth() + 1).padStart(2, '0');
        const d = String(nowKST.getUTCDate()).padStart(2, '0');
        const h = String(nowKST.getUTCHours()).padStart(2, '0');
        nowKey = `${y}${mo}${d}${h}00`; // e.g. "202604182100"
      }

      let dayOffset = 0;
      const getDayLabel = (offset) => {
        if (offset === 0) return '오늘';
        if (offset === 1) return '내일';
        if (offset === 2) return '모레';
        return `${offset}일 후`;
      };

      // fullTime 필드 기준으로 현재 시간 이후 데이터만 필터링
      const filtered = weatherData.hourlyForecast.filter(h => {
        const ft = h.fullTime || '';
        return ft >= nowKey;
      });

      // fullTime이 없는 데이터 (구형 캐시)는 필터 없이 통과
      const source = filtered.length > 0 ? filtered : weatherData.hourlyForecast;

      return source.map((h, idx) => {
        if (idx > 0 && (h.time === '0시' || h.time === 'Midnight')) {
          dayOffset++;
        }
        return {
          ...h,
          time: idx === 0 ? '지금' : h.time,
          icon: renderHourlyIcon(h.condKey || h.condition, h.isDay),
          dayLabel: getDayLabel(dayOffset)
        };
      });
    }
    return [{ time: '지금', temp: '24°', icon: <Sun size={20} color={Colors.primary} />, pop: '10%', wind: '2m/s', windDeg: 135, hum: '45%' }];
  }, [weatherData]);

  const dailyForecast = useMemo(() => {
    if (weatherData.dailyForecast && Array.isArray(weatherData.dailyForecast) && weatherData.dailyForecast.length > 0) {
      return weatherData.dailyForecast.map((item, idx) => {
        let dayLabel = item.day;
        if (dayLabel === 'Today') dayLabel = '오늘';
        else if (dayLabel === 'Tomorrow') dayLabel = '내일';
        else {
          const engToKor = { 'Sun': '일요일', 'Mon': '월요일', 'Tue': '화요일', 'Wed': '수요일', 'Thu': '목요일', 'Fri': '금요일', 'Sat': '토요일' };
          dayLabel = engToKor[item.day] || item.day;
        }

        // Calculate Date String (MM.DD)
        const date = new Date();
        date.setDate(date.getDate() + idx);
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const dateStr = `${mm}.${dd}`;

        return {
          day: dayLabel,
          date: dateStr,
          high: parseInt(item.high),
          low: parseInt(item.low),
          amCond: item.amCond || item.condition,
          amPop: item.amPop || '0%',
          pmCond: item.pmCond || item.condition,
          pmPop: item.pmPop || '0%'
        };
      });
    }

    // Fallback Mock Data Generation
    const days = [];
    const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
    const now = new Date();

    for (let i = 0; i < 10; i++) {
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + i);

      let dayLabel = '';
      if (i === 0) dayLabel = '오늘';
      else if (i === 1) dayLabel = '내일';
      else dayLabel = weekdays[targetDate.getDay()];

      const mm = String(targetDate.getMonth() + 1).padStart(2, '0');
      const dd = String(targetDate.getDate()).padStart(2, '0');
      const dateStr = `${mm}.${dd}`;

      const baseHigh = parseInt(weatherData.highTemp) || 24;
      const baseLow = parseInt(weatherData.lowTemp) || 16;
      const variation = Math.sin(i * 0.5) * 3;

      days.push({
        day: dayLabel,
        date: dateStr,
        high: Math.round(baseHigh + variation),
        low: Math.round(baseLow + variation - (Math.random() * 2)),
        amCond: i % 3 === 2 ? 'light_rain' : 'mostly_sunny',
        amPop: i % 3 === 2 ? '60%' : '10%',
        pmCond: i % 4 === 3 ? 'cloudy' : 'mostly_sunny',
        pmPop: i % 4 === 3 ? '40%' : '0%'
      });
    }
    return days;
  }, [weatherData]);

  const { globalMin, globalMax } = useMemo(() => {
    let min = 100, max = -100;
    dailyForecast.forEach(d => {
      if (d.low < min) min = d.low;
      if (d.high > max) max = d.high;
    });
    return { globalMin: (min || 0) - 2, globalMax: (max || 40) + 2 };
  }, [dailyForecast]);

  const TempRangeBar = ({ low, high }) => {
    const totalRange = globalMax - globalMin;
    const startPos = ((low - globalMin) / totalRange) * 100;
    const endPos = ((high - globalMin) / totalRange) * 100;
    const barWidth = Math.max(2, endPos - startPos);

    return (
      <View style={styles.rangeBarBg}>
        <LinearGradient
          colors={['#7ad0ff', '#00bfff']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.rangeBarActive, { left: `${startPos}%`, width: `${barWidth}%` }]}
        />
      </View>
    );
  };

  const renderWeatherIcon = (condKey, size = 80, strokeWidth = 2, customStyle = null, forceDay = false) => {
    const style = customStyle || styles.heroIconTop;
    const isDay = forceDay ? true : (weatherData.isDay !== undefined ? weatherData.isDay : true);
    const moonColor = "#A1C9FF"; // 푸르스름한 달빛 색상

    switch (condKey) {
      case 'rainy':
      case 'rain':
      case 'light_rain':
      case 'moderate_rain':
        return <CloudRain size={size} color="#64b5f6" strokeWidth={strokeWidth} style={style} />;
      case 'snowy':
      case 'snow':
        return <CloudSnow size={size} color="#90caf9" strokeWidth={strokeWidth} style={style} />;
      case 'cloudy':
      case 'overcast':
        return <Cloud size={size} color="#90a4ae" strokeWidth={strokeWidth} style={style} />;
      case 'partly_cloudy':
      case 'mostly_sunny':
      case 'mostly_clear':
      case 'clear-night':
        return (
          <View style={[style, { width: size, height: size, justifyContent: 'center', alignItems: 'center' }]}>
            {isDay ? (
              <Sun size={size * 0.8} color="#FFD700" strokeWidth={strokeWidth} />
            ) : (
              <Moon size={size * 0.75} color={moonColor} fill={moonColor} strokeWidth={strokeWidth} />
            )}
            <Cloud size={size * 0.9} color="#CFD8DC" strokeWidth={strokeWidth} style={{ position: 'absolute', bottom: -size * 0.25, right: -size * 0.35 }} />
          </View>
        );
      case 'sunny':
      case 'clear':
        return isDay ? (
          <Sun size={size} color="#FFD700" strokeWidth={strokeWidth} style={style} />
        ) : (
          <Moon size={size} color={moonColor} fill={moonColor} strokeWidth={strokeWidth} style={style} />
        );
      default:
        return isDay ? (
          <Sun size={size} color="#FFD700" strokeWidth={strokeWidth} style={style} />
        ) : (
          <Moon size={size} color={moonColor} fill={moonColor} strokeWidth={strokeWidth} style={style} />
        );
    }
  };

  const SkeletonBlock = ({ width, height, borderRadius = 8, style = {} }) => (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: Colors.surfaceContainerHighest, opacity: pulseAnim },
        style
      ]}
    />
  );

  const isLoading = !initialData || (!initialData.temp && !initialData.locationName);

  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: Spacing.md }} />
        <Text style={{ fontSize: 16, color: Colors.textSecondary, fontWeight: '600' }}>
          {t('common.loading', '기상 정보를 불러오는 중입니다...')}
        </Text>
      </View>
    );
  }

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          transform: [{ translateX: swipeX }],
          // Add a subtle shadow on the left edge when swiping
          shadowColor: '#000',
          shadowOffset: { width: -10, height: 0 },
          shadowOpacity: 0.15,
          shadowRadius: 20,
          backgroundColor: '#E6F7FF', // Ensure background is solid during swipe
        }
      ]} 
      {...panResponder.panHandlers}
    >
      <View style={[styles.stickyHeader, { paddingTop: Constants.statusBarHeight }]}>
        <TouchableOpacity onPress={goBack} style={styles.iconBtn}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {route.params?.isCurrentLocation ? t('weather.current_location') : (route.params?.locationName || weatherData.locationName)}
          </Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {route.params?.isCurrentLocation ? weatherData.locationName : (route.params?.locationName ? weatherData.locationName : '')}
          </Text>
        </View>
        <View style={styles.iconBtnPlaceholder} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <LinearGradient colors={['#E6F7FF', '#effafd', '#f7f9ff']} style={styles.heroSection}>
          <View style={styles.heroMain}>
            {renderWeatherIcon(weatherData.condKey)}
            <Text style={styles.heroTemp}>{weatherData.temp}</Text>
            <Text style={styles.conditionSub}>{t(`weather.${weatherData.condKey || 'sunny'}`)}</Text>
            <View style={styles.heroHighLow}>
              <Text style={styles.heroHLText}>{`${t('common.high')} ${weatherData.highTemp}  |  ${t('common.low')} ${weatherData.lowTemp}`}</Text>
            </View>
          </View>
        </LinearGradient>

        {weatherData.alert && (
          <TouchableOpacity activeOpacity={0.8} onPress={() => setAlertModalVisible(true)} style={[styles.alertModule, { zIndex: 999 }]}>
            <LinearGradient colors={['#ba1a1a', '#93000a']} style={[styles.alertGradient, { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg }]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
              <Animated.View style={{ opacity: pulseAnim }}>
                <AlertTriangle size={20} color="white" />
              </Animated.View>
              <Text style={[styles.alertText, { flex: 1, fontWeight: '800', textAlign: 'center', fontSize: 13 }]} numberOfLines={1}>
                {`${t('weather.alert_present', '기상특보 발효 중')} ${typeof weatherData.alert === 'object' && weatherData.alert.region ? `(${weatherData.alert.region})` : ''}`}
              </Text>
              <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' }}>
                <Info size={12} color="white" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={styles.moduleCard}>
          <View style={styles.moduleHeader}>
            <Activity size={16} color={Colors.primary} />
            <Text style={styles.moduleTitle}>시간별 예보 {currentHourlyDay !== '오늘' ? `- ${currentHourlyDay}` : ''}</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -Spacing.md }} contentContainerStyle={[styles.hourlyList, { paddingHorizontal: Spacing.md }]}
            onScroll={(event) => {
              const scrollPos = event.nativeEvent.contentOffset.x;
              const activeIndex = Math.max(0, Math.floor((scrollPos + 60) / 88));
              if (hourlyForecast[activeIndex] && hourlyForecast[activeIndex].dayLabel !== currentHourlyDay) {
                setCurrentHourlyDay(hourlyForecast[activeIndex].dayLabel);
              }
            }}
          >
            {hourlyForecast.map((item, index) => {
              let dayBadge = null;
              if (item.time === '0시' || item.time === 'Midnight') dayBadge = item.dayLabel;
              let bgColor = Colors.surfaceContainerLow;
              if (item.dayLabel === '내일') bgColor = '#EDF7FF';
              else if (item.dayLabel === '모레') bgColor = '#F4EEFB';
              return (
                <View key={index} style={[styles.hourlyItem, { backgroundColor: bgColor }]}>
                  {dayBadge ? <View style={styles.dayBadge}><Text style={styles.dayBadgeText}>{dayBadge}</Text></View> : <Text style={styles.hourlyTime}>{item.time}</Text>}
                  <View style={styles.hourlyIcon}>{item.icon}</View>
                  <Text style={styles.hourlyTemp}>{item.temp}</Text>
                  <View style={styles.hourlyMeta}>
                    <View style={styles.metaRow}><Umbrella size={12} color={Colors.primary} /><Text style={styles.metaText}>{item.pop}</Text></View>
                    <View style={styles.metaRow}><Umbrella size={12} color={item.pcp !== '0mm' ? Colors.primary : Colors.textSecondary} /><Text style={[styles.metaText, { color: item.pcp !== '0mm' ? Colors.primary : Colors.textSecondary }]}>{item.pcp}</Text></View>
                    <View style={styles.metaRow}><View style={{ transform: [{ rotate: `${item.windDeg - 45}deg` }] }}><Navigation size={12} color={Colors.textSecondary} /></View><Text style={styles.metaText}>{item.wind}</Text></View>
                    <View style={styles.metaRow}><Droplets size={12} color={Colors.textSecondary} /><Text style={styles.metaText}>{item.hum}</Text></View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.moduleCard}>
          <View style={styles.moduleHeader}><Calendar size={16} color={Colors.primary} /><Text style={styles.moduleTitle}>10일 예보</Text></View>
          <View style={styles.dailyTableHead}><Text style={[styles.headTxt, { width: 50 }]}>날짜</Text><Text style={styles.headTxt}>오전</Text><Text style={styles.headTxt}>오후</Text><Text style={[styles.headTxt, { flex: 1, textAlign: 'center' }]}>온도 추이</Text></View>
          {dailyForecast.map((item, index) => (
            <View key={index} style={[styles.dailyRow, index === dailyForecast.length - 1 && { borderBottomWidth: 0 }]}>
              <View style={styles.dailyDayColumn}>
                <Text style={styles.dailyDay}>{item.day}</Text>
                <Text style={styles.dailyDate}>{item.date}</Text>
              </View>
              <View style={styles.dayHalf}>{renderWeatherIcon(item.amCond, 24, 2.5, {}, true)}<Text style={styles.popText}>{item.amPop}</Text></View>
              <View style={styles.dayHalf}>{renderWeatherIcon(item.pmCond, 24, 2.5, {}, true)}<Text style={styles.popText}>{item.pmPop}</Text></View>
              <View style={styles.rangeContainer}><Text style={styles.dailyLow}>{`${item.low}°`}</Text><TempRangeBar low={item.low} high={item.high} /><Text style={styles.dailyHigh}>{`${item.high}°`}</Text></View>
            </View>
          ))}
        </View>

        {weatherData.wfSv && (
          <View style={[styles.moduleCard, { backgroundColor: '#f0fbff' }]}>
            <View style={styles.moduleHeader}><Info size={16} color={Colors.primary} /><Text style={styles.moduleTitle}>기상 전망</Text></View>
            <View style={styles.summaryContainer}><Text style={styles.summaryText}>{weatherData.wfSv}</Text></View>
          </View>
        )}

        <View style={styles.metricsGrid}>
          <View style={styles.metricCardWide}>
            <View style={styles.metricHeader}><Wind size={14} color={Colors.textSecondary} /><Text style={styles.metricLabel}>대기 질</Text></View>
            <View style={styles.aqiContent}>
              <View style={styles.aqiValueContainer}>
                {loadingAir ? (
                  <SkeletonBlock width={100} height={28} borderRadius={14} style={{ marginRight: 8 }} />
                ) : (
                  <>
                    <Text style={styles.aqiValue}>{weatherData.aqiValue} - </Text>
                    <Text style={[styles.aqiLabel, { color: weatherData.aqiColor }]}>{weatherData.airQuality}</Text>
                  </>
                )}
                {!loadingAir && weatherData.stationName && (
                  <View style={styles.stationTag}>
                    <Text style={styles.stationTagName}>{weatherData.stationName}</Text>
                  </View>
                )}
              </View>
              {loadingAir ? (
                <SkeletonBlock width="100%" height={16} borderRadius={8} style={{ marginTop: 8 }} />
              ) : (
                <Text style={styles.aqiDesc}>{weatherData.aqiText}</Text>
              )}
              {!loadingAir && weatherData.aqiForecast ? (
                <View style={styles.aqiForecastBox}>
                  <Text style={styles.aqiForecastLabel}>공식 예보 브리핑</Text>
                  <Text style={styles.aqiForecastText}>{weatherData.aqiForecast}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.aqiBarContainer}><View style={styles.aqiFullBar} /><View style={[styles.aqiProgressMarker, { left: `${(weatherData.aqiIndex || 0.1) * 100}%`, backgroundColor: weatherData.aqiColor || Colors.primary }]} /></View>
            <View style={styles.pollutantGrid}>
              {loadingAir ? [1, 2, 3, 4, 5, 6].map(i => (
                <View key={i} style={styles.pollutantCard}>
                  <SkeletonBlock width={60} height={12} style={{ marginBottom: 8 }} />
                  <SkeletonBlock width={40} height={20} style={{ marginBottom: 4 }} />
                  <SkeletonBlock width="100%" height={16} borderRadius={4} />
                </View>
              )) :
                weatherData.pollutants && Object.entries(weatherData.pollutants).map(([key, data]) => (
                  <View key={key} style={styles.pollutantCard}>
                    <Text style={styles.pollutantName}>{
                      { pm10: 'PM10', pm25: 'PM2.5', o3: 'O₃', no2: 'NO₂', co: 'CO', so2: 'SO₂' }[key] || key.toUpperCase()
                    }</Text>
                    <View style={styles.pollutantValueRow}><Text style={styles.pollutantValue}>{data.value}</Text><Text style={styles.pollutantUnit}>{data.unit}</Text></View>
                    <View style={[styles.pollutantBadge, { backgroundColor: `${data.color}25` }]}><View style={[styles.pollutantDot, { backgroundColor: data.color }]} /><Text style={styles.pollutantStatus}>{data.label}</Text></View>
                  </View>
                ))
              }
            </View>
          </View>
          <View style={styles.metricCard}><View style={styles.metricHeader}><SunMedium size={14} color={Colors.textSecondary} /><Text style={styles.metricLabel}>자외선</Text></View><Text style={styles.metricValue}>{weatherData.uvIndex}</Text></View>
          <View style={styles.metricCard}><View style={styles.metricHeader}><Droplets size={14} color={Colors.textSecondary} /><Text style={styles.metricLabel}>전체 습도</Text></View><Text style={styles.metricValue}>{weatherData.humidity}</Text></View>
          <View style={styles.metricCard}><View style={styles.metricHeader}><Thermometer size={14} color={Colors.textSecondary} /><Text style={styles.metricLabel}>체감 온도</Text></View><Text style={styles.metricValue}>{weatherData.feelsLike}</Text></View>
          <View style={styles.metricCard}><View style={styles.metricHeader}><Eye size={14} color={Colors.textSecondary} /><Text style={styles.metricLabel}>가시거리</Text></View><Text style={styles.metricValue}>{weatherData.visibility}</Text></View>
        </View>

        <View style={styles.moduleCard}>
          <View style={styles.moduleHeader}><SunMedium size={16} color={Colors.primary} /><Text style={styles.moduleTitle}>일출 및 일몰</Text></View>
          <View style={styles.sunCycleRow}>
            <View style={styles.sunSide}><Text style={styles.sunLabel}>일출</Text><Text style={styles.sunTime}>{weatherData.sunrise}</Text></View>
            <View style={styles.sunGraphic}><View style={styles.sunHorizon} /><View style={styles.sunArc} />{sunPos && <View style={[styles.sunPoint, { left: sunPos.left, bottom: sunPos.bottom, backgroundColor: '#FFB800' }]}><View style={styles.sunGlow} /></View>}</View>
            <View style={styles.sunSide}><Text style={styles.sunLabel}>일몰</Text><Text style={styles.sunTime}>{weatherData.sunset}</Text></View>
          </View>
        </View>

        <View style={styles.attribution}><Text style={styles.attrLabel}>DATA PROVIDED BY</Text><Text style={styles.attrValue}>{weatherData.source}</Text></View>
      </ScrollView>

      {alertModalVisible && (
        <Animated.View style={[styles.alertOverlay, { opacity: slideAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleCloseAlert} />
          <Animated.View style={[styles.alertSheet, { backgroundColor: Colors.surfaceContainerLowest, transform: [{ translateY: slideAnim.interpolate({ inputRange: [0, 1], outputRange: [height * 0.8, 0] }) }] }]}>
            <TouchableOpacity activeOpacity={0.9} onPress={handleCloseAlert}>
              <LinearGradient colors={['#ba1a1a', '#93000a']} style={styles.alertSheetHeader} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                <View style={styles.alertCloseInner}>
                  <AlertTriangle size={24} color="white" />
                </View>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={[styles.alertSheetTitle, { textAlign: 'center' }]}>{t('weather.alert_detail_title', '기상특보 상세정보')}</Text>
                  {typeof weatherData.alert === 'object' && weatherData.alert.region && (
                    <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>({weatherData.alert.region})</Text>
                  )}
                </View>
                <View style={styles.alertCloseInner}>
                  <X size={20} color="white" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: 40 }}>
              <Text style={styles.alertSheetBody}>
                {typeof weatherData.alert === 'object' ? weatherData.alert.text : weatherData.alert}
              </Text>

              {weatherData.alert?.tmFc && (
                <View style={{ marginTop: Spacing.xl, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: Spacing.lg }}>
                  <Text style={{ fontSize: 14, color: Colors.textSecondary, textAlign: 'right' }}>
                    {`발표 시각 : ${formatAlertTime(weatherData.alert.tmFc)}`}
                  </Text>
                </View>
              )}
            </ScrollView>
            <View style={styles.alertSheetFooter}>
              <TouchableOpacity style={styles.alertSheetConfirmBtn} onPress={handleCloseAlert}>
                <Text style={styles.modalFooterBtnText}>{t('common.close', '닫기')}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#E6F7FF' },
  stickyHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, backgroundColor: '#E6F7FF', zIndex: 100 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  iconBtnPlaceholder: { width: 44 },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  headerSubtitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  scrollContent: { paddingBottom: Spacing.xxl, backgroundColor: '#f7f9ff' },
  heroSection: { paddingTop: Spacing.xl, paddingBottom: Spacing.xxl, alignItems: 'center' },
  heroMain: { alignItems: 'center' },
  heroIconTop: { marginBottom: Spacing.sm },
  heroTemp: { fontSize: 90, fontWeight: '800', color: Colors.text, letterSpacing: -4 },
  conditionSub: { fontSize: 18, fontWeight: '600', color: Colors.textSecondary, marginTop: -Spacing.sm },
  heroHighLow: { marginTop: Spacing.xs },
  heroHLText: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  alertModule: { marginHorizontal: Spacing.md, marginBottom: Spacing.xl, borderRadius: Spacing.lg, overflow: 'hidden' },
  alertGradient: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  alertText: { color: 'white', fontSize: 14, fontWeight: '600' },
  moduleCard: { backgroundColor: 'white', marginHorizontal: Spacing.md, marginBottom: Spacing.md, borderRadius: Spacing.lg, padding: Spacing.md, elevation: 4 },
  moduleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: 8 },
  moduleTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, textTransform: 'uppercase' },
  hourlyList: { paddingRight: Spacing.md },
  hourlyItem: { alignItems: 'center', marginRight: 10, paddingVertical: 12, paddingHorizontal: 5, borderRadius: 16, width: 78 },
  hourlyTime: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  hourlyIcon: { marginVertical: 4 },
  hourlyTemp: { fontSize: 17, fontWeight: '800', color: Colors.text, marginBottom: 2 },
  hourlyMeta: { gap: 4, width: '100%', marginTop: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  metaText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, flex: 1, textAlign: 'right' },
  dailyTableHead: { flexDirection: 'row', marginBottom: 8 },
  headTxt: { fontSize: 11, fontWeight: '800', color: Colors.outline, width: 60, textAlign: 'center' },
  dailyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
  dailyDayColumn: { width: 60, alignItems: 'center', justifyContent: 'center' },
  dailyDay: { fontSize: 14, fontWeight: '700', color: Colors.text, textAlign: 'center', height: 24, lineHeight: 24 },
  dailyDate: { fontSize: 11, fontWeight: '600', color: Colors.textSecondary, marginTop: 0, textAlign: 'center' },
  dayHalf: { width: 45, alignItems: 'center' },
  popText: { fontSize: 10, fontWeight: '800', color: Colors.primary },
  rangeContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  dailyLow: { width: 30, textAlign: 'right', fontSize: 14, color: Colors.textSecondary },
  dailyHigh: { width: 30, textAlign: 'left', fontSize: 14, fontWeight: '700', color: Colors.text },
  rangeBarBg: { flex: 1, height: 4, backgroundColor: Colors.surfaceContainer, marginHorizontal: 8, borderRadius: 2, overflow: 'hidden' },
  rangeBarActive: { position: 'absolute', height: 4, borderRadius: 2 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.md, gap: 12, marginBottom: Spacing.md },
  metricCardWide: { width: '100%', backgroundColor: 'white', borderRadius: Spacing.lg, padding: Spacing.md, elevation: 4 },
  metricCard: { width: (width - 32 - 12) / 2, backgroundColor: 'white', borderRadius: Spacing.lg, padding: Spacing.md, elevation: 4 },
  metricHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: 6 },
  metricLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  metricValue: { fontSize: 24, fontWeight: '700', color: Colors.text },
  aqiValueContainer: { flexDirection: 'row', alignItems: 'center' },
  aqiValue: { fontSize: 20, fontWeight: '700' },
  aqiLabel: { fontSize: 20, fontWeight: '700' },
  stationTag: { marginLeft: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 8, borderWidth: 1, borderColor: Colors.outlineVariant },
  stationTagName: { fontSize: 10, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase' },
  aqiDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 4 },
  aqiBarContainer: { height: 4, backgroundColor: Colors.surfaceContainer, borderRadius: 2, marginVertical: 10 },
  aqiForecastBox: { marginTop: 12, padding: 12, backgroundColor: Colors.surfaceContainerLowest, borderRadius: 12, borderWidth: 1, borderColor: Colors.outlineVariant },
  aqiForecastLabel: { fontSize: 11, fontWeight: '800', color: Colors.primary, marginBottom: 4, textTransform: 'uppercase' },
  aqiForecastText: { fontSize: 13, lineHeight: 18, color: Colors.text, fontWeight: '500' },
  aqiFullBar: { position: 'absolute', width: '100%', height: 4 },
  aqiProgressMarker: { position: 'absolute', top: -4, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: 'white' },
  pollutantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  pollutantCard: { width: '48%', backgroundColor: Colors.surfaceContainerLow, borderRadius: 12, padding: 10 },
  pollutantName: { fontSize: 11, fontWeight: '800', color: Colors.textSecondary },
  pollutantValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  pollutantValue: { fontSize: 16, fontWeight: '800' },
  pollutantUnit: { fontSize: 9, color: Colors.textSecondary },
  pollutantBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 4 },
  pollutantDot: { width: 4, height: 4, borderRadius: 2, marginRight: 4 },
  pollutantStatus: { fontSize: 10, fontWeight: '700' },
  locationName: { fontSize: 34, fontWeight: '800', color: Colors.text, textAlign: 'center' },
  sunCycleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sunSide: { width: 70 },
  sunLabel: { fontSize: 11, color: Colors.textSecondary },
  sunTime: { fontSize: 13, fontWeight: '800' },
  sunGraphic: { width: 120, height: 60, overflow: 'hidden' },
  sunHorizon: { width: 120, height: 1, backgroundColor: Colors.outline, position: 'absolute', bottom: 0 },
  sunArc: { width: 120, height: 120, borderRadius: 60, borderWidth: 1, borderColor: Colors.outline, borderStyle: 'dashed', position: 'absolute', bottom: -60 },
  sunPoint: { width: 12, height: 12, borderRadius: 6, position: 'absolute' },
  sunGlow: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(255, 184, 0, 0.2)', position: 'absolute', top: -4, left: -4 },
  attribution: { paddingVertical: Spacing.xxl, alignItems: 'center' },
  attrLabel: { fontSize: 10, color: Colors.textSecondary },
  attrValue: { fontSize: 10, color: Colors.outline },
  alertOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', zIndex: 9999 },
  alertSheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '80%', overflow: 'hidden', backgroundColor: 'white' },
  alertSheetHeader: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 12 },
  alertSheetTitle: { color: 'white', fontSize: 18, fontWeight: '800' },
  alertCloseInner: { padding: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
  alertSheetBody: { fontSize: 16, lineHeight: 26, color: Colors.text, fontWeight: '500' },
  alertSheetFooter: { padding: Spacing.xl, backgroundColor: Colors.surfaceContainerLowest, borderTopWidth: 1, borderTopColor: Colors.outlineVariant },
  alertSheetConfirmBtn: { backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 28, alignItems: 'center' },
  modalFooterBtnText: { color: 'white', fontSize: 16, fontWeight: '700' },
  dayBadge: { backgroundColor: Colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  dayBadgeText: { color: 'white', fontSize: 10, fontWeight: '800' }
});

export default WeatherDetailScreen;
