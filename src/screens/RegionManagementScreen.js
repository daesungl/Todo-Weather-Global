import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Modal, TextInput, FlatList, ActivityIndicator } from 'react-native';
import { TouchableOpacity, GestureHandlerRootView } from 'react-native-gesture-handler';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Trash2, Plus, Sun, Search, X, MapPin, Droplets, Wind, Zap, CloudRain, Moon, Cloud, CloudSnow } from 'lucide-react-native';
import { Colors, Spacing, Typography } from '../theme';
import { LinearGradient } from 'expo-linear-gradient';
import { getBookmarkedRegions, removeRegion, addRegion, saveBookmarkedRegions } from '../services/weather/RegionService';
import { getWeather } from '../services/weather/WeatherService';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Alert } from 'react-native';

const { width, height } = Dimensions.get('window');

const RegionManagementScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { isPremium } = useSubscription();
  const [regions, setRegions] = useState([]);
  const [weatherDataMap, setWeatherDataMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const goBack = () => navigation.goBack();

  useEffect(() => {
    loadRegions();
  }, []);

  const loadRegions = async () => {
    setLoading(true);
    const saved = await getBookmarkedRegions();
    setRegions(saved);
    
    // Fetch weather for each region
    const weatherMap = {};
    for (const region of saved) {
      try {
        const weather = await getWeather(region.lat, region.lon);
        weatherMap[region.id] = weather;
      } catch (e) {
        console.error(`Failed to fetch weather for ${region.name}`, e);
      }
    }
    setWeatherDataMap(weatherMap);
    setLoading(false);
  };

  const handleDelete = async (id) => {
    const updated = await removeRegion(id);
    setRegions(updated);
  };

  const handleAddRegion = async (place) => {
    // Subscription check: Free users limit to 3 total regions
    if (!isPremium && regions.length >= 3) {
      Alert.alert(t('common.info', '알림'), t('home.premium_only_limit', '더 많은 지역을 추가하려면 프리미엄 구독이 필요합니다. (최대 3개)'));
      return;
    }
    const updated = await addRegion(place.name, place.address, place.lat, place.lon);
    setRegions(updated);
    setSearchModalVisible(false);
    loadRegions(); // Refresh weather
  };

  const renderWeatherIcon = (condKey, isDay = true) => {
    const iconSize = 48;
    const iconColor = Colors.primary;
    
    switch (condKey) {
      case 'sunny':
        return isDay ? <Sun size={iconSize} color={iconColor} style={styles.weatherIcon} /> 
                     : <Moon size={iconSize} color={iconColor} style={styles.weatherIcon} />;
      case 'rainy':
        return <CloudRain size={iconSize} color={iconColor} style={styles.weatherIcon} />;
      case 'cloudy':
        return <Cloud size={iconSize} color={iconColor} style={styles.weatherIcon} />;
      case 'snowy':
        return <CloudSnow size={iconSize} color={iconColor} style={styles.weatherIcon} />;
      default:
        return isDay ? <Sun size={iconSize} color={iconColor} style={styles.weatherIcon} /> 
                     : <Moon size={iconSize} color={iconColor} style={styles.weatherIcon} />;
    }
  };

  const renderRegionCard = (item) => {
    const weather = weatherDataMap[item.id];
    
    return (
      <View key={item.id} style={styles.regionCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.regionTitle}>[{item.name}]</Text>
          <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteIconBtn}>
            <Trash2 size={18} color={Colors.outline} />
          </TouchableOpacity>
        </View>
        <Text style={styles.regionAddress} numberOfLines={1}>{item.address}</Text>
        
        <View style={styles.cardBody}>
          <View style={styles.bodyLeft}>
            {renderWeatherIcon(weather?.condKey, weather?.isDay !== false)}
            <View style={styles.tempCol}>
                <Text style={styles.tempLarge}>{weather?.temp || '--'}°</Text>
                <Text style={styles.conditionTextSmall}>({t(`weather.${weather?.condKey || 'sunny'}`)})</Text>
            </View>
          </View>
          
          <View style={styles.bodyRight}>
            <View style={styles.detailRow}>
              <Droplets size={14} color={Colors.outline} />
              <Text style={styles.detailText}>{t('common.humidity')}: {weather?.humidity || '--'}%</Text>
            </View>
            <View style={styles.detailRow}>
              <CloudRain size={14} color={Colors.outline} />
              <Text style={styles.detailText}>강수량: {weather?.rainAmount || '0mm'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Wind size={14} color={Colors.outline} />
              <Text style={styles.detailText}>바람: {weather?.windDir || '북동'} {weather?.windSpeed || '6'}m/s</Text>
            </View>
            <View style={styles.detailRow}>
              <Zap size={14} color={Colors.outline} />
              <Text style={styles.detailText}>낙뢰: -</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const SearchModal = () => (
    <Modal animationType="slide" transparent={true} visible={searchModalVisible} onRequestClose={() => setSearchModalVisible(false)}>
      <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.searchHeader}>
            <View style={styles.searchInputWrap}>
              <Search size={20} color={Colors.outline} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="장소 검색 (예: 김포공항)"
                placeholderTextColor={Colors.outline}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
                autoCapitalize="none"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <X size={20} color={Colors.outline} />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={() => setSearchModalVisible(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>취소</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchResultWrap}>
             {searchQuery.length > 0 ? (
               <ScrollView>
                 {/* Mock result for demo */}
                 <TouchableOpacity 
                   style={styles.resultItem} 
                   onPress={() => handleAddRegion({ name: '김포공항', address: '서울특별시 강서구 공항동 1373', lat: 37.5583, lon: 126.7906 })}
                 >
                   <MapPin size={18} color={Colors.outline} />
                   <View style={styles.resultTextCol}>
                     <Text style={styles.resultName}>김포공항</Text>
                     <Text style={styles.resultSub}>서울특별시 강서구 공항동 1373</Text>
                   </View>
                 </TouchableOpacity>
               </ScrollView>
             ) : (
                <View style={styles.emptySearch}>
                  <Search size={48} color="#EEE" />
                  <Text style={styles.emptyText}>추가할 지역을 검색하세요.</Text>
                </View>
             )}
          </View>
        </View>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.stickyHeader, { paddingTop: Constants.statusBarHeight }]}>
        <TouchableOpacity onPress={goBack} style={styles.iconBtn}>
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>날씨 관심 지역</Text>
        <View style={styles.iconBtnPlaceholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.listSection}>
          {loading && regions.length === 0 ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
          ) : (
            <>
              {regions.map(renderRegionCard)}
              
              <TouchableOpacity style={styles.addCard} onPress={() => setSearchModalVisible(true)}>
                <View style={styles.addBtnCircle}>
                  <Plus size={32} color={Colors.outline} strokeWidth={1.5} />
                </View>
                <Text style={styles.addCardTitle}>여기를 눌러서 관심 지역을 추가하세요.</Text>
                <Text style={styles.addCardSub}>길게 눌러 순서를 바꿀 수 있습니다.</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>

      <SearchModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  stickyHeader: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: Spacing.md, 
    paddingBottom: Spacing.md, 
    backgroundColor: '#00BFFF', 
    zIndex: 100 
  },
  iconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  iconBtnPlaceholder: { width: 44 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: 'white' },
  
  scrollContent: { padding: Spacing.md, paddingBottom: 100 },
  listSection: { gap: Spacing.md },
  
  regionCard: { 
    backgroundColor: 'white', 
    borderRadius: 20, 
    padding: 16, 
    borderWidth: 1, 
    borderColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  regionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333' },
  deleteIconBtn: { padding: 4 },
  regionAddress: { fontSize: 13, color: '#888', marginBottom: 16 },
  
  cardBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bodyLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  weatherIcon: { marginRight: 15 },
  tempCol: { alignItems: 'center' },
  tempLarge: { fontSize: 42, fontWeight: '300', color: '#333' },
  conditionTextSmall: { fontSize: 13, color: '#333', marginTop: -5 },
  
  bodyRight: { flex: 1, paddingLeft: 20, gap: 4 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, color: '#666', fontWeight: '500' },

  addCard: { 
    height: 180, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: '#E0E0E0', 
    borderStyle: 'dashed', 
    backgroundColor: 'white',
    justifyContent: 'center', 
    alignItems: 'center',
    marginTop: Spacing.sm
  },
  addBtnCircle: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    borderWidth: 1.5, 
    borderColor: '#CCC', 
    borderStyle: 'dashed',
    justifyContent: 'center', 
    alignItems: 'center',
    marginBottom: 15
  },
  addCardTitle: { fontSize: 14, fontWeight: '600', color: '#666', marginBottom: 4 },
  addCardSub: { fontSize: 12, color: '#AAA' },

  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { height: height * 0.85, backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: Spacing.lg },
  searchHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.xl },
  searchInputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F0F0', borderRadius: 20, paddingHorizontal: 12, height: 48 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '600', color: '#333' },
  closeBtn: { paddingVertical: 8 },
  closeBtnText: { fontSize: 15, fontWeight: '700', color: '#00BFFF' },
  searchResultWrap: { flex: 1 },
  resultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0', gap: 14 },
  resultTextCol: { flex: 1 },
  resultName: { fontSize: 16, fontWeight: '700', color: '#333' },
  resultSub: { fontSize: 13, color: '#888', marginTop: 2 },
  emptySearch: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  emptyText: { textAlign: 'center', fontSize: 14, color: '#AAA', fontWeight: '500' }
});

export default RegionManagementScreen;
