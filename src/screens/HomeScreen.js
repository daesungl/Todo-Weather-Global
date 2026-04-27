import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, StyleSheet, ScrollView, Dimensions, ToastAndroid, Alert, Platform, Modal, TextInput, ActivityIndicator, Animated, PanResponder, Pressable } from 'react-native';
import { TouchableOpacity, GestureHandlerRootView } from 'react-native-gesture-handler';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { useUnits } from '../contexts/UnitContext';
import { LinearGradient } from 'expo-linear-gradient';
import { Sun, Circle, Plus, MapPin, Calendar, MoreVertical, Wind, Droplets, Compass, Menu, Lock, Pencil, Settings, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle, Trash2, Search, X, Navigation, AlertTriangle, CloudSun, CloudMoon, Moon, Umbrella } from 'lucide-react-native';
import { Colors, Spacing, Typography } from '../theme';
import MenuModal from '../components/MenuModal';
import MainHeader from '../components/MainHeader';
import { getWeather } from '../services/weather/WeatherService';
import { getBookmarkedRegions, removeRegion, addRegion, saveBookmarkedRegions } from '../services/weather/RegionService';
import { searchPlaces } from '../services/weather/VWorldService';
import { searchLocations } from '../services/weather/GlobalService';

import { BANNER_UNIT_ID } from '../constants/AdUnits';
import AdBanner from '../components/AdBanner';
import { useSubscription } from '../contexts/SubscriptionContext';

