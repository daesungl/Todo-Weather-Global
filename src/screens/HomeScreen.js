import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, ToastAndroid, Alert, Platform, Modal, TextInput, ActivityIndicator, Animated } from 'react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { LinearGradient } from 'expo-linear-gradient';
import { Sun, CheckCircle2, Circle, Plus, MapPin, Calendar, MoreVertical, Wind, Droplets, Compass, Menu, Lock, Pencil, Settings, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, Trash2, Search, X } from 'lucide-react-native';
import { Colors, Spacing, Typography } from '../theme';
import MenuModal from '../components/MenuModal';
import { getWeather } from '../services/weather/WeatherService';
import { getBookmarkedRegions, removeRegion, addRegion } from '../services/weather/RegionService';
import { searchPlaces } from '../services/weather/VWorldService';
import { searchLocations } from '../services/weather/GlobalService';

const { width, height } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [menuVisible, setMenuVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  // Pulse animation for skeleton loading
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
  
  // Real Regions Data
  const [regions, setRegions] = useState([]);
  const [regionsWeather, setRegionsWeather] = useState({});
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Initial load
  useEffect(() => {
    fetchMainWeather();
    loadRegions();
  }, [currentPage]);

  // Search Debounce logic
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        performSearch(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const performSearch = async (query) => {
    setIsSearching(true);
    try {
      // Run both domestic and global search concurrently
      const [domesticResults, globalResults] = await Promise.all([
        searchPlaces(query),
        searchLocations(query)
      ]);

      // Merge and deduplicate if necessary, but here we just combine
      const combined = [...domesticResults, ...globalResults];
      setSearchResults(combined);
    } catch (e) {
      console.error('Search Error:', e);
    } finally {
      setIsSearching(false);
    }
  };

  const fetchMainWeather = async () => {
    setLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 37.5665;
      let lon = 126.9780;

      if (status === 'granted') {
        const lastLocation = await Location.getLastKnownPositionAsync({});
        if (lastLocation) {
          lat = lastLocation.coords.latitude;
          lon = lastLocation.coords.longitude;
        } else {
          const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = location.coords.latitude;
          lon = location.coords.longitude;
        }
      }
      const data = await getWeather(lat, lon);
      setCurrentWeather(data);
    } catch (err) {
      console.error('Initial Weather Fetch Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRegions = async () => {
    try {
      const saved = await getBookmarkedRegions();
      setRegions(saved);
      
      // Fetch weather sequentially to prevent Public Data Portal API 429 Too Many Requests
      const weatherMap = {};
      for (const region of saved) {
        try {
          const w = await getWeather(region.lat, region.lon, false, region.id, region.address);
          weatherMap[region.id] = w;
        } catch (e) {
          console.error(`Failed to fetch weather for ${region.name}`, e);
        }
      }
      setRegionsWeather(prev => ({ ...prev, ...weatherMap }));
    } catch (err) {
      console.error('loadRegions Error:', err);
    }
  };

  const handleDeleteRegion = async (id) => {
    const updated = await removeRegion(id);
    setRegions(updated);
    // No need to reload everything, just let the next render handle it or call loadRegions asynchronously
    loadRegions();
  };

  const handleAddRegion = async (place) => {
    const updated = await addRegion(place.name, place.address, place.lat, place.lon);
    setRegions(updated);
    setSearchModalVisible(false);
    setSearchQuery('');
    setSearchResults([]);
    loadRegions();
  };

  const isPremium = false;

  const renderMainWeatherIcon = (condKey) => {
    const size = 115;
    const color = "white";
    const strokeWidth = 1.2;
    const style = { opacity: 0.95 };

    switch (condKey) {
      case 'sunny':
      case 'clear':
        return <Sun size={size} color={color} strokeWidth={strokeWidth} style={style} />;
      case 'rainy':
      case 'rain':
      case 'light_rain':
      case 'moderate_rain':
        return <CloudRain size={size} color={color} strokeWidth={strokeWidth} style={style} />;
      case 'snowy':
      case 'snow':
        return <CloudSnow size={size} color={color} strokeWidth={strokeWidth} style={style} />;
      case 'thunder':
      case 'lightning':
        return <CloudLightning size={size} color={color} strokeWidth={strokeWidth} style={style} />;
      case 'cloudy':
      case 'overcast':
        return <Cloud size={size} color={color} strokeWidth={strokeWidth} style={style} />;
      case 'partly_cloudy':
      case 'mostly_sunny':
        return (
          <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <Sun size={size * 0.8} color={color} strokeWidth={strokeWidth} style={style} />
            <Cloud size={size * 0.6} color="rgba(255,255,255,0.8)" style={{ position: 'absolute', bottom: 10, right: -5 }} />
          </View>
        );
      default:
        return <Sun size={size} color={color} strokeWidth={strokeWidth} style={style} />;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Constants.statusBarHeight }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.headerIcon}>
            <Menu size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Todo Weather</Text>
          <View style={styles.headerIcon} />
        </View>

        <TouchableOpacity 
          style={styles.heroSection}
          activeOpacity={0.85}
          onPress={() => {
            if (loading || !currentWeather) return;
            navigation.navigate('WeatherDetail', { weatherData: currentWeather, isCurrentLocation: true });
          }}
        >
          <LinearGradient colors={['#00B4DB', '#0083B0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.weatherCard}>
            {loading ? (
                <View style={styles.skeletonContent}>
                    <Animated.View style={[styles.skeletonFloatingIcon, { opacity: pulseAnim }]} />
                    <Animated.View style={[styles.skeletonLocation, { opacity: pulseAnim }]} />
                    <View style={styles.skeletonMainRow}>
                        <Animated.View style={[styles.skeletonTemp, { opacity: pulseAnim }]} />
                        <View style={styles.skeletonMetaColumn}>
                            <Animated.View style={[styles.skeletonTextLine, { opacity: pulseAnim, marginBottom: 8 }]} />
                            <Animated.View style={[styles.skeletonTextLine, { opacity: pulseAnim, width: 60 }]} />
                        </View>
                    </View>
                </View>
            ) : (
              <View style={styles.cardContent}>
                  <View style={styles.backgroundWeatherIcon}>
                    {renderMainWeatherIcon(currentWeather?.condKey || 'sunny')}
                  </View>
                  <View style={styles.weatherTop}>
                    <View style={{ flex: 1, zIndex: 10 }}>
                      <View style={styles.locationContainer}>
                        <MapPin size={18} color="white" />
                        <Text style={styles.mainLocationText}>
                          {(currentWeather?.locationName || 'Seoul').split(' ')[1] || (currentWeather?.locationName || 'Seoul').split(' ')[0]}
                        </Text>
                      </View>
                      <View style={styles.tempMainRow}>
                         <Text style={styles.heroTempBig}>{parseInt(currentWeather?.temp) || '--'}°</Text>
                         <View style={styles.weatherVerticalMeta}>
                            <Text style={styles.conditionTextBold}>{currentWeather?.condKey ? t(`weather.${currentWeather.condKey}`) : t('common.loading')}</Text>
                            <Text style={styles.humidityTextSmall}>{t('common.humidity')} {currentWeather?.humidity || '--%'}</Text>
                         </View>
                      </View>
                    </View>
                  </View>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
           <Text style={Typography.h3}>{t('home.interest_regions')}</Text>
        </View>

        <View style={styles.paginationArea}>
            <View style={styles.regionsList}>
              {/* Pagination logic: Page 1 (index 0,1,2), Page 2 (3,4,5), etc. */}
              {regions.slice((currentPage - 1) * 3, currentPage * 3).map(region => (
                <TouchableOpacity 
                  key={region.id} 
                  style={styles.regionCard}
                  onPress={() => {
                    if (!regionsWeather[region.id]) {
                      if (Platform.OS === 'android') {
                        ToastAndroid.show('날씨 데이터를 불러오는 중입니다. 잠시만 기다려주세요.', ToastAndroid.SHORT);
                      } else {
                        Alert.alert('안내', '날씨 데이터를 여전히 불러오는 중입니다. 잠시만 기다려주세요.');
                      }
                      return;
                    }
                    navigation.navigate('WeatherDetail', { weatherData: regionsWeather[region.id], isCurrentLocation: false, locationName: region.name, regionId: region.id });
                  }}
                >
                   <View style={{ flex: 1 }}>
                     <View style={styles.regionMain}>
                       <Text style={styles.regionName}>{region.name}</Text>
                     </View>
                     <Text style={styles.regionCond}>
                       {regionsWeather[region.id] ? t(`weather.${regionsWeather[region.id].condKey}`) : t('common.loading')}
                     </Text>
                   </View>
                   <View style={styles.regionWeather}>
                     <Text style={styles.regionTemp}>{regionsWeather[region.id]?.temp || '--'}</Text>
                   </View>
                   <TouchableOpacity onPress={() => handleDeleteRegion(region.id)} style={styles.deleteBtn}>
                      <Trash2 size={18} color={Colors.outline} />
                   </TouchableOpacity>
                </TouchableOpacity>
              ))}
              
              {/* Add New Slot Button (if page has room or just always at the end of last filled page) */}
              {regions.length < (currentPage * 3) && (
                <TouchableOpacity style={styles.addSlotCard} onPress={() => setSearchModalVisible(true)}>
                   <Plus size={24} color={Colors.outline} />
                   <Text style={styles.addSlotText}>지역 추가하기</Text>
                </TouchableOpacity>
              )}

              {currentPage > 1 && !isPremium && regions.length < (currentPage - 1) * 3 && (
                <View style={styles.lockedContainer}>
                   <Lock size={32} color={Colors.outlineVariant} />
                   <Text style={styles.lockedText}>{t('home.locked_slot_guide')}</Text>
                </View>
              )}
            </View>
        </View>

        <View style={styles.pageIndicator}>
           {[1, 2, 3].map(num => (
             <TouchableOpacity key={num} onPress={() => setCurrentPage(num)} style={[styles.indicatorCircle, currentPage === num && styles.activeIndicator]}>
                <Text style={[styles.indicatorText, currentPage === num && styles.activeIndicatorText]}>{num}</Text>
             </TouchableOpacity>
           ))}
        </View>

        <TouchableOpacity style={styles.briefingCard} onPress={() => navigation.navigate('Tasks')}>
          <View style={styles.briefIconWrap}>
            <CheckCircle2 size={24} color={Colors.primary} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={Typography.body}>You have 3 tasks today</Text>
            <Text style={Typography.bodySmall}>Next: Global UI Review at 10:00 AM</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.bottomNavContainer}>
        <View style={styles.glassNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Weather')}>
            <View style={styles.activeDot} />
            <Sun size={28} color={Colors.primary} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Tasks')}>
            <CheckCircle2 size={28} color={Colors.outline} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Flow')}>
            <Compass size={28} color={Colors.outline} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <MenuModal visible={menuVisible} onClose={() => setMenuVisible(false)} onReset={() => { fetchMainWeather(); loadRegions(); }} />
      
      {/* Search Modal - Inline to maintain identity/focus */}
      <Modal animationType="slide" transparent={true} visible={searchModalVisible} onRequestClose={() => setSearchModalVisible(false)}>
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
            
            <ScrollView style={styles.searchResultWrap}>
               {isSearching ? (
                 <ActivityIndicator size="small" color={Colors.primary} style={{ marginTop: 20 }} />
               ) : (
                 <>
                   {searchResults.length > 0 ? (
                     searchResults.map((item) => (
                       <TouchableOpacity key={item.id} style={styles.resultItem} onPress={() => handleAddRegion(item)}>
                         <MapPin size={18} color={item.type === 'domestic' ? Colors.primary : Colors.outline} />
                         <View style={styles.resultTextCol}>
                           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                             <Text style={styles.resultName}>{item.name}</Text>
                             <View style={[styles.typeBadge, { backgroundColor: item.type === 'domestic' ? '#E3F2FD' : '#F5F5F5' }]}>
                               <Text style={[styles.typeBadgeText, { color: item.type === 'domestic' ? '#1976D2' : '#666' }]}>
                                 {t(item.category)}
                               </Text>
                             </View>
                           </View>
                           <Text style={styles.resultSub}>{item.address}</Text>
                         </View>
                       </TouchableOpacity>
                     ))
                   ) : searchQuery.length >= 2 ? (
                     <View style={styles.emptySearch}>
                        <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>
                     </View>
                   ) : (
                      <View style={styles.emptySearch}>
                        <Search size={48} color="#EEE" />
                        <Text style={styles.emptyText}>추가할 지역을 검색하세요.</Text>
                      </View>
                   )}
                 </>
               )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 130,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  headerTitle: {
    ...Typography.h2,
    fontSize: 20,
    color: Colors.text,
  },
  headerIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSection: {
    marginBottom: Spacing.xl,
  },
  weatherCard: {
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.15,
    shadowRadius: 25,
    elevation: 10,
  },
  cardContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  weatherTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  mainLocationText: {
    fontSize: 22,
    fontWeight: '800',
    color: 'white',
    letterSpacing: -0.5,
  },
  tempMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroTempBig: {
    fontSize: 76,
    fontWeight: '900',
    color: 'white',
    letterSpacing: -3,
  },
  weatherVerticalMeta: {
    justifyContent: 'center',
    marginTop: 6,
  },
  conditionTextBold: {
    fontSize: 22,
    fontWeight: '800',
    color: 'white',
  },
  humidityTextSmall: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: '600',
    marginTop: 1,
  },
  heroVisualWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: -10,
  },
  backgroundWeatherIcon: {
    position: 'absolute',
    right: 0,
    top: 15, // 아래에서 위로 끌어올림
    zIndex: 1,
    opacity: 0.85,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg, // Match with regionCard's internal padding
  },
  slotGuide: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  editIconBtn: {
    padding: 8,
    marginRight: 2, // Precisely align with weather icons in cards below
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationArea: {
    minHeight: 100, // Reduced significantly after removing slots
    marginBottom: Spacing.lg,
  },
  regionsList: {
    gap: 10,
  },
  regionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.lg,
    borderRadius: 24,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  dragHandleWrap: {
    gap: 3,
  },
  dotGrid: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.outlineVariant,
  },
  regionMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  regionName: {
    ...Typography.h3,
    fontSize: 18,
  },

  // Skeleton Styles
  skeletonContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    height: 140, // Match typical card height
    justifyContent: 'center',
  },
  skeletonLocation: {
    width: 80,
    height: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 6,
    marginBottom: 12,
  },
  skeletonMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  skeletonTemp: {
    width: 100,
    height: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 12,
  },
  skeletonMetaColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  skeletonTextLine: {
    width: 100,
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 4,
  },
  skeletonFloatingIcon: {
    position: 'absolute',
    right: 20,
    top: 20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  widgetBadge: {
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  widgetText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  regionCond: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  regionWeather: {
    alignItems: 'center',
    gap: 4,
  },
  regionTemp: {
    ...Typography.h3,
    fontSize: 20,
  },
  addSlotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.outlineVariant,
    gap: Spacing.md,
    backgroundColor: 'rgba(0, 191, 255, 0.02)',
  },
  addSlotText: {
    ...Typography.body,
    color: Colors.outline,
    fontWeight: '600',
  },
  emptySlotCard: {
    height: 56,
    borderRadius: 20,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.5,
  },
  lockedContainer: {
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    gap: 12,
  },
  lockedText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  premiumBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.primary,
    borderRadius: 16,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: 'white',
  },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginBottom: Spacing.xxl,
  },
  indicatorCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeIndicator: {
    backgroundColor: Colors.primary,
  },
  indicatorText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.outline,
  },
  activeIndicatorText: {
    color: 'white',
  },
  briefingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: 'white',
    borderRadius: 28,
    gap: Spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 20,
    marginBottom: Spacing.md,
  },
  briefIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  deleteBtn: {
    padding: 8,
    marginLeft: 4,
  },
  
  // Modal Styles
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { 
    height: height * 0.8, 
    backgroundColor: Colors.background, 
    borderTopLeftRadius: 32, 
    borderTopRightRadius: 32, 
    padding: Spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  searchHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.xl },
  searchInputWrap: { 
    flex: 1, 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: Colors.surfaceContainerLow, 
    borderRadius: 20, 
    paddingHorizontal: 12, 
    height: 48 
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  closeBtn: { paddingVertical: 8 },
  closeBtnText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  searchResultWrap: { flex: 1 },
  resultItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 16, 
    borderBottomWidth: 1, 
    borderBottomColor: Colors.outlineVariant, 
    gap: 14 
  },
  resultTextCol: { flex: 1 },
  resultName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  resultSub: { fontSize: 13, color: Colors.outline, marginTop: 2 },
  emptySearch: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, marginTop: 40 },
  emptyText: { textAlign: 'center', fontSize: 14, color: Colors.outline, fontWeight: '500' },

  bottomNavContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  glassNav: {
    width: width * 0.75,
    height: 64,
    backgroundColor: Colors.glass,
    borderRadius: 32,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  navItem: {
    padding: 10,
    alignItems: 'center',
  },
  activeDot: {
    position: 'absolute',
    top: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  },
});

export default HomeScreen;
