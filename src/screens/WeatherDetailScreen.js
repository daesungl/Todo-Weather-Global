import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { 
  ChevronLeft, Sun, Cloud, CloudRain, Wind, Droplets, 
  SunMedium, AlertTriangle, Calendar, Navigation, 
  Eye, Thermometer, Gauge, Activity, CloudLightning,
  Info, Umbrella
} from 'lucide-react-native';
import { Colors, Spacing, Typography } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');

const WeatherDetailScreen = ({ navigation, route }) => {
  const { weatherData: initialData } = route.params || {};
  
  const [weatherData] = useState(initialData || {
    locationName: '강남구',
    addressName: '서울특별시 강남구 역삼동',
    temp: '24°',
    highTemp: '28°',
    lowTemp: '19°',
    condKey: 'sunny',
    conditionText: '대체로 맑음',
    humidity: '45%',
    windSpeed: '2.4m/s',
    windDir: '북서풍',
    airQuality: '좋음',
    aqiValue: '12',
    aqiText: '공기 질이 매우 깨끗합니다. 야외 활동에 적합합니다.',
    visibility: '15km',
    feelsLike: '26°',
    pressure: '1013hPa',
    uvIndex: '3 (보통)',
    precipChance: '10%',
    sunrise: '06:02 AM',
    sunset: '07:06 PM',
    alert: '오후 4시경 소나기 가능성이 있습니다.',
    source: 'KOREA METEOROLOGICAL ADMINISTRATION'
  });

  const goBack = () => navigation.goBack();

  // 1. Hourly Forecast with Wind Degrees for rotation
  const hourlyForecast = [
    { time: '지금', temp: '24°', icon: <Sun size={20} color={Colors.primary} />, pop: '10%', wind: '2m/s', windDeg: 135, hum: '45%' }, // 북서
    { time: '16시', temp: '26°', icon: <Sun size={20} color={Colors.primary} />, pop: '10%', wind: '3m/s', windDeg: 135, hum: '42%' }, // 북서
    { time: '17시', temp: '25°', icon: <Cloud size={20} color={Colors.outline} />, pop: '30%', wind: '4m/s', windDeg: 90, hum: '50%' },  // 서
    { time: '18시', temp: '23°', icon: <CloudRain size={20} color={Colors.primary} />, pop: '80%', wind: '4m/s', windDeg: 45, hum: '65%' }, // 남서
    { time: '19시', temp: '22°', icon: <Cloud size={20} color={Colors.outline} />, pop: '40%', wind: '3m/s', windDeg: 45, hum: '60%' }, // 남서
    { time: '20시', temp: '21°', icon: <Cloud size={20} color={Colors.outline} />, pop: '20%', wind: '2m/s', windDeg: 0, hum: '58%' },  // 남
    { time: '21시', temp: '20°', icon: <CloudLightning size={20} color={Colors.tertiary} />, pop: '15%', wind: '2m/s', windDeg: 0, hum: '55%' }, // 남
  ];

  // 2. 10-Day Forecast Data
  const dailyForecast = [
    { day: '오늘', high: 28, low: 19, amIcon: <Sun size={18} color={Colors.primary} />, amPop: '0%', pmIcon: <Sun size={18} color={Colors.primary} />, pmPop: '10%' },
    { day: '내일', high: 26, low: 18, amIcon: <Cloud size={18} color={Colors.primary} />, amPop: '20%', pmIcon: <Cloud size={18} color={Colors.primary} />, pmPop: '30%' },
    { day: '수요일', high: 24, low: 17, amIcon: <CloudRain size={18} color={Colors.secondary} />, amPop: '60%', pmIcon: <Cloud size={18} color={Colors.primary} />, pmPop: '40%' },
    { day: '목요일', high: 27, low: 19, amIcon: <Sun size={18} color={Colors.primary} />, amPop: '10%', pmIcon: <Sun size={18} color={Colors.primary} />, pmPop: '0%' },
    { day: '금요일', high: 29, low: 20, amIcon: <Sun size={18} color={Colors.primary} />, amPop: '0%', pmIcon: <Sun size={18} color={Colors.primary} />, pmPop: '0%' },
    { day: '토요일', high: 25, low: 18, amIcon: <Cloud size={18} color={Colors.primary} />, amPop: '30%', pmIcon: <Cloud size={18} color={Colors.primary} />, pmPop: '20%' },
    { day: '일요일', high: 23, low: 16, amIcon: <CloudRain size={18} color={Colors.secondary} />, amPop: '80%', pmIcon: <CloudRain size={18} color={Colors.secondary} />, pmPop: '70%' },
    { day: '월요일', high: 24, low: 17, amIcon: <Cloud size={18} color={Colors.primary} />, amPop: '20%', pmIcon: <Sun size={18} color={Colors.primary} />, pmPop: '10%' },
    { day: '화요일', high: 26, low: 18, amIcon: <Sun size={18} color={Colors.primary} />, amPop: '0%', pmIcon: <Sun size={18} color={Colors.primary} />, pmPop: '0%' },
    { day: '수요일', high: 25, low: 17, amIcon: <Cloud size={18} color={Colors.primary} />, amPop: '10%', pmIcon: <Cloud size={18} color={Colors.primary} />, pmPop: '20%' },
  ];

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

  return (
    <View style={styles.container}>
      <View style={[styles.stickyHeader, { paddingTop: Constants.statusBarHeight }]}>
        <TouchableOpacity onPress={goBack} style={styles.iconBtn}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>{weatherData.locationName}</Text>
          <Text style={styles.headerSubtitle}>{weatherData.addressName}</Text>
        </View>
        <TouchableOpacity style={styles.iconBtn}>
          <Info size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <LinearGradient
          colors={['#E6F7FF', '#f7f9ff']}
          style={styles.heroSection}
        >
          <View style={styles.heroMain}>
            <Sun size={80} color="#FFD700" strokeWidth={2} style={styles.heroIconTop} />
            <Text style={styles.heroTemp}>{weatherData.temp}</Text>
            <Text style={styles.conditionSub}>{weatherData.conditionText}</Text>
            <View style={styles.heroHighLow}>
              <Text style={styles.heroHLText}>{`최고 ${weatherData.highTemp}  |  최저 ${weatherData.lowTemp}`}</Text>
            </View>
          </View>
        </LinearGradient>

        {weatherData.alert && (
          <View style={styles.alertModule}>
            <LinearGradient
              colors={['#ba1a1a', '#93000a']}
              style={styles.alertGradient}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            >
              <AlertTriangle size={20} color="white" />
              <Text style={styles.alertText}>{weatherData.alert}</Text>
            </LinearGradient>
          </View>
        )}

        <View style={styles.moduleCard}>
          <View style={styles.moduleHeader}>
            <Activity size={16} color={Colors.primary} />
            <Text style={styles.moduleTitle}>시간별 예보</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourlyList}>
            {hourlyForecast.map((item, index) => (
              <View key={index} style={styles.hourlyItem}>
                <Text style={styles.hourlyTime}>{item.time}</Text>
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
            ))}
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
                <Text style={styles.aqiValue}>{`${weatherData.aqiValue} - ${weatherData.airQuality}`}</Text>
                <Text style={styles.aqiDesc}>{weatherData.aqiText}</Text>
             </View>
             <View style={styles.aqiGraphBase}>
                <View style={[styles.aqiPointer, { left: '12%' }]} />
             </View>
          </View>

          <View style={styles.metricCard}>
             <View style={styles.metricHeader}><SunMedium size={14} color={Colors.textSecondary} /><Text style={styles.metricLabel}>자외선</Text></View>
             <Text style={styles.metricValue}>{weatherData.uvIndex}</Text>
             <Text style={styles.metricSub}>정오 무렵 가장 높음</Text>
          </View>

          <View style={styles.metricCard}>
             <View style={styles.metricHeader}><Droplets size={14} color={Colors.textSecondary} /><Text style={styles.metricLabel}>전체 습도</Text></View>
             <Text style={styles.metricValue}>{weatherData.humidity}</Text>
             <Text style={styles.metricSub}>{`이슬점: 14°`}</Text>
          </View>

          <View style={styles.metricCard}>
             <View style={styles.metricHeader}><Thermometer size={14} color={Colors.textSecondary} /><Text style={styles.metricLabel}>체감 온도</Text></View>
             <Text style={styles.metricValue}>{weatherData.feelsLike}</Text>
             <Text style={styles.metricSub}>습도로 인한 열기</Text>
          </View>

          <View style={styles.metricCard}>
             <View style={styles.metricHeader}><Eye size={14} color={Colors.textSecondary} /><Text style={styles.metricLabel}>가시거리</Text></View>
             <Text style={styles.metricValue}>{weatherData.visibility}</Text>
             <Text style={styles.metricSub}>매우 맑은 상태</Text>
          </View>
        </View>

        <View style={styles.moduleCard}>
           <View style={styles.moduleHeader}><SunMedium size={16} color={Colors.primary} /><Text style={styles.moduleTitle}>일출 및 일몰</Text></View>
           <View style={styles.sunCycleRow}>
              <View style={styles.sunSide}><Text style={styles.sunLabel}>일출</Text><Text style={styles.sunTime}>{weatherData.sunrise}</Text></View>
              <View style={styles.sunGraphic}><View style={styles.sunArc} /><View style={styles.sunPoint} /></View>
              <View style={[styles.sunSide, { alignItems: 'flex-end' }]}><Text style={styles.sunLabel}>일몰</Text><Text style={styles.sunTime}>{weatherData.sunset}</Text></View>
           </View>
        </View>

        <View style={styles.attribution}>
          <Text style={styles.attrLabel}>DATA PROVIDED BY</Text>
          <Text style={styles.attrValue}>{weatherData.source}</Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  stickyHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, backgroundColor: '#E6F7FF', zIndex: 100 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surfaceContainer, justifyContent: 'center', alignItems: 'center' },
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
  aqiGraphBase: { height: 4, backgroundColor: Colors.surfaceContainer, borderRadius: 2, position: 'relative', marginTop: Spacing.sm },
  aqiPointer: { position: 'absolute', top: -4, width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primaryContainer, borderWidth: 2, borderColor: 'white' },
  
  sunCycleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingTop: Spacing.lg },
  sunSide: { width: 60 },
  sunLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, marginBottom: 4 },
  sunTime: { fontSize: 14, fontWeight: '700', color: Colors.text },
  sunGraphic: { flex: 1, height: 60, alignItems: 'center', justifyContent: 'center' },
  sunArc: { width: 120, height: 120, borderRadius: 60, borderWidth: 1.5, borderColor: Colors.outlineVariant, borderStyle: 'dashed', position: 'absolute', bottom: -60 },
  sunPoint: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primaryContainer, position: 'absolute', top: 5, left: '20%' },
  attribution: { paddingVertical: Spacing.xxl, alignItems: 'center' },
  attrLabel: { fontSize: 10, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 1 },
  attrValue: { fontSize: 10, fontWeight: '600', color: Colors.outline, marginTop: 4 }
});

export default WeatherDetailScreen;