const { width, height } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { formatTemp, formatWind } = useUnits();
  const [menuVisible, setMenuVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const currentPageRef = useRef(1);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const loadingPageRef = useRef(null);
  const regionsRef = useRef([]);
  const scrollViewRef = useRef(null);

  const { isPremium, limits } = useSubscription();

  const goToPage = (nextPage, direction) => {
    const dir = direction ?? (nextPage > currentPageRef.current ? -1 : 1);
    Animated.timing(slideAnim, {
      toValue: dir * width,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      slideAnim.setValue(-dir * width);
      currentPageRef.current = nextPage;
      setCurrentPage(nextPage);
      loadPageWeather(nextPage - 1, regionsRef.current);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }).start();
    });
  };

  const swipePanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) =>
        Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 30,
      onPanResponderMove: (_, gestureState) => {
        slideAnim.setValue(gestureState.dx * 0.4);
      },
      onPanResponderRelease: (_, gestureState) => {
        const page = currentPageRef.current;
        if (gestureState.dx < -50) {
          // 왼쪽 스와이프 → 다음 페이지 (5 → 1 순환)
          const next = page === 5 ? 1 : page + 1;
          goToPage(next, -1);
        } else if (gestureState.dx > 50) {
          // 오른쪽 스와이프 → 이전 페이지 (1 → 5 순환)
          const next = page === 1 ? 5 : page - 1;
          goToPage(next, 1);
        } else {
          Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
        }
      },
      // iOS에서 ScrollView 등 부모가 responder를 강제로 가져가는 경우 방지
      onPanResponderTerminationRequest: () => false,
      // 혹시 terminate 되더라도 원래 위치로 복귀
      onPanResponderTerminate: () => {
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

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

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      closeSearchModal();
      if (currentPageRef.current !== 1) goToPage(1, 1);
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    });
    return unsubscribe;
  }, [navigation]);

  // Real Regions Data
  const [regions, setRegions] = useState([]);
  const displayRegions = useMemo(() => {
    if (isPremium) return regions.map(r => ({ ...r, inactive: false }));
    return regions.map((r, i) => ({ ...r, inactive: i >= limits.regions }));
  }, [regions, isPremium, limits.regions]);
  const [regionsWeather, setRegionsWeather] = useState({});
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const modalPanY = useRef(new Animated.Value(height)).current;

  const openSearchModal = () => {
    setSearchModalVisible(true);
    Animated.spring(modalPanY, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }).start();
  };

  const closeSearchModal = () => {
    Animated.timing(modalPanY, { toValue: height, duration: 220, useNativeDriver: true }).start(() => {
      setSearchModalVisible(false);
      setSearchQuery('');
      setSearchResults([]);
      modalPanY.setValue(height);
    });
  };

  const modalPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
      onPanResponderMove: (_, g) => { if (g.dy > 0) modalPanY.setValue(g.dy); },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 100 || g.vy > 0.5) {
          closeSearchModal();
        } else {
          Animated.spring(modalPanY, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
        }
      },
    })
  ).current;

  // 화면 포커스 시마다 날씨 재조회 (낮에 캐시된 데이터가 밤에도 그대로 남는 문제 방지)
  useFocusEffect(
    useCallback(() => {
      fetchMainWeather();
      loadRegions();
    }, [])
  );

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

  const isKoreanQuery = (query) => /[가-힣]/.test(query);

  const performSearch = async (query) => {
    setIsSearching(true);
    try {
      // Run both domestic and global search concurrently
      const [domesticResults, globalResults] = await Promise.all([
        searchPlaces(query),
        searchLocations(query)
      ]);

      // 한국어 쿼리면 국내 결과 우선, 영어 쿼리면 글로벌 결과 우선
      const combined = isKoreanQuery(query)
        ? [...domesticResults, ...globalResults]
        : [...globalResults, ...domesticResults];
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

  const fetchRegionWeather = async (region) => {
    try {
      const w = await getWeather(region.lat, region.lon, false, region.id, region.address);
      setRegionsWeather(prev => ({ ...prev, [region.id]: w }));
    } catch (e) {
      console.error(`Failed to fetch weather for ${region.name}`, e);
    }
  };

  // 현재 페이지의 지역만 위에서 아래로 순차 로딩
  const loadPageWeather = async (pageIndex, regionList) => {
    loadingPageRef.current = pageIndex;
    const pageRegions = regionList.filter(r => r.pageIndex === pageIndex);
    for (const region of pageRegions) {
      if (loadingPageRef.current !== pageIndex) break; // 페이지 변경 시 중단
      await fetchRegionWeather(region);
    }
  };

  const loadRegions = async () => {
    try {
      const saved = await getBookmarkedRegions();

      let migrated = false;
      const processedData = saved.map((r, idx) => {
        if (r.pageIndex === undefined) {
          migrated = true;
          return { ...r, pageIndex: Math.floor(idx / 3) };
        }
        return r;
      });

      if (migrated) {
        await saveBookmarkedRegions(processedData);
      }

      regionsRef.current = processedData;
      setRegions(processedData);
      loadPageWeather(currentPageRef.current - 1, processedData);
    } catch (err) {
      console.error('loadRegions Error:', err);
    }
  };

  const handleDeleteRegion = (id) => {
    Alert.alert(
      t('common.confirm', '확인'),
      t('home.delete_region_confirm', '관심 지역에서 삭제하시겠습니까?'),
      [
        { text: t('common.cancel', '취소'), style: 'cancel' },
        {
          text: t('common.delete', '삭제'),
          style: 'destructive',
          onPress: async () => {
            const updated = await removeRegion(id);
            regionsRef.current = updated;
            setRegions(updated);
          }
        }
      ]
    );
  };

  const handleAddRegion = async (item) => {
    if (displayRegions.filter(r => !r.inactive).length >= limits.regions) {
      Alert.alert(
        t('common.info', '알림'),
        isPremium
          ? t('region.limit_premium', `최대 ${limits.regions}개 지역까지 추가할 수 있습니다.`)
          : t('region.limit_free', `무료 플랜은 최대 ${limits.regions}개까지 추가할 수 있습니다. 더 추가하려면 프리미엄을 이용해 주세요.`)
      );
      return;
    }

    // Check if the current page has space (limit 3)
    const pageIndex = currentPage - 1;
    const pageRegionsCount = regions.filter(r => r.pageIndex === pageIndex).length;

    if (pageRegionsCount >= 3) {
      Alert.alert(t('common.info', '알림'), t('home.region_limit_guide', '한 페이지당 최대 3개의 지역만 추가할 수 있습니다.'));
      return;
    }

    const updated = await addRegion(item.name, item.address, item.lat, item.lon, pageIndex);
    regionsRef.current = updated;
    setRegions(updated);
    const newest = updated[updated.length - 1];
    fetchRegionWeather(newest);
    setSearchModalVisible(false);
    setSearchQuery('');
    setSearchResults([]);
  };

  // tzOffsetMs 기반으로 condKey의 낮/밤을 실시간 교정
  const liveCondKey = (weatherObj) => {
    if (!weatherObj?.condKey) return weatherObj?.condKey;
    const now = new Date();
    let offsetMs;
    if (weatherObj.tzOffsetMs !== undefined) {
      offsetMs = weatherObj.tzOffsetMs;
    } else if (weatherObj.lon !== undefined) {
      offsetMs = Math.round(weatherObj.lon / 15) * 3600000;
    } else {
      return weatherObj.condKey;
    }
    const localHour = new Date(now.getTime() + offsetMs).getUTCHours();
    const isDay = localHour >= 6 && localHour < 18;
    const key = weatherObj.condKey;
    if (!isDay && (key === 'sunny' || key === 'clear' || key === 'mostly_sunny')) return 'clear_night';
    if (isDay && key === 'clear_night') return 'sunny';
    return key;
  };

  const renderWeatherIcon = (key, size = 64, color = Colors.primary, isDay = true) => {
    const strokeWidth = 2;
    switch (key) {
      case 'sunny':
      case 'clear':
        return isDay ? <Sun size={size} color="#FFD600" fill="#FFD600" /> : <Moon size={size} color="#A1C9FF" fill="#A1C9FF" />;
      case 'clear_night':
        return <Moon size={size} color="#A1C9FF" fill="#A1C9FF" />;
      case 'partly_cloudy':
      case 'mostly_sunny':
        return isDay ? <CloudSun size={size} color={color} strokeWidth={strokeWidth} /> : <CloudMoon size={size} color={color} strokeWidth={strokeWidth} />;
      case 'mostly_clear_night':
        return <CloudMoon size={size} color={color} strokeWidth={strokeWidth} />;
      case 'cloudy':
      case 'overcast':
        return <Cloud size={size} color={color} strokeWidth={strokeWidth} />;
      case 'rainy':
      case 'rain':
      case 'light_rain':
      case 'moderate_rain':
        return <CloudRain size={size} color={color} strokeWidth={strokeWidth} />;
      case 'snowy':
      case 'snow':
        return <CloudSnow size={size} color={color} strokeWidth={strokeWidth} />;
      case 'thunder':
      case 'lightning':
        return <CloudLightning size={size} color={color} strokeWidth={strokeWidth} />;
      default:
        return isDay ? <Sun size={size} color="#FFD600" fill="#FFD600" /> : <Moon size={size} color="#A1C9FF" fill="#A1C9FF" />;
    }
  };



  return (
    <View style={[styles.container, { paddingTop: Constants.statusBarHeight }]}>
      <MainHeader onMenuPress={() => setMenuVisible(true)} />

      <ScrollView ref={scrollViewRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <TouchableOpacity
          style={styles.heroSection}
          activeOpacity={0.9}
          onPress={() => currentWeather && navigation.navigate('WeatherDetail', { weatherData: currentWeather, isCurrentLocation: true })}
        >
          <View style={styles.weatherCard}>
            <LinearGradient
              colors={['#00BFFF', '#0095CC']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cardContent}
            >
              {loading ? (
                <View style={styles.skeletonContent}>
                  <Animated.View style={[styles.skeletonLocation, { opacity: pulseAnim }]} />
                  <View style={styles.skeletonMainRow}>
                    <Animated.View style={[styles.skeletonTemp, { opacity: pulseAnim }]} />
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.weatherTop}>
                    <View>
                      <View style={styles.locationContainer}>
                        <Navigation size={12} color="white" fill="white" />
                        <Text style={styles.labelWhite}>{t('weather.current_location')}</Text>
                      </View>
                      <Text style={styles.mainLocationText}>
                        {currentWeather?.locationName || '---'}
                      </Text>
                      {currentWeather?.locationAddress && (
                        <Text style={styles.mainAddressText} numberOfLines={1}>
                          {currentWeather.locationAddress}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.tempMainRow}>
                    <Text style={styles.heroTempBig}>{formatTemp(currentWeather?.temp)}</Text>
                    <View style={styles.heroVisualWrap}>
                      {renderWeatherIcon(liveCondKey(currentWeather), 100, "white", currentWeather?.isDay !== false)}
                    </View>
                  </View>

                  <View style={styles.heroBottom}>
                    <View style={styles.conditionBadge}>
                      <Text style={styles.conditionTextSmall}>
                        {currentWeather?.condKey ? t(`weather.${liveCondKey(currentWeather)}`) : t('common.loading')}
                      </Text>
                    </View>
                    <Text style={styles.highLowText}>
                      {t('common.high')} {currentWeather?.highTemp != null ? formatTemp(currentWeather.highTemp) : '--'} · {t('common.low')} {currentWeather?.lowTemp != null ? formatTemp(currentWeather.lowTemp) : '--'}
                    </Text>
                  </View>
                </>
              )}
            </LinearGradient>
          </View>
        </TouchableOpacity>

        {/* 프리미엄 여백 및 광고 통합 배너 */}
        <View style={styles.adBannerWrapper}>
          <AdBanner />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('home.interest_regions')}</Text>
        </View>

        <View style={styles.paginationArea} {...swipePanResponder.panHandlers}>
          <Animated.View style={[styles.regionsList, { transform: [{ translateX: slideAnim }] }]}>
            {(displayRegions || []).filter(r => r.pageIndex === currentPage - 1).map(region => {
              if (region.inactive) {
                return (
                  <View key={region.id} style={[styles.regionCard, { backgroundColor: Colors.surfaceContainerLow, borderWidth: 1, borderColor: Colors.outlineVariant, borderStyle: 'dashed' }]}>
                    <View style={styles.regionCardHeader}>
                      <View style={styles.regionNameContainer}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.regionNameText, { color: Colors.outline }]} numberOfLines={1}>{region.name}</Text>
                          {region.address && <Text style={[styles.regionAddressText, { color: Colors.outlineVariant }]} numberOfLines={1}>{region.address}</Text>}
                        </View>
                      </View>
                      <TouchableOpacity onPress={() => handleDeleteRegion(region.id)} style={styles.trashBtn}>
                        <Trash2 size={18} color={Colors.outlineVariant} />
                      </TouchableOpacity>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 }}>
                      <Lock size={16} color={Colors.outline} />
                      <Text style={{ fontSize: 13, color: Colors.outline }}>구독 해지로 비활성화 — 재구독 시 복원</Text>
                    </View>
                  </View>
                );
              }

              const weather = regionsWeather[region.id];
              return (
                <TouchableOpacity
                  key={region.id}
                  style={styles.regionCard}
                  onPress={() => {
                    if (weather) {
                      navigation.navigate('WeatherDetail', { weatherData: weather, isCurrentLocation: false, locationName: region.name, regionId: region.id, region: region });
                    }
                  }}
                >
                  {/* First Row: Name and Trash Icon */}
                  <View style={styles.regionCardHeader}>
                    <View style={styles.regionNameContainer}>
                      {weather?.alert && <AlertTriangle size={18} color="#E53935" fill="#FFEB3B" style={{ marginRight: 8 }} />}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.regionNameText} numberOfLines={1} ellipsizeMode="tail">
                          {region.name}
                        </Text>
                        {region.address && (
                          <Text style={styles.regionAddressText} numberOfLines={1} ellipsizeMode="tail">
                            {region.address}
                          </Text>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity onPress={() => handleDeleteRegion(region.id)} style={styles.trashBtn}>
                      <Trash2 size={18} color={Colors.outline} />
                    </TouchableOpacity>
                  </View>

                  {/* Second Row: Icon, Temp, and Metrics */}
                  <View style={styles.regionCardMain}>
                    <View style={styles.weatherInfoLeft}>
                      {weather ? (
                        renderWeatherIcon(liveCondKey(weather), 56, Colors.primary, weather?.isDay !== false)
                      ) : (
                        <ActivityIndicator size="small" color={Colors.outline} />
                      )}
                      <Text style={styles.regionTempText}>{formatTemp(weather?.temp)}</Text>
                    </View>

                    <View style={styles.metricsContainer}>
                      <View style={styles.metricRow}>
                        <Umbrella size={14} color={Colors.primary} />
                        <Text style={styles.metricLabelText}>{weather?.hourlyForecast?.[0]?.pop || '0%'}</Text>
                      </View>
                      <View style={styles.metricRow}>
                        <Umbrella size={14} color={(weather?.pcp && weather.pcp !== '0mm') ? Colors.primary : Colors.outline} />
                        <Text style={[styles.metricLabelText, { color: (weather?.pcp && weather.pcp !== '0mm') ? Colors.primary : Colors.outline }]}>{weather?.pcp || '0mm'}</Text>
                      </View>
                      <View style={styles.metricRow}>
                        <View style={{ transform: [{ rotate: `${(weather?.windDeg || 0) - 45}deg` }] }}>
                          <Navigation size={14} color={Colors.outline} />
                        </View>
                        <Text style={styles.metricLabelText}>{weather?.windSpeed ? formatWind(weather.windSpeed) : '--'}</Text>
                      </View>
                      <View style={styles.metricRow}>
                        <Droplets size={14} color={Colors.outline} />
                        <Text style={styles.metricLabelText}>{weather?.humidity || '0%'}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}

            {(displayRegions || []).filter(r => r.pageIndex === currentPage - 1).length < 3 && (
              <TouchableOpacity style={styles.addSlotCard} onPress={openSearchModal}>
                <View style={styles.addIconCircle}>
                  <Plus size={24} color={Colors.primary} strokeWidth={3} />
                </View>
                <Text style={styles.addSlotText}>{t('home.add_region')}</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>

        <View style={styles.pageIndicator}>
          {[1, 2, 3, 4, 5].map(num => (
            <TouchableOpacity
              key={num}
              onPress={() => goToPage(num)}
              style={[styles.indicatorCircle, currentPage === num && styles.activeIndicator]}
            >
              <Text style={[styles.indicatorText, currentPage === num && styles.activeIndicatorText]}>{num}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <MenuModal visible={menuVisible} onClose={() => setMenuVisible(false)} onReset={() => { fetchMainWeather(); loadRegions(); }} />

      <Modal animationType="none" transparent={true} visible={searchModalVisible} onRequestClose={closeSearchModal}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.5)' }]} onPress={closeSearchModal} />
          <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
            <Animated.View style={[styles.modalContent, { transform: [{ translateY: modalPanY }] }]}>
              <View {...modalPanResponder.panHandlers} style={styles.modalHandleArea}>
                <View style={styles.modalHandle} />
              </View>
              <View style={styles.searchHeader}>
                <View style={styles.searchInputWrap}>
                  <Search size={20} color={Colors.outline} style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder={t('search.placeholder')}
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
                <TouchableOpacity onPress={closeSearchModal}>
                  <Text style={styles.closeBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.searchResultWrap} keyboardShouldPersistTaps="handled">
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
                        <Text style={styles.emptyText}>{t('search.no_results')}</Text>
                      </View>
                    ) : (
                      <View style={styles.emptySearch}>
                        <Search size={48} color="#EEE" />
                        <Text style={styles.emptyText}>{t('search.guide')}</Text>
                      </View>
                    )}
                  </>
                )}
              </ScrollView>
            </Animated.View>
          </View>
        </GestureHandlerRootView>
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
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    height: 60,
  },
  headerIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    ...Typography.h2,
    fontSize: 20,
    letterSpacing: -0.2,
    color: Colors.text,
  },
  heroSection: {
    marginBottom: 4,
    marginTop: 10,
  },
  weatherCard: {
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  cardContent: {
    padding: 24,
    minHeight: 220,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  labelWhite: {
    ...Typography.label,
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    letterSpacing: 0.5,
  },
  mainLocationText: {
    fontSize: 28,
    fontWeight: '800',
    color: 'white',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  mainAddressText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  tempMainRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
  },
  heroTempBig: {
    fontSize: 88,
    fontWeight: '800',
    color: 'white',
    letterSpacing: -3,
    marginLeft: -4,
  },
  adBannerWrapper: {
    marginVertical: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroVisualWrap: {
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 'auto',
  },
  conditionBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  conditionTextSmall: {
    fontSize: 15,
    fontWeight: '800',
    color: 'white',
  },
  highLowText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    ...Typography.h3,
    fontSize: 22,
  },
  paginationArea: {
    minHeight: 100,
    overflow: 'hidden',
  },
  regionsList: {
    gap: 10,
  },
  regionCard: {
    backgroundColor: Colors.surfaceContainerLowest,
    padding: 24,
    borderRadius: 32,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
    marginBottom: 0,
  },
  regionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  regionNameContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  regionNameText: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  regionAddressText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  trashBtn: {
    padding: 4,
  },
  regionCardMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weatherInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  regionTempText: {
    fontSize: 52,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -2,
  },
  metricsContainer: {
    alignItems: 'flex-start',
    gap: 4,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 75,
  },
  metricLabelText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.outline,
    flex: 1,
    textAlign: 'right',
  },
  addSlotCard: {
    height: 140,
    borderRadius: 32,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.outlineVariant,
    backgroundColor: 'rgba(0, 191, 255, 0.02)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  addIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addSlotText: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
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
    marginTop: 40,
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
  modalHandleArea: { alignItems: 'center', paddingTop: 4, paddingBottom: 12 },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.outlineVariant, borderRadius: 2, opacity: 0.5 },
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
  adBannerWrapper: {
    marginVertical: 12,
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    minHeight: 50,
    paddingVertical: 2,
  },
  adBadge: {
    position: 'absolute',
    top: 4,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    zIndex: 10,
  },
  adBadgeText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

export default HomeScreen;
