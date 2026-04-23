import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Animated,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Keyboard,
  PanResponder,
  FlatList,
} from 'react-native';
import { GestureHandlerRootView, TouchableOpacity } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { 
  Plus, 
  MapPin, 
  Calendar, 
  CloudRain, 
  Sun, 
  Wind,
  ChevronLeft,
  MoreVertical,
  Navigation2,
  Search,
  X,
  Navigation,
  Trash2,
  Clock,
  CloudSun,
  CloudMoon,
  Moon,
  CloudSnow,
  CloudLightning,
  Cloud,
  Check,
  AlertTriangle,
  Edit3,
  ChevronDown,
  ChevronRight,
  AlignLeft,
  FileText
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, Typography } from '../theme';
import MenuModal from '../components/MenuModal';
import MainHeader from '../components/MainHeader';
import WeatherService from '../services/weather/WeatherService';
import { searchLocations } from '../services/weather/GlobalService';
import { searchPlaces as searchDomesticPlaces } from '../services/weather/VWorldService';
import { getFlows, saveFlows, addFlow, deleteFlow } from '../services/FlowService';

const { width, height } = Dimensions.get('window');
const ITEM_HEIGHT = 50;
const YEARS = Array.from({ length: 21 }, (_, i) => 2020 + i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const FlowScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState(null);
  
  const [flows, setFlows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search Modal State
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState('flow'); // 'flow' or 'step'

  // Edit Step State
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [editTime, setEditTime] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editActivity, setEditActivity] = useState('');
  const [editMemo, setEditMemo] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Flow Create/Edit State
  const [flowModalVisible, setFlowModalVisible] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null);
  const [flowTitle, setFlowTitle] = useState('');
  const [flowLocation, setFlowLocation] = useState('');
  const [flowAddress, setFlowAddress] = useState('');
  const [flowLat, setFlowLat] = useState(null);
  const [flowLon, setFlowLon] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [memoModalVisible, setMemoModalVisible] = useState(false);
  const [heroWeather, setHeroWeather] = useState(null);
  const panY = useRef(new Animated.Value(0)).current;

  // --- Initialization ---
  useEffect(() => {
    loadInitialData();
    
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          closeEditModal();
        } else {
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 8,
          }).start();
        }
      },
    })
  ).current;

  const closeEditModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.timing(panY, {
      toValue: height,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setEditModalVisible(false);
      panY.setValue(0);
    });
  };

  const loadInitialData = async () => {
    setIsLoading(true);
    const savedFlows = await getFlows();
    if (savedFlows.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
      
      const sample = {
        id: 'sample-1',
        title: 'Welcome to Flow',
        period: 'Multi-day Planning',
        location: 'Dream Destination',
        progress: 0.3,
        gradient: ['#6366f1', '#a855f7'],
        weatherSummary: 'Curated multi-day planning',
        lat: 37.5665,
        lon: 126.9780,
        steps: [
          { id: 's1', date: today, time: '10:00', activity: 'Arrival & Coffee', status: 'completed' },
          { id: 's2', date: today, time: '14:00', activity: 'Hotel Check-in', status: 'current' },
          { id: 's3', date: tomorrow, time: '09:00', activity: 'City Tour Start', status: 'upcoming' }
        ]
      };
      setFlows([sample]);
    } else {
      setFlows(savedFlows);
    }
    setIsLoading(false);
  };

  // --- Search Logic ---
  const isKoreanQuery = (query) => /[가-힣]/.test(query);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) handleSearch(searchQuery);
      else setSearchResults([]);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSearch = async (query) => {
    setIsSearching(true);
    try {
      const [dom, glo] = await Promise.all([searchDomesticPlaces(query), searchLocations(query)]);
      setSearchResults(isKoreanQuery(query) ? [...dom, ...glo] : [...glo, ...dom]);
    } catch (e) { console.error(e); }
    finally { setIsSearching(false); }
  };

  const handleSelection = async (item) => {
    if (searchMode === 'flow') {
      setFlowLocation(item.name);
      setFlowAddress(item.address || item.addressName || '');
      setFlowLat(item.lat);
      setFlowLon(item.lon);
      if (!flowTitle) setFlowTitle(`${item.name} Trip`);
    } else {
      setEditActivity(item.name);
      setSelectedRegion(item);
    }
    setSearchModalVisible(false);
  };

  const fetchHeroWeather = async (flow) => {
    if (flow && flow.lat && flow.lon) {
      // regionId = 장소명(캐시키), providedAddress = 상세주소(addressName 저장용)
      const weather = await WeatherService.getWeather(flow.lat, flow.lon, false, flow.location, flow.address || '');
      setHeroWeather(weather);
    } else {
      setHeroWeather(null);
    }
  };

  useEffect(() => {
    if (selectedFlow) {
      fetchHeroWeather(selectedFlow);
    }
  }, [selectedFlow]);

  const saveFlow = async () => {
    if (!flowTitle.trim()) {
      Alert.alert("Title Required", "Please enter a title for this journey.");
      return;
    }

    setIsSearching(true);
    try {
      let weatherSummary = 'Weather not set';
      if (flowLat && flowLon) {
        const weather = await WeatherService.getWeather(flowLat, flowLon, false, flowLocation, flowLocation);
        const tempText = weather?.temp ? (String(weather.temp).includes('°') ? weather.temp : `${weather.temp}°`) : '--°';
        const condText = weather?.conditionText || 'Cloudy';
        weatherSummary = `Currently ${tempText}, ${condText}`;
      }

      const updatedFlows = editingFlow 
        ? flows.map(f => f.id === editingFlow.id ? { ...f, title: flowTitle, location: flowLocation, address: flowAddress, lat: flowLat, lon: flowLon, weatherSummary } : f)
        : await addFlow({
            id: Date.now().toString(),
            title: flowTitle,
            period: 'Multi-day Planning',
            location: flowLocation || 'No Region',
            address: flowAddress || '',
            progress: 0,
            gradient: getRandomGradient(),
            weatherSummary: weatherSummary,
            lat: flowLat,
            lon: flowLon,
            steps: []
          });

      if (editingFlow) {
        setFlows(updatedFlows);
        await saveFlows(updatedFlows);
        
        // 상세 화면 동기화: 현재 보고 있는 여정이 수정되었다면 해당 상태도 업데이트
        if (selectedFlow && selectedFlow.id === editingFlow.id) {
          const updatedSelected = updatedFlows.find(f => f.id === editingFlow.id);
          if (updatedSelected) {
            setSelectedFlow(updatedSelected);
          }
        }
      } else {
        setFlows(updatedFlows);
      }
      setFlowModalVisible(false);
    } catch (e) { console.error(e); }
    finally { setIsSearching(false); }
  };

  // --- Step Logic ---
  const saveStep = async () => {
    if (!editTime.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      Alert.alert("Invalid Time", "Please use HH:mm format");
      return;
    }
    
    setIsSearching(true);
    try {
      let weatherData = null;
      let hasWarning = false;
      
      const hasFlowRegion = selectedFlow.lat && selectedFlow.lon && selectedFlow.location && selectedFlow.location !== 'No Region';
      const targetLat = selectedRegion ? selectedRegion.lat : null;
      const targetLon = selectedRegion ? selectedRegion.lon : null;
      const targetName = selectedRegion ? selectedRegion.name : null;

      if (targetLat && targetLon) {
        const weather = await WeatherService.getWeather(targetLat, targetLon, false, targetName, targetName);
        const weatherKey = weather ? weather.condKey : null;
        const weatherIsDay = weather ? (weather.isDay !== false) : true;
        hasWarning = weather && (weather.condKey === 'rainy' || weather.condKey === 'thunderstorm');
        
        // Store weather as an object to include isDay
        weatherData = { condKey: weatherKey, isDay: weatherIsDay };
      }

      const updatedFlows = flows.map(f => {
        if (f.id === selectedFlow.id) {
          const updatedSteps = editingStep 
            ? f.steps.map(s => s.id === editingStep.id ? { ...s, time: editTime, date: editDate, activity: editActivity, memo: editMemo, region: selectedRegion, weather: weatherData, warning: hasWarning, lat: targetLat, lon: targetLon } : s)
            : [...(f.steps || []), { id: Date.now().toString(), date: editDate, time: editTime, activity: editActivity, memo: editMemo, region: selectedRegion, status: 'upcoming', weather: weatherData, warning: hasWarning, lat: targetLat, lon: targetLon }];
          
          const sorted = sortSteps(updatedSteps);
          const updatedF = { ...f, steps: sorted };
          setSelectedFlow(updatedF);
          return updatedF;
        }
        return f;
      });

      setFlows(updatedFlows);
      await saveFlows(updatedFlows);
      closeEditModal();
    } catch (e) { 
      console.error(e); 
    } finally { 
      setIsSearching(false); 
    }
  };

  const deleteStep = async () => {
    const updatedFlows = flows.map(f => {
      if (f.id === selectedFlow.id) {
        const updatedSteps = f.steps.filter(s => s.id !== editingStep.id);
        const updatedF = { ...f, steps: updatedSteps };
        setSelectedFlow(updatedF);
        return updatedF;
      }
      return f;
    });
    setFlows(updatedFlows);
    await saveFlows(updatedFlows);
    setEditModalVisible(false);
  };

  const sortSteps = (steps) => {
    return [...steps].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });
  };

  const groupStepsByDate = (steps) => {
    if (!steps) return {};
    return steps.reduce((acc, step) => {
      if (!acc[step.date]) acc[step.date] = [];
      acc[step.date].push(step);
      return acc;
    }, {});
  };

  const formatDateLabel = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
    } catch (e) { return dateStr; }
  };

  const openSearch = (mode) => { setSearchMode(mode); setSearchModalVisible(true); };
  const closeSearch = () => { setSearchModalVisible(false); setSearchQuery(''); setSearchResults([]); };

  const openFlowModal = (flow = null) => {
    setEditingFlow(flow);
    setFlowTitle(flow ? flow.title : '');
    setFlowLocation(flow ? flow.location : '');
    setFlowAddress(flow ? (flow.address || '') : '');
    setFlowLat(flow ? flow.lat : null);
    setFlowLon(flow ? flow.lon : null);
    panY.setValue(0);
    setFlowModalVisible(true);
  };

  const openEditStep = (step) => {
    setEditingStep(step);
    setEditTime(step.time);
    setEditDate(step.date);
    setEditActivity(step.activity);
    setEditMemo(step.memo || '');
    setSelectedRegion(step.region || null);
    setShowDatePicker(false);
    setShowTimePicker(false);
    panY.setValue(0);
    setEditModalVisible(true);
  };

  const handleDeleteFlow = (id) => {
    Alert.alert("Delete Flow", "Delete this journey?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          const updated = await deleteFlow(id);
          setFlows(updated);
          if (selectedFlow?.id === id) setSelectedFlow(null);
        }
      }
    ]);
  };

  const getRandomGradient = () => {
    const palette = [
      ['#6366f1', '#a855f7'], // Indigo-Purple
      ['#0ea5e9', '#22d3ee'], // Sky-Cyan
      ['#f43f5e', '#fb7185'], // Rose-Pink
      ['#10b981', '#34d399'], // Emerald-Green
      ['#f59e0b', '#fbbf24'], // Amber-Yellow
      ['#8b5cf6', '#d946ef'], // Violet-Fuchsia
      ['#3b82f6', '#2dd4bf'], // Blue-Teal
      ['#f97316', '#facc15'], // Orange-Yellow
      ['#ec4899', '#f43f5e'], // Pink-Rose
      ['#64748b', '#94a3b8'], // Slate-BlueGray
    ];

    // 현재 사용 중인 그라데이션들을 추출
    const usedGradients = (flows || []).map(f => JSON.stringify(f.gradient));
    
    // 사용되지 않은 색상들 필터링
    const unusedPalette = palette.filter(g => !usedGradients.includes(JSON.stringify(g)));
    
    // 만약 모든 색상이 사용 중이라면 전체 팔레트에서 선택, 아니면 미사용 팔레트에서 선택
    const targetPalette = unusedPalette.length > 0 ? unusedPalette : palette;
    return targetPalette[Math.floor(Math.random() * targetPalette.length)];
  };

  const renderWeatherIcon = (key, size = 20, color = Colors.primary, isDay = true) => {
    const moonColor = "#A1C9FF";
    switch (key) {
      case 'sunny': 
      case 'clear': 
        return isDay ? <Sun size={size} color="#f59e0b" /> : <Moon size={size} color={moonColor} />;
      case 'clear_night': 
        return <Moon size={size} color={moonColor} />;
      case 'partly_cloudy': 
      case 'mostly_sunny': 
        return isDay ? <CloudSun size={size} color={color} /> : <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}><Moon size={size * 0.8} color={moonColor} /><Cloud size={size * 0.9} color="#94a3b8" style={{ position: 'absolute', bottom: -2, right: -2 }} /></View>;
      case 'cloudy': case 'overcast': return <Cloud size={size} color={color} />;
      case 'rainy': case 'rain': return <CloudRain size={size} color="#3b82f6" />;
      case 'snowy': case 'snow': return <CloudSnow size={size} color="#94a3b8" />;
      case 'thunderstorm': case 'lightning': return <CloudLightning size={size} color="#E53935" />;
      default: return isDay ? <Sun size={size} color="#f59e0b" /> : <Moon size={size} color={moonColor} />;
    }
  };

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (selectedDate) {
      setEditDate(selectedDate.toISOString().split('T')[0]);
    }
  };

  const onTimeChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (selectedDate) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      setEditTime(`${hours}:${minutes}`);
    }
  };

  // --- Render Timeline Detail ---
  const groupedSteps = groupStepsByDate(selectedFlow?.steps);
  const sortedDates = Object.keys(groupedSteps).sort();

  const renderTimelineDetail = () => (
    <View style={styles.detailContainer}>
      <View style={styles.detailHeader}>
        <TouchableOpacity onPress={() => setSelectedFlow(null)} style={styles.iconBtn}><ChevronLeft size={24} color={Colors.onBackground} /></TouchableOpacity>
        <Text style={styles.detailHeaderTitle} numberOfLines={1}>{selectedFlow.title}</Text>
        <TouchableOpacity style={styles.iconBtn} onPress={() => openFlowModal(selectedFlow)}><MoreVertical size={20} color={Colors.onBackground} /></TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
        <View style={styles.heroSection}>
          <Text style={styles.heroDate}>{selectedFlow.period}</Text>
          {selectedFlow.location && selectedFlow.location !== 'No Region' && (
            <TouchableOpacity 
              style={styles.heroLocationRow}
              onPress={() => navigation.navigate('WeatherDetail', { 
                region: { 
                  name: selectedFlow.location, 
                  address: selectedFlow.address || '',
                  lat: parseFloat(selectedFlow.lat), 
                  lon: parseFloat(selectedFlow.lon) 
                } 
              })}
            >
              <View style={styles.locationMain}>
                <MapPin size={18} color={Colors.primary} />
                <Text style={styles.detailLocationText} numberOfLines={1} ellipsizeMode="tail">
                  {selectedFlow.location}
                </Text>
              </View>
              {heroWeather && (
                <View style={styles.heroWeather}>
                  {renderWeatherIcon(heroWeather.condKey, 20, Colors.primary, heroWeather.isDay !== false)}
                  <Text style={styles.heroTemp}>{Math.round(parseFloat(heroWeather.temp) || 0)}°</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {sortedDates.length > 0 ? sortedDates.map((date, dateIdx) => (
          <View key={date} style={styles.dayGroup}>
            <View style={styles.dayHeader}>
              <View style={styles.dayBadge}><Text style={styles.dayBadgeText}>DAY {dateIdx + 1}</Text></View>
              <Text style={styles.dayDateText}>{formatDateLabel(date)}</Text>
            </View>
            {groupedSteps[date].map((step, index) => (
              <View key={step.id} style={styles.stepRow}>
                <View style={styles.timeCol}>
                  <TouchableOpacity onPress={() => openEditStep(step)}><Text style={styles.timeText}>{step.time}</Text></TouchableOpacity>
                  {step.status === 'current' && <View style={styles.currentIndicator}><Navigation2 size={12} color="white" fill="white" style={{ transform: [{ rotate: '45deg' }] }} /></View>}
                </View>
                <View style={styles.timelineCol}>
                  <View style={[styles.timelineDot, step.status === 'completed' && styles.dotCompleted, step.status === 'current' && styles.dotCurrent]} />
                  {index < groupedSteps[date].length - 1 && <View style={styles.timelineLine} />}
                </View>
                <TouchableOpacity activeOpacity={0.7} onPress={() => openEditStep(step)} style={[styles.stepInfoCard, step.status === 'current' && styles.activeStepCard, step.warning && styles.warningStepCard]}>
                  <View style={styles.stepHeader}>
                    <View style={{ flex: 1 }}>
                      <Text 
                        style={[styles.stepActivity, step.completed && styles.textCompleted]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {step.activity}
                      </Text>
                      {step.memo ? <Text style={styles.stepMemo} numberOfLines={2}>{step.memo}</Text> : null}
                      {step.region && (
                        <View style={styles.stepRegionRow}>
                          <MapPin size={10} color={Colors.outline} />
                          <Text style={styles.stepRegionLabel} numberOfLines={1} ellipsizeMode="tail">
                            {step.region.name}
                          </Text>
                        </View>
                      )}
                    </View>
                    {step.weather && step.weather !== 'none' && (
                        <TouchableOpacity
                          onPress={() => navigation.navigate('WeatherDetail', {
                            region: {
                              name: step.region?.name || step.activity,
                              address: step.region?.address || '',
                              lat: parseFloat(step.lat || step.region?.lat),
                              lon: parseFloat(step.lon || step.region?.lon)
                            }
                          })}
                          style={{ padding: 4 }}
                        >
                          {renderWeatherIcon(
                            typeof step.weather === 'object' ? step.weather.condKey : (step.weather || 'sunny'), 
                            18, 
                            Colors.primary, 
                            (() => {
                              if (typeof step.weather === 'object' && step.weather.isDay !== undefined) {
                                // 만약 날씨 데이터에 정확한 isDay가 있다면 사용
                                return step.weather.isDay;
                              }
                              // 데이터가 없거나 보조적으로 시간 기반 판단 (18시~06시 사이면 밤)
                              if (step.time) {
                                const hour = parseInt(step.time.split(':')[0]);
                                return hour >= 6 && hour < 18;
                              }
                              return true;
                            })()
                          )}
                        </TouchableOpacity>
                    )}
                  </View>
                  {step.warning && <View style={styles.warningBadge}><Text style={styles.warningText}>Rain alert: Indoor backup recommended</Text></View>}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )) : (
          <View style={styles.emptyFlow}><Navigation size={40} color={Colors.outlineVariant} strokeWidth={1} /><Text style={styles.emptyFlowText}>No schedules added yet.</Text></View>
        )}
        <View style={styles.centerButtonWrap}>
          <TouchableOpacity 
            style={styles.addStepDetail} 
            onPress={() => {
              setEditingStep(null);
              setEditActivity('');
              setEditMemo('');
              setEditDate(new Date().toISOString().split('T')[0]);
              setEditTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }));
              setSelectedRegion(null);
              setEditModalVisible(true);
            }}
          >
            <Plus size={20} color={Colors.primary} />
            <Text style={styles.addStepText}>Add Schedule</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  const renderSearchInModal = (mode) => (
    <TouchableOpacity style={styles.searchAccessoryBtn} onPress={() => openSearch(mode)}>
      <Search size={14} color={Colors.primary} />
      <Text style={styles.searchAccessoryText}>Find Region</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: Constants.statusBarHeight }]}>
      {!selectedFlow && <MainHeader onMenuPress={() => setMenuVisible(true)} />}
      
      {/* --- Flow List --- */}
      {!selectedFlow && (
        <View style={{ flex: 1 }}>
          {isLoading ? (
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
          ) : (
            <DraggableFlatList
              data={flows || []}
              keyExtractor={(item) => item.id}
              onDragEnd={({ data }) => {
                setFlows(data);
                saveFlows(data);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              renderItem={({ item: flow, drag, isActive }) => (
                <ScaleDecorator>
                  <TouchableOpacity 
                    activeOpacity={isActive ? 1 : 0.9} 
                    onLongPress={drag}
                    disabled={isActive}
                    onPress={() => setSelectedFlow(flow)} 
                    style={[
                      styles.flowCardContainer,
                      isActive && { opacity: 0.8 }
                    ]}
                  >
                    <LinearGradient 
                      colors={flow.gradient || ['#6366f1', '#a855f7']} 
                      start={{ x: 0, y: 0 }} 
                      end={{ x: 1, y: 1 }} 
                      style={[styles.flowCard, isActive && styles.activeDraggingCard]}
                    >
                      <View style={styles.cardTop}>
                        <View style={styles.tagContainer}><Text style={styles.tagText}>{flow.location}</Text></View>
                        <TouchableOpacity onPress={() => handleDeleteFlow(flow.id)}><Trash2 size={18} color="rgba(255,255,255,0.8)" /></TouchableOpacity>
                      </View>
                      <View style={styles.cardMiddle}>
                        <Text style={styles.cardTitle}>{flow.title}</Text>
                        <View style={styles.dateRow}><Calendar size={14} color="rgba(255,255,255,0.8)" /><Text style={styles.cardDate}>{flow.period}</Text></View>
                      </View>
                      <View style={styles.cardBottom}>
                        <View style={styles.progressContainer}><View style={[styles.progressBar, { width: `${(flow.progress || 0) * 100}%` }]} /></View>
                        <View style={styles.weatherSummary}><CloudRain size={16} color="white" style={{ marginRight: 6 }} /><Text style={styles.weatherText} numberOfLines={1}>{flow.weatherSummary}</Text></View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                </ScaleDecorator>
              )}
              ListHeaderComponent={
                <View style={styles.listHeader}>
                  <Text style={styles.screenTitle}>My Flows</Text>
                  <Text style={styles.screenSubtitle}>Curated multi-day journeys (Long press to reorder)</Text>
                </View>
              }
              ListFooterComponent={
                <TouchableOpacity style={styles.addFlowBtn} onPress={() => openFlowModal()}>
                  <Plus size={24} color={Colors.primary} />
                  <Text style={styles.addFlowText}>Create New Flow</Text>
                </TouchableOpacity>
              }
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      )}

      {selectedFlow && renderTimelineDetail()}

      {/* --- Flow Create/Edit Modal --- */}
      <Modal animationType="slide" transparent={true} visible={flowModalVisible} onRequestClose={() => setFlowModalVisible(false)}>
        <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={styles.editModalContent}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>{editingFlow ? 'Edit Journey' : 'New Journey'}</Text>
              <TouchableOpacity onPress={() => setFlowModalVisible(false)} style={styles.closeBtn}>
                <X size={22} color={Colors.onBackground} />
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Journey Title</Text>
              <View style={styles.editInputWrap}>
                <TextInput 
                  style={styles.editInput} 
                  value={flowTitle} 
                  onChangeText={setFlowTitle} 
                  placeholder="e.g. My Healing Trip" 
                  placeholderTextColor={Colors.outline}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Weather Region (Optional)</Text>
              <TouchableOpacity 
                style={[styles.regionSelector, flowLocation && styles.regionSelectorActive]} 
                onPress={() => openSearch('flow')}
              >
                <View style={[styles.regionIconWrap, flowLocation && styles.regionIconWrapActive]}>
                  <MapPin size={20} color={flowLocation ? 'white' : Colors.outline} />
                </View>
                <View style={styles.regionInfo}>
                  <Text style={[styles.regionMainText, !flowLocation && styles.regionPlaceholder]}>
                    {flowLocation || 'Where to check weather?'}
                  </Text>
                  <Text style={styles.regionSubText}>
                    {flowLocation ? 'Weather forecast will be linked' : 'Tap to search a city'}
                  </Text>
                </View>
                <ChevronRight size={18} color={Colors.outline} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity activeOpacity={0.8} onPress={saveFlow}>
              <LinearGradient 
                colors={Colors.primaryGradient || [Colors.primary, '#4f46e5']} 
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 0 }} 
                style={styles.premiumSubmitBtn}
              >
                <Check size={20} color="white" strokeWidth={3} />
                <Text style={styles.premiumSubmitText}>
                  {editingFlow ? 'Save Changes' : 'Confirm Journey'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
        </GestureHandlerRootView>
      </Modal>

      {/* --- Search Modal --- */}
      <Modal animationType="slide" transparent={true} visible={searchModalVisible} onRequestClose={closeSearch}>
        <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.modalOverlay}>
          <View style={styles.searchModalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.searchInputContainer}><Search size={20} color={Colors.outline} /><TextInput style={styles.modalInput} placeholder="Search region..." placeholderTextColor={Colors.outline} value={searchQuery} onChangeText={setSearchQuery} autoFocus />{searchQuery.length > 0 && <TouchableOpacity onPress={() => setSearchQuery('')}><X size={20} color={Colors.outline} /></TouchableOpacity>}</View>
              <TouchableOpacity onPress={closeSearch}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            </View>
            <ScrollView style={styles.searchResultsList}>{isSearching ? <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} /> : searchResults.map((item) => (<TouchableOpacity key={item.id} style={styles.resultItem} onPress={() => handleSelection(item)}><View style={styles.resultIconWrap}><MapPin size={20} color={Colors.primary} /></View><View style={styles.resultInfo}><View style={styles.resultHeader}><Text style={styles.resultName}>{item.name}</Text></View><Text style={styles.resultAddress}>{item.address}</Text></View></TouchableOpacity>))}</ScrollView>
          </View>
        </View>
        </GestureHandlerRootView>
      </Modal>

      {/* --- Edit Step Modal --- */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeEditModal}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
        <TouchableOpacity
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={closeEditModal}
        >
          <Animated.View 
            style={[
              styles.editModalContent,
              { transform: [{ translateY: panY }] }
            ]}
            {...panResponder.panHandlers}
          >
              <View style={styles.modalHandle} />
              
              <View style={styles.editHeader}>
                <Text style={styles.editTitle}>
                  {editingStep ? 'Edit Schedule' : 'New Schedule'}
                </Text>
                
                <TouchableOpacity 
                  style={styles.headerActionBtn} 
                  onPress={isKeyboardVisible ? Keyboard.dismiss : saveStep}
                >
                  {isKeyboardVisible ? (
                    <ChevronDown size={24} color={Colors.primary} />
                  ) : (
                    <Text style={styles.headerSaveText}>Save</Text>
                  )}
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
                <View style={styles.modalContentPadding}>
                  <Text style={styles.inputLabel}>Activity</Text>
                  <View style={styles.compactInputRow}>
                    <Edit3 size={18} color={Colors.primary} />
                    <TextInput
                      style={styles.compactInput}
                      value={editActivity}
                      onChangeText={setEditActivity}
                      placeholder="What are you doing?"
                      placeholderTextColor={Colors.outline}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.inputLabel}>Weather Region</Text>
                    {renderSearchInModal('step')}
                  </View>
                  <View style={styles.regionDisplay}>
                    <MapPin size={18} color={selectedRegion ? Colors.primary : Colors.outline} />
                    <Text style={[styles.regionDisplayText, !selectedRegion && { color: Colors.outline }]}>
                      {selectedRegion ? selectedRegion.name : 'No region selected'}
                    </Text>
                    {selectedRegion && (
                      <TouchableOpacity onPress={() => setSelectedRegion(null)}>
                        <X size={16} color={Colors.outline} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                <View style={styles.rowInputs}>
                  <View style={[styles.inputGroup, { flex: 1.5, marginRight: 12 }]}>
                    <Text style={styles.inputLabel}>Date</Text>
                    <TouchableOpacity 
                      style={styles.editInputWrap} 
                      onPress={() => { setShowDatePicker(!showDatePicker); setShowTimePicker(false); }}
                    >
                      <Calendar size={20} color={Colors.primary} style={{ marginRight: 12 }} />
                      <Text style={styles.editInputText}>{editDate}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={styles.inputLabel}>Time</Text>
                    <TouchableOpacity 
                      style={styles.editInputWrap} 
                      onPress={() => { setShowTimePicker(!showTimePicker); setShowDatePicker(false); }}
                    >
                      <Clock size={20} color={Colors.primary} style={{ marginRight: 12 }} />
                      <Text style={styles.editInputText}>{editTime}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Memo</Text>
                  <TouchableOpacity 
                    style={[styles.compactInputRow, { minHeight: 52, alignItems: 'center' }]} 
                    onPress={() => setMemoModalVisible(true)}
                  >
                    <AlignLeft size={18} color={Colors.primary} />
                    <Text style={[styles.compactInputText, !editMemo && { color: Colors.outline }]} numberOfLines={1}>
                      {editMemo || 'Add details or notes...'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* --- Date Picker (Native Calendar) --- */}
                {showDatePicker && (
                  <View style={styles.pickerContainer}>
                    <View style={styles.wheelHeader}><Text style={styles.wheelHeaderTitle}>Select Date</Text></View>
                    <DateTimePicker
                      value={new Date(editDate)}
                      mode="date"
                      display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
                      onChange={onDateChange}
                    />
                  </View>
                )}

                {showTimePicker && (
                  <View style={styles.pickerContainer}>
                    <View style={styles.wheelHeader}><Text style={styles.wheelHeaderTitle}>Select Time</Text></View>
                    <DateTimePicker
                      value={(() => {
                        const d = new Date(editDate);
                        const [h, m] = editTime.split(':').map(Number);
                        d.setHours(h, m);
                        return d;
                      })()}
                      mode="time"
                      is24Hour={true}
                      display="spinner"
                      onChange={onTimeChange}
                    />
                  </View>
                )}

                <View style={styles.modalFooter}>
                  {editingStep && (
                    <TouchableOpacity style={styles.deleteAction} onPress={deleteStep}>
                      <Trash2 size={22} color={Colors.error} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity activeOpacity={0.8} onPress={saveStep} style={styles.saveAction}>
                    <LinearGradient 
                      colors={Colors.primaryGradient || [Colors.primary, '#4f46e5']} 
                      start={{ x: 0, y: 0 }} 
                      end={{ x: 1, y: 0 }} 
                      style={styles.saveGradient}
                    >
                      <Check size={20} color="white" strokeWidth={3} />
                      <Text style={styles.saveActionText}>
                        {editingStep ? 'Save Changes' : 'Add to Flow'}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </Animated.View>
        </TouchableOpacity>
        </GestureHandlerRootView>
      </Modal>

      <MenuModal visible={menuVisible} onClose={() => setMenuVisible(false)} onReset={() => { loadInitialData(); }} />

      {/* --- Simple Memo Sub-Modal --- */}
      <Modal visible={memoModalVisible} transparent animationType="fade">
        <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.subModalOverlay}>
          <View style={styles.memoModalContent}>
            <View style={styles.subModalHeader}>
              <Text style={styles.subModalTitle}>Schedule Memo</Text>
              <TouchableOpacity onPress={() => setMemoModalVisible(false)}>
                <Check size={24} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.memoTextInput}
              value={editMemo}
              onChangeText={setEditMemo}
              placeholder="Write down details here..."
              placeholderTextColor={Colors.outline}
              multiline
              autoFocus
            />
          </View>
        </View>
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 160, paddingTop: Spacing.md },
  listHeader: { marginBottom: Spacing.xl, marginTop: Spacing.md },
  screenTitle: { ...Typography.h1, fontSize: 34, color: Colors.onBackground, letterSpacing: -0.5 },
  screenSubtitle: { ...Typography.body, color: Colors.onSurfaceVariant, marginTop: 4 },
  flowCardContainer: {
    marginBottom: Spacing.lg,
    borderRadius: 32,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 20 },
      android: { elevation: 8 }
    }),
  },
  flowCard: { padding: Spacing.xl, borderRadius: 32, height: 220, justifyContent: 'space-between' },
  activeDraggingCard: {
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tagContainer: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  tagText: { color: 'white', fontSize: 12, fontWeight: '700' },
  cardMiddle: { marginTop: Spacing.md },
  cardTitle: { ...Typography.h2, color: 'white', fontSize: 26, lineHeight: 32 },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  cardDate: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500' },
  cardBottom: { marginTop: Spacing.lg },
  progressContainer: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginBottom: 12, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: 'white', borderRadius: 2 },
  weatherSummary: { flexDirection: 'row', alignItems: 'center' },
  weatherText: { color: 'white', fontSize: 13, fontWeight: '600', flex: 1 },
  addFlowBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xl, borderRadius: 32, backgroundColor: Colors.surfaceContainerLow,
    marginTop: Spacing.sm, gap: 12,
  },
  addFlowText: { ...Typography.body, fontWeight: '700', color: Colors.primary },
  detailContainer: { flex: 1, backgroundColor: Colors.background },
  detailHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.md, height: 60 },
  detailHeaderTitle: { ...Typography.h3, fontSize: 18, flex: 1, textAlign: 'center' },
  iconBtn: { padding: 8 },
  detailContent: { padding: Spacing.lg, paddingBottom: 50 },
  heroSection: { marginBottom: Spacing.xl },
  heroDate: { ...Typography.bodySmall, color: Colors.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 },
  heroLocationRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: Spacing.xs,
    justifyContent: 'space-between',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 2 }
    })
  },
  locationMain: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 12 },
  heroWeather: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(0,0,0,0.05)',
  },
  heroTemp: { ...Typography.bodyMedium, fontWeight: '800', color: Colors.onBackground },
  heroLocation: { ...Typography.h1, fontSize: 28, letterSpacing: -0.5, color: Colors.onBackground },
  dayGroup: { marginBottom: 16 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 16 },
  dayBadge: { backgroundColor: Colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginRight: 8 },
  dayBadgeText: { ...Typography.labelSmall, color: 'white', fontWeight: '800' },
  dayDateText: { ...Typography.bodyLarge, fontWeight: '800', color: Colors.onBackground },
  stepRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8 },
  timeCol: { width: 45, alignItems: 'flex-end', paddingTop: 8 },
  timeText: { ...Typography.labelMedium, fontWeight: '800', color: Colors.onBackground },
  timelineCol: { width: 30, alignItems: 'center' },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.outlineVariant, marginTop: 12 },
  timelineLine: { width: 2, flex: 1, backgroundColor: Colors.outlineVariant, marginVertical: 2 },
  stepInfoCard: { 
    flex: 1, 
    backgroundColor: Colors.surfaceContainerLow, 
    borderRadius: 24, 
    padding: Spacing.lg, 
    marginLeft: 12, 
    marginBottom: Spacing.sm,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 1 }
    })
  },
  activeStepCard: {
    backgroundColor: 'white',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 15 },
      android: { elevation: 4 }
    }),
  },
  warningStepCard: { borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.2)' },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  stepActivity: { ...Typography.h3, fontSize: 15, flex: 1, marginRight: 12 },
  stepMemo: { ...Typography.caption, color: Colors.outline, marginTop: 2 },
  stepRegionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  stepRegionLabel: { fontSize: 11, color: Colors.outline, fontWeight: '600', maxWidth: 120 },
  textCompleted: { color: Colors.onSurfaceVariant, opacity: 0.6 },
  warningBadge: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 10, borderRadius: 12, marginTop: 12 },
  warningText: { fontSize: 12, color: '#dc2626', fontWeight: '600' },
  centerButtonWrap: { alignItems: 'center', marginTop: Spacing.xl },
  addStepDetail: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, paddingHorizontal: 24, borderRadius: 24,
    borderWidth: 1, borderColor: Colors.outlineVariant, borderStyle: 'dashed',
    backgroundColor: 'rgba(0, 191, 255, 0.02)', gap: 8,
  },
  addStepText: { ...Typography.body, fontWeight: '700', color: Colors.primary },
  emptyFlow: { alignItems: 'center', padding: 60, gap: 16 },
  emptyFlowText: { ...Typography.bodySmall, color: Colors.outline },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  searchModalContent: { backgroundColor: Colors.background, height: '90%', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: Spacing.lg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.lg },
  searchInputContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerLow, borderRadius: 20, paddingHorizontal: 16, height: 56, gap: 10 },
  modalInput: { flex: 1, ...Typography.body, fontSize: 16, color: Colors.onBackground },
  cancelText: { ...Typography.body, color: Colors.primary, fontWeight: '600' },
  searchResultsList: { flex: 1 },
  resultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant, gap: 16 },
  resultIconWrap: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  resultInfo: { flex: 1 },
  resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultName: { ...Typography.h3, fontSize: 16 },
  resultAddress: { ...Typography.bodySmall, color: Colors.onSurfaceVariant, marginTop: 2 },
  editModalContent: { 
    backgroundColor: Colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  editTitle: { ...Typography.h2, fontSize: 24, letterSpacing: -0.5, color: Colors.onBackground },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.outlineVariant,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
    opacity: 0.5,
  },
  headerActionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 191, 255, 0.05)',
  },
  headerSaveText: { ...Typography.body, fontWeight: '800', color: Colors.primary },
  searchAccessoryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0, 191, 255, 0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  searchAccessoryText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  inputGroup: { marginBottom: Spacing.xl },
  inputLabel: { ...Typography.bodySmall, color: Colors.onBackground, fontWeight: '800', marginBottom: 12, marginLeft: 2, opacity: 0.8 },
  editInputWrap: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'white', 
    borderRadius: 20, 
    paddingHorizontal: 20, 
    height: 64,
    borderWidth: 1.5,
    borderColor: Colors.surfaceContainerLow,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 }
    })
  },
  editInput: { flex: 1, ...Typography.body, fontSize: 16, color: Colors.onBackground, fontWeight: '600' },
  regionSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 24,
    padding: 16,
    gap: 16,
  },
  regionSelectorActive: {
    backgroundColor: 'white',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 },
      android: { elevation: 6 }
    })
  },
  regionIconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: Colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  regionIconWrapActive: { backgroundColor: Colors.primary },
  regionInfo: { flex: 1 },
  detailLocationText: { ...Typography.h2, fontSize: 22, color: Colors.onBackground, flex: 1 },
  regionMainText: { ...Typography.h3, fontSize: 16, color: Colors.onBackground },
  regionPlaceholder: { color: Colors.outline, fontWeight: '500' },
  regionSubText: { ...Typography.bodySmall, color: Colors.onSurfaceVariant, marginTop: 2, fontSize: 12 },
  premiumSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 64,
    borderRadius: 24,
    gap: 12,
    marginTop: 8,
    ...Platform.select({
      ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15 },
      android: { elevation: 6 }
    })
  },
  premiumSubmitText: { color: 'white', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  editInputText: { ...Typography.body, fontSize: 16, color: Colors.onBackground, fontWeight: '600' },
  pickerContainer: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: 24, marginTop: 8, marginBottom: 20, overflow: 'hidden', paddingBottom: 8 },
  wheelHeader: { padding: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant },
  wheelHeaderTitle: { ...Typography.bodySmall, fontWeight: '800', color: Colors.primary },
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 20, alignItems: 'center' },
  deleteAction: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#FFE5E5', justifyContent: 'center', alignItems: 'center' },
  saveAction: { flex: 1, height: 56, borderRadius: 16, overflow: 'hidden', backgroundColor: Colors.primary },
  saveGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveActionText: { color: 'white', fontWeight: '700', fontSize: 16 },
  compactInputRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: 'white', 
    borderRadius: 20, 
    paddingHorizontal: 16, 
    height: 56, 
    gap: 12,
    borderWidth: 1.5,
    borderColor: Colors.surfaceContainerLow,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
      android: { elevation: 2 }
    })
  },
  compactInput: { flex: 1, ...Typography.body, fontSize: 16, color: Colors.onBackground, fontWeight: '600' },
  compactInputText: { flex: 1, ...Typography.body, fontSize: 16, color: Colors.onBackground, fontWeight: '600' },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingRight: 4 },
  regionDisplay: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: Colors.surfaceContainerLow, 
    padding: 12, 
    borderRadius: 16, 
    gap: 10, 
    borderWidth: 1, 
    borderColor: Colors.outlineVariant,
    opacity: 0.9 
  },
  subModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 24 },
  memoModalContent: {
    backgroundColor: 'white', borderRadius: 32, padding: 24, height: height * 0.45,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.15, shadowRadius: 20 },
      android: { elevation: 12 }
    }),
  },
  subModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  subModalTitle: { ...Typography.h2, fontSize: 20, color: Colors.onBackground },
  memoTextInput: { flex: 1, ...Typography.body, fontSize: 17, color: Colors.onBackground, textAlignVertical: 'top', lineHeight: 24 },
  modalContentPadding: { paddingBottom: 8 },
});

export default FlowScreen;
