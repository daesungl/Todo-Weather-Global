import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ActivityIndicator, Animated, Easing } from 'react-native';
import { 
  ChevronLeft, Sun, Cloud, CloudRain, Wind, Droplets, 
  SunMedium, AlertTriangle, Calendar, Navigation, 
  Eye, Thermometer, Gauge, Activity, CloudLightning,
  Info, Umbrella, X, CloudSnow
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, Typography } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import AirService from '../services/weather/AirService';
import { fetchExtraMetrics } from '../services/weather/GlobalService';

const { width, height } = Dimensions.get('window');

const WeatherDetailScreen = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { weatherData: initialData } = route.params || {};
  
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
  const [loadingAir, setLoadingAir] = useState(!initialData.pollutants);
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fetch air quality and extra metrics asynchronously after screen entry
    const lat = initialData?.lat;
    const lon = initialData?.lon;
    const needsAQ = !initialData?.pollutants;
    const needsExtra = !initialData?.uvIndex || initialData?.uvIndex === '--';

    console.log(`[DetailScreen] Async Load: lat=${lat}, lon=${lon}, needsAQ=${needsAQ}, needsExtra=${needsExtra}`);

    if ((needsAQ || needsExtra) && lat && lon) {
      const loadAsyncData = async () => {
        try {
          // Fetch both air quality and extra metrics concurrently
          const [tm, extra] = await Promise.all([
            needsAQ ? AirService.getTMCoord(lat, lon).catch(() => null) : Promise.resolve(null),
            needsExtra ? fetchExtraMetrics(lat, lon).catch(() => null) : Promise.resolve(null)
          ]);

          let airData = null;
          if (tm) {
            const station = await AirService.getNearestStation(tm.x, tm.y).catch(() => null);
            if (station) {
              airData = await AirService.fetchAirQuality(station).catch(() => null);
            }
          }

          // Merge loaded data
          if (airData || extra) {
            setWeatherData(prev => {
              const updated = { ...prev };
              if (airData) {
                updated.airQuality = airData.airQuality;
                updated.aqiValue = airData.aqiValue;
                updated.aqiText = airData.aqiText;
                updated.aqiColor = airData.aqiColor;
                updated.aqiIndex = airData.aqiIndex;
                updated.pollutants = airData.pollutants;
              }
              if (extra) {
                updated.uvIndex = extra.uvIndex;
                updated.visibility = extra.visibility;
                updated.feelsLike = extra.feelsLike; // Overwrite basic KMA feelsLike with WeatherAPI if available
              }
              return updated;
            });
          }
        } catch (err) {
          console.warn('Post-load Async Fetches Failed:', err);
        } finally {
          setLoadingAir(false);
        }
      };
      loadAsyncData();
    } else {
      console.log(`[DetailScreen] Skipping AQ fetch — pollutants already present or no coords.`);
      setLoadingAir(false);
    }
  }, []);

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

  const renderHourlyIcon = (condKey) => {
    const size = 20;
    const color = Colors.primary;
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
        return <Sun size={size} color="#FFD700" />;
      default:
        return <Sun size={size} color="#FFD700" />;
    }
  };

  const [currentHourlyDay, setCurrentHourlyDay] = useState('오늘');

  const hourlyForecast = useMemo(() => {
    if (weatherData.hourlyForecast && weatherData.hourlyForecast.length > 0) {
      let dayOffset = 0;
      
      const getDayLabel = (offset) => {
        if (offset === 0) return '오늘';
        if (offset === 1) return '내일';
        if (offset === 2) return '모레';
        return `${offset}일 후`;
      };

      return weatherData.hourlyForecast.map((h, idx) => {
        // 첫 번째 데이터가 0시가 아닐 때, 중간에 0시를 만나면 날짜가 변경됨
        if (idx > 0 && (h.time === '0시' || h.time === 'Midnight')) {
          dayOffset++;
        }
        return {
          ...h,
          time: idx === 0 ? '지금' : h.time,
          icon: renderHourlyIcon(h.condKey),
          dayLabel: getDayLabel(dayOffset)
        };
      });
    }
    // Fallback Mock if no data
    return [
      { time: '지금', temp: '24°', icon: <Sun size={20} color={Colors.primary} />, pop: '10%', wind: '2m/s', windDeg: 135, hum: '45%' },
    ];
  }, [weatherData]);

  // 2. Dynamic 10-Day Forecast Generation
  const dailyForecast = useMemo(() => {
    // If the API provided a daily forecast, map it to our UI format
    if (weatherData.dailyForecast && Array.isArray(weatherData.dailyForecast)) {
      return weatherData.dailyForecast.map((item, index) => {
        const isRainy = item.condition === 'rainy';
        const isCloudy = item.condition === 'cloudy';
        
        // Map day labels to Korean
        let dayLabel = item.day;
        if (dayLabel === 'Today') dayLabel = '오늘';
        else if (dayLabel === 'Tomorrow') dayLabel = '내일';
        else {
          // Translate English weekdays if necessary
          const engToKor = { 'Sun': '일요일', 'Mon': '월요일', 'Tue': '화요일', 'Wed': '수요일', 'Thu': '목요일', 'Fri': '금요일', 'Sat': '토요일' };
          dayLabel = engToKor[item.day] || item.day;
        }

        return {
          day: dayLabel,
          high: parseInt(item.high),
          low: parseInt(item.low),
          amIcon: isRainy ? <CloudRain size={18} color={Colors.secondary} /> : (isCloudy ? <Cloud size={18} color={Colors.outline} /> : <Sun size={18} color={Colors.primary} />),
          amPop: isRainy ? '60%' : '10%',
          pmIcon: isRainy ? <CloudRain size={18} color={Colors.secondary} /> : (isCloudy ? <Cloud size={18} color={Colors.outline} /> : <Sun size={18} color={Colors.primary} />),
          pmPop: isRainy ? '80%' : '0%'
        };
      });
    }

    // Fallback to dummy generation if no API data
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

      const baseHigh = parseInt(weatherData.highTemp) || 24;
      const baseLow = parseInt(weatherData.lowTemp) || 16;
      const variation = Math.sin(i * 0.5) * 3;

      days.push({
        day: dayLabel,
        high: Math.round(baseHigh + variation),
        low: Math.round(baseLow + variation - (Math.random() * 2)),
        amIcon: i % 3 === 2 ? <CloudRain size={18} color={Colors.secondary} /> : <Sun size={18} color={Colors.primary} />,
        amPop: i % 3 === 2 ? '60%' : '10%',
        pmIcon: i % 4 === 3 ? <Cloud size={18} color={Colors.outline} /> : <Sun size={18} color={Colors.primary} />,
        pmPop: i % 4 === 3 ? '40%' : '0%'
      });
    }
    return days;
  }, [weatherData]);

  // Calculate global min/max for the 10-day period to make the range bar accurate
  const { globalMin, globalMax } = useMemo(() => {
    let min = 100, max = -100;
    dailyForecast.forEach(d => {
      if (d.low < min) min = d.low;
      if (d.high > max) max = d.high;
    });
    return { globalMin: min - 2, globalMax: max + 2 }; // Add padding
  }, [dailyForecast]);

  const TempRangeBar = ({ low, high }) => {
    const totalRange = globalMax - globalMin;
    const startPos = ((low - globalMin) / totalRange) * 100;
    const endPos = ((high - globalMin) / totalRange) * 100;
    const barWidth = endPos - startPos;

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

  const renderWeatherIcon = (condKey) => {
    const size = 80;
    const strokeWidth = 2;
    const style = styles.heroIconTop;

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
        return (
          <View style={[style, { width: size, height: size, justifyContent: 'center', alignItems: 'center' }]}>
            <Sun size={size * 0.8} color="#FFD700" strokeWidth={strokeWidth} />
            <Cloud size={size * 0.5} color="#cfd8dc" style={{ position: 'absolute', bottom: 5, right: -5 }} />
          </View>
        );
      default:
        return <Sun size={size} color="#FFD700" strokeWidth={strokeWidth} style={style} />;
    }
  };

  const isLoading = !initialData || !initialData.hourlyForecast;

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
    <View style={styles.container}>
      <View style={[styles.stickyHeader, { paddingTop: Constants.statusBarHeight }]}>
        <TouchableOpacity onPress={goBack} style={styles.iconBtn}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{weatherData.locationName}</Text>
          <Text style={styles.headerSubtitle}>{weatherData.addressName || weatherData.locationName}</Text>
        </View>
        <View style={styles.iconBtnPlaceholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <LinearGradient
          colors={['#E6F7FF', '#f7f9ff']}
          style={styles.heroSection}
        >
          <View style={styles.heroMain}>
            {renderWeatherIcon(weatherData.condKey)}
            <Text style={styles.heroTemp}>{weatherData.temp}</Text>
            <Text style={styles.conditionSub}>{weatherData.conditionText || t(`weather.${weatherData.condKey}`)}</Text>
            <View style={styles.heroHighLow}>
              <Text style={styles.heroHLText}>{`최고 ${weatherData.highTemp}  |  최저 ${weatherData.lowTemp}`}</Text>
            </View>
          </View>
        </LinearGradient>

        {initialData.alert && (
          <TouchableOpacity 
            activeOpacity={0.7} 
            onPress={() => {
              console.log('Alert banner pressed, opening modal. Data:', initialData.alert);
              setAlertModalVisible(true);
            }}
            style={[styles.alertModule, { zIndex: 999 }]}
          >
            <LinearGradient
              colors={['#ba1a1a', '#93000a']}
              style={[styles.alertGradient, { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md }]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <AlertTriangle size={18} color="white" />
              <Text style={[styles.alertText, { flex: 1, fontWeight: '700', textAlign: 'center' }]} numberOfLines={1}>
                {t('weather.alert_summary', '현재 지역에 실시간 기상특보가 있습니다.')}
              </Text>
              <ChevronLeft size={16} color="white" style={{ transform: [{ rotate: '180deg' }] }} />
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={styles.moduleCard}>
          <View style={styles.moduleHeader}>
            <Activity size={16} color={Colors.primary} />
            <Text style={styles.moduleTitle}>시간별 예보 {currentHourlyDay !== '오늘' ? `- ${currentHourlyDay}` : ''}</Text>
          </View>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={{ marginHorizontal: -Spacing.md }}
            contentContainerStyle={[styles.hourlyList, { paddingHorizontal: Spacing.md }]}
            scrollEventThrottle={32}
            onScroll={(event) => {
              // 약 88px가 아이템 하나(너비 78 + 여백 10)의 공간입니다. 중앙정렬 보정을 위해 화면 가로폭 일부를 더합니다.
              const scrollPos = event.nativeEvent.contentOffset.x;
              const activeIndex = Math.max(0, Math.floor((scrollPos + 60) / 88));
              if (hourlyForecast[activeIndex] && hourlyForecast[activeIndex].dayLabel !== currentHourlyDay) {
                setCurrentHourlyDay(hourlyForecast[activeIndex].dayLabel);
              }
            }}
          >
            {hourlyForecast.map((item, index) => {
              // 0시 기준 뱃지 부활
              let dayBadge = null;
              if (item.time === '0시' || item.time === 'Midnight') {
                dayBadge = item.dayLabel;
              }
              
              // 날짜별 배경(Background) 색상 지정
              let bgColor = Colors.surfaceContainerLow; // 오늘
              if (item.dayLabel === '내일') bgColor = '#EDF7FF';       // 라이트 블루
              else if (item.dayLabel === '모레') bgColor = '#F4EEFB';  // 라이트 퍼플
              else if (item.dayLabel === '3일 후') bgColor = '#E8F5E9'; // 라이트 그린
              else if (item.dayLabel === '4일 후') bgColor = '#FFF3E0'; // 라이트 오렌지
              else if (item.dayLabel === '5일 후') bgColor = '#FFFDE7'; // 라이트 옐로우

              return (
                <View 
                  key={index} 
                  style={[
                    styles.hourlyItem, 
                    { backgroundColor: bgColor } // 전체 배경색 변경으로 블록감 극대화
                  ]}
                >
                  {dayBadge ? (
                    <View style={styles.dayBadge}>
                      <Text style={styles.dayBadgeText}>{dayBadge}</Text>
                    </View>
                  ) : (
                    <Text style={styles.hourlyTime}>{item.time}</Text>
                  )}
                  <View style={styles.hourlyIcon}>{item.icon}</View>
                  <Text style={styles.hourlyTemp}>{item.temp}</Text>
                  <View style={styles.hourlyMeta}>
                     <View style={styles.metaRow}><Umbrella size={12} color={Colors.primary} /><Text style={styles.metaText}>{item.pop}</Text></View>
                     <View style={styles.metaRow}>
                        <View style={{ transform: [{ rotate: `${item.windDeg}deg` }] }}>
                          <Navigation size={12} color={Colors.textSecondary} />
                        </View>
                        <Text style={styles.metaText}>{item.wind}</Text>
                     </View>
                     <View style={styles.metaRow}><Droplets size={12} color={Colors.textSecondary} /><Text style={styles.metaText}>{item.hum}</Text></View>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.moduleCard}>
          <View style={styles.moduleHeader}>
            <Calendar size={16} color={Colors.primary} />
            <Text style={styles.moduleTitle}>10일 예보</Text>
          </View>
          <View style={styles.dailyTableHead}>
             <Text style={[styles.headTxt, { width: 50 }]}>날짜</Text>
             <Text style={styles.headTxt}>오전</Text>
             <Text style={styles.headTxt}>오후</Text>
             <Text style={[styles.headTxt, { flex: 1, textAlign: 'center' }]}>온도 추이</Text>
          </View>
          {dailyForecast.map((item, index) => (
            <View key={index} style={[styles.dailyRow, index === dailyForecast.length - 1 && { borderBottomWidth: 0 }]}>
              <Text style={styles.dailyDay}>{item.day}</Text>
              
              <View style={styles.dayHalf}>
                 {item.amIcon}
                 <Text style={styles.popText}>{item.amPop}</Text>
              </View>

              <View style={styles.dayHalf}>
                 {item.pmIcon}
                 <Text style={styles.popText}>{item.pmPop}</Text>
              </View>

              <View style={styles.rangeContainer}>
                 <Text style={styles.dailyLow}>{`${item.low}°`}</Text>
                 <TempRangeBar low={item.low} high={item.high} />
                 <Text style={styles.dailyHigh}>{`${item.high}°`}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.metricsGrid}>
          <View style={styles.metricCardWide}>
            <View style={styles.metricHeader}>
              <Wind size={14} color={Colors.textSecondary} />
              <Text style={styles.metricLabel}>대기 질</Text>
            </View>
            <View style={styles.aqiContent}>
              <View style={styles.aqiValueContainer}>
                {loadingAir ? (
                  <ActivityIndicator size="small" color={Colors.primary} style={{ marginRight: 10 }} />
                ) : (
                  <Text style={styles.aqiValue}>{weatherData.aqiValue} - </Text>
                )}
                <Text style={[styles.aqiLabel, { color: weatherData.aqiColor }]}>{weatherData.airQuality}</Text>
              </View>
              <Text style={styles.aqiDesc}>{weatherData.aqiText}</Text>
            </View>
            <View style={styles.aqiBarContainer}>
               <View style={styles.aqiFullBar} />
               <View style={[styles.aqiProgressMarker, { left: `${(weatherData.aqiIndex || 0.1) * 100}%`, backgroundColor: weatherData.aqiColor || Colors.primary }]} />
            </View>

            {/* Detailed Pollutants Grid */}
            <View style={styles.pollutantGrid}>
              {loadingAir ? (
                // Skeleton-like loading state for grid
                [1, 2, 3, 4, 5, 6].map((i) => (
                  <View key={i} style={[styles.pollutantCard, { justifyContent: 'center', alignItems: 'center', minHeight: 100 }]}>
                    <ActivityIndicator size="small" color={Colors.outline} />
                    <Text style={{ fontSize: 10, color: Colors.outline, marginTop: 10 }}>로딩 중...</Text>
                  </View>
                ))
              ) : (
                weatherData.pollutants && Object.entries(weatherData.pollutants).map(([key, data]) => (
                  <View key={key} style={styles.pollutantCard}>
                    <Text style={styles.pollutantName}>{key.toUpperCase()}</Text>
                    <View style={styles.pollutantValueRow}>
                      <Text style={styles.pollutantValue}>{data.value || '--'}</Text>
                      <Text style={styles.pollutantUnit}>{data.unit}</Text>
                    </View>
                    <View style={[styles.pollutantBadge, { backgroundColor: `${data.color}25`, borderWidth: 1, borderColor: `${data.color}60` }]}>
                      <View style={[styles.pollutantDot, { backgroundColor: data.color }]} />
                      <Text style={[styles.pollutantStatus, { color: '#333333' }]}>{data.label}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <SunMedium size={14} color={Colors.textSecondary} />
              <Text style={styles.metricLabel}>자외선</Text>
            </View>
            <Text style={styles.metricValue}>{weatherData.uvIndex}</Text>
            {weatherData.uvIndex !== '--' && <Text style={styles.metricSub}>정오 무렵 가장 높음</Text>}
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Droplets size={14} color={Colors.textSecondary} />
              <Text style={styles.metricLabel}>전체 습도</Text>
            </View>
            <Text style={styles.metricValue}>{weatherData.humidity}</Text>
            {weatherData.humidity !== '--%' && <Text style={styles.metricSub}>이슬점은 알 수 없음</Text>}
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Thermometer size={14} color={Colors.textSecondary} />
              <Text style={styles.metricLabel}>체감 온도</Text>
            </View>
            <Text style={styles.metricValue}>{weatherData.feelsLike}</Text>
            {weatherData.feelsLike !== '--°' && <Text style={styles.metricSub}>바람의 영향을 받음</Text>}
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <Eye size={14} color={Colors.textSecondary} />
              <Text style={styles.metricLabel}>가시거리</Text>
            </View>
            <Text style={styles.metricValue}>{weatherData.visibility}</Text>
            {weatherData.visibility !== '--' && <Text style={styles.metricSub}>일반적인 가시거리</Text>}
          </View>
        </View>

        <View style={styles.moduleCard}>
          <View style={styles.moduleHeader}>
            <SunMedium size={16} color={Colors.primary} />
            <Text style={styles.moduleTitle}>일출 및 일몰</Text>
          </View>
          <View style={styles.sunCycleRow}>
            <View style={styles.sunSide}>
              <Text style={styles.sunLabel}>일출</Text>
              <Text style={styles.sunTime}>{weatherData.sunrise}</Text>
            </View>
            <View style={styles.sunGraphic}>
              <View style={styles.sunArc} />
              <View style={styles.sunPoint} />
            </View>
            <View style={[styles.sunSide, { alignItems: 'flex-end' }]}>
              <Text style={styles.sunLabel}>일몰</Text>
              <Text style={styles.sunTime}>{weatherData.sunset}</Text>
            </View>
          </View>
        </View>

        <View style={styles.attribution}>
          <Text style={styles.attrLabel}>DATA PROVIDED BY</Text>
          <Text style={styles.attrValue}>{weatherData.source}</Text>
        </View>
      </ScrollView>

      {/* Absolute overlay — Global Todo Weather Design System Version */}
      {alertModalVisible && (
        <Animated.View 
          style={[
            styles.alertOverlay,
            {
              opacity: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 1]
              })
            }
          ]}
        >
          <TouchableOpacity 
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={handleCloseAlert}
          />
          <Animated.View 
            style={[
              styles.alertSheet, 
              { 
                backgroundColor: Colors.surfaceContainerLowest,
                transform: [{
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [height * 0.8, 0]
                  })
                }]
              }
            ]}
          >
            <TouchableOpacity activeOpacity={0.9} onPress={handleCloseAlert}>
              <LinearGradient
                colors={['#ba1a1a', '#93000a']}
                style={styles.alertSheetHeader}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              >
                <AlertTriangle size={20} color="white" />
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={styles.alertSheetTitle}>기상특보 상세정보</Text>
                </View>
                <View style={styles.alertCloseInner}>
                  <X size={20} color="white" />
                </View>
              </LinearGradient>
            </TouchableOpacity>
            
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingHorizontal: Spacing.xl, paddingTop: Spacing.xl, paddingBottom: 40 }}
              showsVerticalScrollIndicator={true}
            >
              <Text style={[styles.alertSheetBody, { color: Colors.text, fontWeight: '500' }]}>
                {initialData.alert}
              </Text>
            </ScrollView>
            
            <View style={styles.alertSheetFooter}>
              <TouchableOpacity
                style={styles.alertSheetConfirmBtn}
                onPress={handleCloseAlert}
              >
                <Text style={styles.modalFooterBtnText}>닫기</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  stickyHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, backgroundColor: '#E6F7FF', zIndex: 100 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'transparent', justifyContent: 'center', alignItems: 'center' },
  iconBtnPlaceholder: { width: 44 },
  headerTitleWrap: { flex: 1, alignItems: 'center', paddingHorizontal: Spacing.sm },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  headerSubtitle: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500', marginTop: 2 },
  scrollContent: { paddingBottom: Spacing.xxl },
  
  heroSection: { paddingTop: Spacing.xl, paddingBottom: Spacing.xxl, alignItems: 'center' },
  heroMain: { alignItems: 'center' },
  heroIconTop: { marginBottom: Spacing.sm },
  heroTemp: { fontSize: 90, fontWeight: '800', color: Colors.text, letterSpacing: -4 },
  conditionSub: { fontSize: 18, fontWeight: '600', color: Colors.textSecondary, marginTop: -Spacing.sm },
  heroHighLow: { marginTop: Spacing.xs },
  heroHLText: { fontSize: 16, fontWeight: '600', color: Colors.textSecondary },
  
  alertModule: { marginHorizontal: Spacing.md, marginBottom: Spacing.xl, borderRadius: Spacing.lg, overflow: 'hidden' },
  alertGradient: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, gap: 12 },
  alertText: { flex: 1, color: 'white', fontSize: 14, fontWeight: '600' },
  
  moduleCard: { backgroundColor: Colors.surfaceContainerLowest, marginHorizontal: Spacing.md, marginBottom: Spacing.md, borderRadius: Spacing.lg, padding: Spacing.md, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 16, elevation: 4 },
  moduleHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: 8 },
  moduleTitle: { fontSize: 14, fontWeight: '700', color: Colors.text, textTransform: 'uppercase', letterSpacing: 0.5 },
  
  hourlyList: { paddingRight: Spacing.md },
  hourlyItem: { alignItems: 'center', marginRight: 10, paddingVertical: 12, paddingHorizontal: 5, backgroundColor: Colors.surfaceContainerLow, borderRadius: 16, width: 78 },
  hourlyTime: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 },
  hourlyIcon: { marginVertical: 4 },
  hourlyTemp: { fontSize: 17, fontWeight: '800', color: Colors.text, marginBottom: 8 },
  hourlyMeta: { gap: 6, width: '100%', alignItems: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary },
  
  dailyTableHead: { flexDirection: 'row', paddingHorizontal: 4, marginBottom: 8 },
  headTxt: { fontSize: 11, fontWeight: '800', color: Colors.outline, width: 50, textAlign: 'center' },
  dailyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
  dailyDay: { width: 50, fontSize: 14, fontWeight: '700', color: Colors.text },
  dayHalf: { width: 45, alignItems: 'center', gap: 2 },
  popText: { fontSize: 10, fontWeight: '800', color: Colors.primary },
  rangeContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', marginLeft: 10 },
  dailyLow: { width: 30, textAlign: 'right', fontSize: 14, fontWeight: '600', color: Colors.textSecondary },
  dailyHigh: { width: 30, textAlign: 'left', fontSize: 14, fontWeight: '700', color: Colors.text },
  rangeBarBg: { flex: 1, height: 4, backgroundColor: Colors.surfaceContainer, marginHorizontal: 8, borderRadius: 2, overflow: 'hidden', position: 'relative' },
  rangeBarActive: { position: 'absolute', height: 4, borderRadius: 2 },
  
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.md, gap: 12, marginBottom: Spacing.md },
  metricCardWide: { width: '100%', backgroundColor: Colors.surfaceContainerLowest, borderRadius: Spacing.lg, padding: Spacing.md, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 16, elevation: 4 },
  metricCard: { width: (width - 32 - 12) / 2, backgroundColor: Colors.surfaceContainerLowest, borderRadius: Spacing.lg, padding: Spacing.md, shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 1, shadowRadius: 16, elevation: 4 },
  metricHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: 6 },
  metricLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  metricValue: { fontSize: 24, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  metricSub: { fontSize: 12, color: Colors.textSecondary, fontWeight: '500' },
  aqiContent: { marginBottom: Spacing.md },
  aqiValue: { fontSize: 20, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  aqiDesc: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  aqiGraphBase: { height: 4, backgroundColor: Colors.surfaceContainer, borderRadius: 2, position: 'relative', marginTop: Spacing.md, marginBottom: Spacing.lg },
  aqiPointer: { position: 'absolute', top: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primaryContainer, borderWidth: 2, borderColor: 'white' },
  
  // Detailed Pollutants
  pollutantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: Spacing.sm },
  pollutantCard: { width: '48%', backgroundColor: Colors.surfaceContainerLow, borderRadius: 12, padding: 12 },
  pollutantName: { fontSize: 13, fontWeight: '800', color: Colors.textSecondary, marginBottom: 6 },
  pollutantValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginBottom: 10 },
  pollutantValue: { fontSize: 18, fontWeight: '800', color: Colors.text },
  pollutantUnit: { fontSize: 10, color: Colors.textSecondary, fontWeight: '600' },
  pollutantBadge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, gap: 5, borderWeight: 1, borderColor: 'rgba(0,0,0,0.05)' },
  pollutantDot: { width: 6, height: 6, borderRadius: 3 },
  pollutantStatus: { fontSize: 12, fontWeight: '800' },

  sunCycleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: Spacing.lg },
  sunSide: { width: 60 },
  sunLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  sunTime: { fontSize: 14, fontWeight: '700', color: Colors.text },
  sunGraphic: { flex: 1, height: 60, alignItems: 'center', justifyContent: 'center' },
  sunArc: { width: 120, height: 120, borderRadius: 60, borderWidth: 1.5, borderColor: Colors.outlineVariant, borderStyle: 'dashed', position: 'absolute', bottom: -60 },
  sunPoint: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primaryContainer, position: 'absolute', top: 5, left: '20%' },
  attribution: { paddingVertical: Spacing.xxl, alignItems: 'center' },
  attrLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1 },
  attrValue: { fontSize: 10, fontWeight: '600', color: Colors.outline, marginTop: 4 },

  // Alert Sheet Overlay (Global Todo Weather Design System)
  alertOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
    zIndex: 9999,
  },
  alertSheet: {
    borderTopLeftRadius: 32, borderTopRightRadius: 32,
    height: '80%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 20,
    backgroundColor: 'white',
    overflow: 'hidden',
  },
  alertSheetHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 20, paddingHorizontal: Spacing.xl,
    gap: 12,
  },
  alertSheetTitle: { fontSize: 18, fontWeight: '800', color: 'white' },
  alertCloseInner: { padding: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 20 },
  alertSheetBody: { fontSize: 16, lineHeight: 26, color: Colors.text },
  alertSheetFooter: {
    padding: Spacing.xl,
    backgroundColor: Colors.surfaceContainerLowest,
    borderTopWidth: 1, borderTopColor: Colors.outlineVariant,
  },
  alertSheetConfirmBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 28,
    alignItems: 'center',
  },
  modalFooterBtnText: { color: 'white', fontSize: 16, fontWeight: '700' }
});

export default WeatherDetailScreen;
