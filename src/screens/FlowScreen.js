import React, { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, Animated, Platform, Modal, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Keyboard, PanResponder, FlatList, Pressable, Switch } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView, TouchableOpacity as GHButton, BorderlessButton } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import AdBanner from '../components/AdBanner';
import { BANNER_UNIT_ID } from '../constants/AdUnits';
import { useSubscription } from '../contexts/SubscriptionContext';
import { BannerAdSize } from 'react-native-google-mobile-ads';
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
  FileText,
  Keyboard as KeyboardIcon,
  Flag,
  Share2,
  Lock
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Colors, Spacing, Typography } from '../theme';
import { useUnits } from '../contexts/UnitContext';
import MenuModal from '../components/MenuModal';
import MainHeader from '../components/MainHeader';
import WeatherService from '../services/weather/WeatherService';
import { searchLocations } from '../services/weather/GlobalService';
import { searchPlaces as searchDomesticPlaces } from '../services/weather/VWorldService';
import { getFlows, saveFlows, addFlow, deleteFlow } from '../services/FlowService';

const { width, height } = Dimensions.get('window');

const FlowScreen = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const { formatTemp } = useUnits();
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState(null);
  const [isSharingImage, setIsSharingImage] = useState(false);
  const viewShotRef = useRef();
  
  const [flows, setFlows] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isPremium, limits } = useSubscription();

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
  const [editEndTime, setEditEndTime] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [matchStartDate, setMatchStartDate] = useState(true);
  const [editActivity, setEditActivity] = useState('');
  const [editMemo, setEditMemo] = useState('');
  const [pickerType, setPickerType] = useState(null); // 'startDate', 'startTime', 'endDate', 'endTime'
  const pickerBackupRef = useRef({ editDate: '', editTime: '', editEndDate: '', editEndTime: '' });

  // Flow Create/Edit State
  const [flowModalVisible, setFlowModalVisible] = useState(false);
  const [editingFlow, setEditingFlow] = useState(null);
  const [flowTitle, setFlowTitle] = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [flowLocation, setFlowLocation] = useState('');
  const [flowAddress, setFlowAddress] = useState('');
  const [flowLat, setFlowLat] = useState(null);
  const [flowLon, setFlowLon] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [heroWeather, setHeroWeather] = useState(null);
  const panY = useRef(new Animated.Value(0)).current;
  const flowPanY = useRef(new Animated.Value(0)).current;
  const flowKeyboardOffset = useRef(new Animated.Value(0)).current;
  const searchPanY = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef(null);
  const stepScrollRef = useRef(null);
  const memoYRef = useRef(0);
  const activityInputRef = useRef(null);
  const flowTitleRef = useRef(null);
  const flowDescRef = useRef(null);
  const focusedFlowInputRef = useRef(null);

  // --- Initialization ---
  useFocusEffect(
    useCallback(() => {
      loadInitialData();
    }, [])
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      setSelectedFlow(null);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    });
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      setIsKeyboardVisible(true);
      setKeyboardHeight(e.endCoordinates.height);
      const kbTop = height - e.endCoordinates.height;
      const focused = focusedFlowInputRef.current;
      if (focused) {
        focused.measure((_x, _y, _w, h, _px, pageY) => {
          const inputBottom = pageY + h + 16; // 16px padding
          const overlap = inputBottom - kbTop;
          Animated.timing(flowKeyboardOffset, {
            toValue: overlap > 0 ? overlap : 0,
            duration: e.duration || 250,
            useNativeDriver: true,
          }).start();
        });
      } else {
        Animated.timing(flowKeyboardOffset, { toValue: 0, duration: 0, useNativeDriver: true }).start();
      }
    });
    const hideSubscription = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
      setIsKeyboardVisible(false);
      setKeyboardHeight(0);
      Animated.timing(flowKeyboardOffset, {
        toValue: 0,
        duration: e.duration || 200,
        useNativeDriver: true,
      }).start();
    });

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
        if (gestureState.dy > 0) panY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.timing(panY, { toValue: height, duration: 220, useNativeDriver: true }).start(() => {
            closeEditModal();
          });
        } else {
          Animated.spring(panY, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
        }
      },
    })
  ).current;

  const flowPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) flowPanY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.timing(flowPanY, { toValue: height, duration: 220, useNativeDriver: true }).start(() => {
            closeFlowModal();
          });
        } else {
          Animated.spring(flowPanY, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
        }
      },
    })
  ).current;

  const searchPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => gestureState.dy > 5,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) searchPanY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          Animated.timing(searchPanY, { toValue: height, duration: 220, useNativeDriver: true }).start(() => {
            closeSearch();
            searchPanY.setValue(0);
          });
        } else {
          Animated.spring(searchPanY, { toValue: 0, useNativeDriver: true, bounciness: 8 }).start();
        }
      },
    })
  ).current;

  const openEditModal = (isNew = false) => {
    panY.setValue(height);
    setEditModalVisible(true);
    stepScrollRef.current?.scrollTo({ y: 0, animated: false });
    Animated.spring(panY, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }).start();
    if (isNew) {
      setTimeout(() => activityInputRef.current?.focus(), 320);
    }
  };

  const closeEditModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditModalVisible(false);
    setEditingStep(null);
    setEditActivity('');
    setEditMemo('');
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    setEditDate(today);
    setEditTime(nowTime);
    setEditEndDate(today);
    setEditEndTime(nowTime);
    setMatchStartDate(true);
    setSelectedRegion(null);
    setPickerType(null);
  };

  const closeFlowModal = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFlowModalVisible(false);
    setEditingFlow(null);
    setFlowTitle('');
    setFlowLocation('');
    setFlowAddress('');
    setFlowLat(null);
    setFlowLon(null);
    setFlowDescription('');
  };

  const loadInitialData = async () => {
    setIsLoading(true);
    const savedFlows = await getFlows();
    let currentFlows = [];
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
        weatherCondKey: 'sunny',
        weatherIsDay: true,
        lat: 37.5665,
        lon: 126.9780,
        steps: [
          { id: 's1', date: today, time: '10:00', activity: 'Arrival & Coffee', status: 'completed' },
          { id: 's2', date: today, time: '14:00', activity: 'Hotel Check-in', status: 'current' },
          { id: 's3', date: tomorrow, time: '09:00', activity: 'City Tour Start', status: 'upcoming' }
        ]
      };
      currentFlows = [sample];
      setFlows(currentFlows);
    } else {
      currentFlows = savedFlows;
      setFlows(currentFlows);
    }
    setIsLoading(false);
  };

  const refreshFlowWeather = async (flow) => {
    if (!flow.lat || !flow.lon) return;
    try {
      const weather = await WeatherService.getWeather(flow.lat, flow.lon, false, flow.location, flow.location);
      if (!weather) return;
      const weatherTemp = weather.temp ? (String(weather.temp).includes('°') ? weather.temp : `${weather.temp}°`) : '--°';
      setFlows(prev => {
        const updated = prev.map(f => f.id === flow.id
          ? { ...f, weatherTemp, weatherCondKey: weather.condKey, weatherIsDay: weather.isDay !== false }
          : f
        );
        saveFlows(updated);
        return updated;
      });
    } catch (e) { console.warn('[Flow] Refresh failed for', flow.location); }
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
      setSelectedRegion(item);
    }
    setSearchModalVisible(false);
  };

  const fetchHeroWeather = async (flow) => {
    if (flow && flow.lat && flow.lon) {
      const weather = await WeatherService.getWeather(flow.lat, flow.lon, false, flow.location, flow.address || '');
      setHeroWeather(weather);
    } else {
      setHeroWeather(null);
    }
  };

  useEffect(() => {
    if (selectedFlow) {
      fetchHeroWeather(selectedFlow);
      refreshFlowWeather(selectedFlow);
    }
  }, [selectedFlow]);

  const MAX_FLOWS = limits.flows;
  const MAX_STEPS = limits.stepsPerFlow;

  // inactive 플래그를 렌더 시점에 계산 — AsyncStorage 타이밍 이슈 없이 isPremium 즉시 반영
  const displayFlows = React.useMemo(() => {
    if (isPremium) return flows.map(f => ({ ...f, inactive: false }));
    const sorted = [...flows].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    const activeIds = new Set(sorted.slice(0, MAX_FLOWS).map(f => f.id));
    return flows.map(f => ({ ...f, inactive: !activeIds.has(f.id) }));
  }, [flows, isPremium, MAX_FLOWS]);

  const saveFlow = async () => {
    if (isSaving) return;
    if (!flowTitle.trim()) {
      Alert.alert(t('flow.alert.title_required'), t('flow.alert.title_required_msg'));
      return;
    }
    if (!editingFlow && displayFlows.filter(f => !f.inactive).length >= MAX_FLOWS) {
      const msg = isPremium
        ? t('flow.alert.limit_msg', `최대 ${MAX_FLOWS}개 플로우까지 만들 수 있습니다.`)
        : t('flow.alert.premium_limit_msg', `무료 플랜은 최대 ${MAX_FLOWS}개 플로우까지 만들 수 있습니다. 더 만들려면 프리미엄을 이용해 주세요.`);
      Alert.alert(t('flow.alert.limit_title', 'Flow Limit'), msg);
      return;
    }
    
    setIsSaving(true);
    try {
      let weatherTemp = null;
      let weatherCondKey = null;
      let weatherIsDay = true;
      if (flowLat && flowLon) {
        const weather = await WeatherService.getWeather(flowLat, flowLon, false, flowLocation, flowLocation);
        weatherTemp = weather?.temp ? (String(weather.temp).includes('°') ? weather.temp : `${weather.temp}°`) : '--°';
        weatherCondKey = weather?.condKey || 'cloudy';
        weatherIsDay = weather?.isDay !== false;
      }

      const now = new Date().toISOString();
      const updatedFlows = editingFlow
        ? flows.map(f => f.id === editingFlow.id ? { 
            ...f, 
            title: flowTitle, 
            description: flowDescription, 
            location: flowLocation, 
            address: flowAddress, 
            lat: flowLat,
            lon: flowLon,
            weatherTemp,
            weatherCondKey,
            weatherIsDay,
            updatedAt: now
          } : f)
        : await addFlow({
            id: Date.now().toString(),
            title: flowTitle,
            description: flowDescription,
            period: t('flow.multi_day_planning', 'Multi-day Planning'),
            location: flowLocation || '',
            address: flowAddress || '',
            progress: 0,
            gradient: getFlowGradient(flows),
            weatherTemp,
            weatherCondKey,
            weatherIsDay,
            lat: flowLat,
            lon: flowLon,
            steps: [],
            createdAt: now,
            updatedAt: now
          });

      setFlows(updatedFlows);
      await saveFlows(updatedFlows);
      
      if (editingFlow && selectedFlow && selectedFlow.id === editingFlow.id) {
        const updatedSelected = updatedFlows.find(f => f.id === editingFlow.id);
        if (updatedSelected) setSelectedFlow(updatedSelected);
      }
      
      setFlowModalVisible(false);
    } catch (e) { console.error(e); }
    finally { setIsSaving(false); }
  };

  const saveStep = async () => {
    if (!editActivity.trim()) {
      Alert.alert(t('flow.alert.activity_required'), t('flow.alert.activity_required_msg'));
      return;
    }
    if (!editingStep && (selectedFlow?.steps?.length || 0) >= MAX_STEPS) {
      const msg = isPremium
        ? t('flow.alert.step_limit_msg', `플로우당 최대 ${MAX_STEPS}개 일정까지 추가할 수 있습니다.`)
        : t('flow.alert.step_limit_free_msg', `무료 플랜은 플로우당 최대 ${MAX_STEPS}개 일정까지 추가할 수 있습니다. 더 추가하려면 프리미엄을 이용해 주세요.`);
      Alert.alert(t('flow.alert.limit_title', 'Flow Limit'), msg);
      return;
    }
    if (editTime && !editTime.match(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)) {
      Alert.alert(t('flow.alert.invalid_time'), t('flow.alert.invalid_time_msg'));
      return;
    }
    
    setIsSearching(true);
    try {
      let weatherData = null;
      let hasWarning = false;
      const now = new Date().toISOString();
      
      const targetLat = selectedRegion ? selectedRegion.lat : null;
      const targetLon = selectedRegion ? selectedRegion.lon : null;
      const targetName = selectedRegion ? selectedRegion.name : null;

      if (targetLat && targetLon) {
        const weather = await WeatherService.getWeather(targetLat, targetLon, false, targetName, targetName);
        const weatherKey = weather ? weather.condKey : null;
        const weatherIsDay = weather ? (weather.isDay !== false) : true;
        hasWarning = weather && (weather.condKey === 'rainy' || weather.condKey === 'thunderstorm');
        weatherData = { condKey: weatherKey, isDay: weatherIsDay };
      }

      const finalEndDate = matchStartDate ? editDate : editEndDate;
      const finalEndTime = matchStartDate ? editTime : editEndTime;

      const updatedFlows = flows.map(f => {
        if (f.id === selectedFlow.id) {
          const updatedSteps = editingStep 
            ? f.steps.map(s => s.id === editingStep.id ? { ...s, time: editTime, date: editDate, endTime: finalEndTime, endDate: finalEndDate, activity: editActivity, memo: editMemo, region: selectedRegion, weather: weatherData, warning: hasWarning, lat: targetLat, lon: targetLon, updatedAt: now } : s)
            : [...(f.steps || []), { id: Date.now().toString(), date: editDate, time: editTime, endTime: finalEndTime, endDate: finalEndDate, activity: editActivity, memo: editMemo, region: selectedRegion, status: 'upcoming', weather: weatherData, warning: hasWarning, lat: targetLat, lon: targetLon, createdAt: now, updatedAt: now }];
          
          const sorted = sortSteps(updatedSteps);
          const updatedF = { ...f, steps: sorted, updatedAt: now };
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
    const now = new Date().toISOString();
    const updatedFlows = flows.map(f => {
      if (f.id === selectedFlow.id) {
        const updatedSteps = f.steps.filter(s => s.id !== editingStep.id);
        const updatedF = { ...f, steps: updatedSteps, updatedAt: now };
        setSelectedFlow(updatedF);
        return updatedF;
      }
      return f;
    });
    setFlows(updatedFlows);
    await saveFlows(updatedFlows);
    closeEditModal();
  };

  const deleteStepById = async (stepId) => {
    const now = new Date().toISOString();
    const updatedFlows = flows.map(f => {
      if (f.id === selectedFlow.id) {
        const updatedSteps = f.steps.filter(s => s.id !== stepId);
        const updatedF = { ...f, steps: updatedSteps, updatedAt: now };
        setSelectedFlow(updatedF);
        return updatedF;
      }
      return f;
    });
    setFlows(updatedFlows);
    await saveFlows(updatedFlows);
  };

  const handleShareFlowImage = async () => {
    if (!viewShotRef.current) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSharingImage(true);
    
    try {
      // 캡처 전에 잠시 대기 (UI 업데이트 보장)
      const uri = await viewShotRef.current.capture();
      if (uri) {
        const isSharingAvailable = await Sharing.isAvailableAsync();
        if (isSharingAvailable) {
          await Sharing.shareAsync(uri, {
            mimeType: 'image/png',
            dialogTitle: `Share ${selectedFlow?.title || 'My Schedule'}`,
            UTI: 'public.png',
          });
        } else {
          Alert.alert(t('flow.alert.sharing_not_available'), t('flow.alert.sharing_not_available_msg'));
        }
      }
    } catch (e) {
      console.error("Capture failed", e);
      Alert.alert(t('flow.alert.share_failed'), t('flow.alert.share_failed_msg'));
    } finally {
      setIsSharingImage(false);
    }
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
      const dateKey = step.date || 'Unscheduled';
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(step);
      return acc;
    }, {});
  };

  const getLocalizedPeriod = (period) => {
    if (period === 'Multi-day Planning' || period === '일정 계획' || period === 'Multi-Day Planning') {
      return t('flow.multi_day_planning', 'Multi-day Planning');
    }
    return period;
  };

  const formatDateLabel = (dateStr) => {
    if (!dateStr || dateStr === 'Unscheduled') return t('flow.unscheduled', 'Unscheduled');
    try {
      const d = new Date(dateStr);
      if (i18n.language.startsWith('ko')) {
        const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
        return `${d.getMonth() + 1}월 ${d.getDate()}일 (${weekdays[d.getDay()]})`;
      }
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' });
    } catch (e) { return dateStr; }
  };

  const openSearch = (mode) => { searchPanY.setValue(0); setSearchMode(mode); setSearchModalVisible(true); };
  const closeSearch = () => { setSearchModalVisible(false); setSearchQuery(''); setSearchResults([]); };

  const openFlowModal = (flow = null) => {
    flowPanY.setValue(height);
    setEditingFlow(flow);
    setFlowTitle(flow ? flow.title : '');
    setFlowDescription(flow ? (flow.description || '') : '');
    setFlowLocation(flow ? flow.location : '');
    setFlowAddress(flow ? (flow.address || '') : '');
    setFlowLat(flow ? flow.lat : null);
    setFlowLon(flow ? flow.lon : null);
    setFlowModalVisible(true);
    Animated.spring(flowPanY, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 14 }).start();
  };

  const openEditStep = (step) => {
    setEditingStep(step);
    setEditTime(step.time);
    setEditDate(step.date);
    setEditEndTime(step.endTime || step.time);
    setEditEndDate(step.endDate || step.date);
    setMatchStartDate(!(step.endDate && step.endDate !== step.date) && !(step.endTime && step.endTime !== step.time));
    setEditActivity(step.activity);
    setEditMemo(step.memo || '');
    setSelectedRegion(step.region || null);
    setPickerType(null);
    openEditModal();
  };

  const handleDeleteFlow = (id) => {
    console.log('[Flow] Deleting flow:', id);
    Alert.alert(t('flow.alert.delete_flow'), t('flow.alert.delete_flow_msg'), [
      { text: t('common.cancel'), style: "cancel" },
      { text: t('common.delete'), style: "destructive", onPress: async () => {
          const updated = flows.filter(f => f.id !== id);
          setFlows(updated);
          if (selectedFlow?.id === id) setSelectedFlow(null);
          await deleteFlow(id);
        }
      }
    ]);
  };

  const getFlowGradient = (existingFlows = []) => {
    // 1. 지능형 랜덤 컬러 생성기 (가독성 보장 + 무한한 다양성)
    const generateSafeGradient = () => {
      // 색상(Hue)을 0-360도 전체에서 선택
      const h = Math.floor(Math.random() * 360);
      
      // 색상 영역에 따른 명도(Lightness) 보정 로직 (WCAG 가독성 기준 기반)
      // 노란색, 연두색 등 밝은 계열(40~100도)은 명도를 더 낮게, 파란색/보라색 등 어두운 계열은 명도를 약간 더 높게.
      let l;
      if (h >= 40 && h <= 100) {
        // Yellow-Green 영역: 더 어둡게 (35~45%)
        l = 35 + Math.floor(Math.random() * 10);
      } else if (h >= 190 && h <= 280) {
        // Blue-Purple 영역: 조금 더 밝게 해도 가독성 좋음 (45~55%)
        l = 45 + Math.floor(Math.random() * 10);
      } else {
        // 기타 영역 (Red, Orange, Cyan, Magenta): 중간 명도 (40~50%)
        l = 40 + Math.floor(Math.random() * 10);
      }

      // 채도(Saturation): 65%~90% 사이에서 풍부하게 표현
      const s = 65 + Math.floor(Math.random() * 25);
      
      const color1 = `hsl(${h}, ${s}%, ${l}%)`;
      // 끝 색상은 색상을 20-40도 정도 회전시키고, 명도를 살짝 변형하여 입체감 있는 그라디언트 생성
      const h2 = (h + 20 + Math.floor(Math.random() * 20)) % 360;
      const l2 = Math.max(25, l - 10); // 너무 어두워지지 않게 하한선(25%) 설정
      const color2 = `hsl(${h2}, ${s}%, ${l2}%)`;

      return [color1, color2];
    };

    // 2. 이미 사용 중인 색상과 너무 겹치지 않게 최대 5번 시도
    let bestGradient = generateSafeGradient();
    const usedHues = existingFlows.map(f => {
      const match = f.gradient?.[0]?.match(/hsl\((\d+)/);
      return match ? parseInt(match[1]) : -1;
    });

    for (let i = 0; i < 5; i++) {
      const candidate = generateSafeGradient();
      const candHue = parseInt(candidate[0].match(/hsl\((\d+)/)[1]);
      
      // 기존 색상들과 Hue 값이 30도 이상 차이 나면 채택
      const isUnique = usedHues.every(uh => Math.abs(uh - candHue) > 30);
      if (isUnique) {
        bestGradient = candidate;
        break;
      }
    }

    return bestGradient;
  };

  const renderWeatherIcon = (key, size = 20, color = Colors.primary, isDay = true) => {
    const moonColor = color === 'white' ? 'white' : "#A1C9FF";
    const sunColor = color === 'white' ? 'white' : "#f59e0b";
    const rainColor = color === 'white' ? 'white' : "#3b82f6";
    const snowColor = color === 'white' ? 'white' : "#94a3b8";
    const thunderColor = color === 'white' ? 'white' : "#E53935";

    switch (key) {
      case 'sunny': case 'clear': return isDay ? <Sun size={size} color={sunColor} /> : <Moon size={size} color={moonColor} />;
      case 'clear_night': case 'mostly_clear_night': return <Moon size={size} color={moonColor} />;
      case 'partly_cloudy': case 'mostly_sunny': return isDay ? <CloudSun size={size} color={color} /> : <CloudMoon size={size} color={moonColor} />;
      case 'cloudy': case 'overcast': return <Cloud size={size} color={color} />;
      case 'light_rain': case 'moderate_rain': case 'heavy_rain': case 'rainy': case 'rain': return <CloudRain size={size} color={rainColor} />;
      case 'light_snow': case 'heavy_snow': case 'snowy': case 'snow': return <CloudSnow size={size} color={snowColor} />;
      case 'thunderstorm': case 'lightning': return <CloudLightning size={size} color={thunderColor} />;
      default: return isDay ? <Sun size={size} color={sunColor} /> : <Moon size={size} color={moonColor} />;
    }
  };

  const onDateChange = (event, selectedDate) => {
    if (Platform.OS === 'android') setPickerType(null);
    if (selectedDate) {
      const y = selectedDate.getFullYear();
      const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const d = String(selectedDate.getDate()).padStart(2, '0');
      const formatted = `${y}-${m}-${d}`;
      
      if (pickerType === 'endDate') {
        setEditEndDate(formatted);
        setMatchStartDate(false);
      } else {
        setEditDate(formatted);
        if (matchStartDate) setEditEndDate(formatted);
      }
    }
  };

  const onTimeChange = (event, selectedTime) => {
    if (Platform.OS === 'android') setPickerType(null);
    if (selectedTime) {
      const h = String(selectedTime.getHours()).padStart(2, '0');
      const m = String(selectedTime.getMinutes()).padStart(2, '0');
      const formatted = `${h}:${m}`;
      
      if (pickerType === 'endTime') {
        setEditEndTime(formatted);
        setMatchStartDate(false);
      } else {
        setEditTime(formatted);
        if (matchStartDate) setEditEndTime(formatted);
      }
    }
  };

  const renderSearchLayer = () => (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.background, zIndex: 2000, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg }, { transform: [{ translateY: searchPanY }] }]}>
      <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 16 }} {...searchPanResponder.panHandlers}>
        <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.outline, opacity: 0.4 }} />
      </View>
      <View style={styles.modalHeader}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color={Colors.outline} />
          <TextInput 
            style={styles.modalInput} 
            placeholder={t('common.search_placeholder', 'Search region...')} 
            placeholderTextColor={Colors.outline} 
            value={searchQuery} 
            onChangeText={setSearchQuery} 
            autoFocus 
            autoCapitalize="none"
          />
          {searchQuery.length > 0 && (
            <GHButton onPress={() => setSearchQuery('')}>
              <X size={20} color={Colors.outline} />
            </GHButton>
          )}
        </View>
        <GHButton onPress={closeSearch}>
          <Text style={styles.cancelText}>{t('common.cancel', 'Cancel')}</Text>
        </GHButton>
      </View>
      <ScrollView style={styles.searchResultsList}>
        {isSearching ? (
          <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 40 }} />
        ) : (
          searchResults.map((item) => (
            <GHButton key={item.id} style={styles.resultItem} onPress={() => handleSelection(item)}>
              <View style={styles.resultIconWrap}><MapPin size={20} color={Colors.primary} /></View>
              <View style={styles.resultInfo}>
                <View style={styles.resultHeader}><Text style={styles.resultName}>{item.name}</Text></View>
                <Text style={styles.resultAddress}>{item.address}</Text>
              </View>
            </GHButton>
          ))
        )}
      </ScrollView>
    </Animated.View>
  );

  const groupedSteps = groupStepsByDate(selectedFlow?.steps);
  const sortedDates = Object.keys(groupedSteps).sort((a, b) => {
    if (a === 'Unscheduled') return 1;
    if (b === 'Unscheduled') return -1;
    return a.localeCompare(b);
  });

  const renderTimelineDetail = () => {
    const allSteps = selectedFlow.steps || [];
    const displaySteps = (() => {
      if (isPremium) return allSteps;
      const sorted = [...allSteps].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      const activeIds = new Set(sorted.slice(0, MAX_STEPS).map(s => s.id));
      return allSteps.map(s => ({ ...s, inactive: !activeIds.has(s.id) }));
    })();
    const groupedSteps = groupStepsByDate(displaySteps);
    const sortedDates = Object.keys(groupedSteps).sort((a, b) => {
      if (a === 'Unscheduled') return 1;
      if (b === 'Unscheduled') return -1;
      return a.localeCompare(b);
    });

    return (
      <View style={styles.detailContainer}>
        <View style={styles.detailHeader}>
          <View style={styles.headerLeft}>
            <BorderlessButton 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedFlow(null);
              }} 
              style={styles.iconBtn}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 10 }}
            >
              <ChevronLeft size={24} color={Colors.onBackground} />
            </BorderlessButton>
          </View>

          <View style={styles.headerCenter}>
            <Text style={styles.detailHeaderTitle} numberOfLines={1}>{selectedFlow.title}</Text>
          </View>

          <View style={styles.headerRight}>
            <BorderlessButton 
              onPress={handleShareFlowImage}
              style={styles.iconBtn}
              hitSlop={{ top: 20, bottom: 20, left: 10, right: 5 }}
              disabled={isSharingImage}
            >
              {isSharingImage ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Share2 size={22} color={Colors.primary} />
              )}
            </BorderlessButton>
            <BorderlessButton
              style={styles.iconBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Alert.alert(
                  selectedFlow.title,
                  null,
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    { text: t('common.edit', 'Edit'), onPress: () => openFlowModal(selectedFlow) },
                    { text: t('common.delete', 'Delete'), style: 'destructive', onPress: () => handleDeleteFlow(selectedFlow.id) },
                  ]
                );
              }}
              hitSlop={{ top: 20, bottom: 20, left: 5, right: 20 }}
            >
              <MoreVertical size={20} color={Colors.onBackground} />
            </BorderlessButton>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.detailContent}>
          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }} style={{ backgroundColor: Colors.background, padding: 20, borderRadius: 24 }}>
            {/* 공유 이미지 전용 헤더 (제목 추가) */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ ...Typography.h1, fontSize: 28, color: Colors.onBackground, marginBottom: 4 }}>{selectedFlow.title}</Text>
              <Text style={styles.heroDate}>{getLocalizedPeriod(selectedFlow.period)}</Text>
            </View>

            {selectedFlow.location && selectedFlow.location !== 'No Region' && (
              <Pressable
                style={({ pressed }) => [styles.heroLocationRow, { marginTop: 0, marginBottom: 24 }, pressed && { opacity: 0.7 }]}
                onPress={() => {
                  if (heroWeather) {
                    navigation.navigate('WeatherDetail', {
                      weatherData: { ...heroWeather, locationName: selectedFlow.location },
                      isCurrentLocation: false,
                      locationName: selectedFlow.location,
                    });
                  }
                }}
              >
                <View style={styles.locationMain}>
                  <MapPin size={18} color={Colors.primary} />
                  <Text style={styles.detailLocationText} numberOfLines={1}>{selectedFlow.location}</Text>
                </View>
                {heroWeather && (
                  <View style={styles.heroWeather}>
                    {renderWeatherIcon(heroWeather.condKey, 20, Colors.primary, heroWeather.isDay !== false)}
                    <Text style={styles.heroTemp}>{formatTemp(heroWeather.temp)}</Text>
                  </View>
                )}
              </Pressable>
            )}

            {sortedDates.length > 0 ? (
              sortedDates.map((date, dateIdx) => (
                <View key={date} style={styles.dayGroup}>
                  {date !== 'Unscheduled' ? (
                    <View style={styles.dayHeader}>
                      <View style={styles.dayBadge}><Text style={styles.dayBadgeText}>{t('flow.day_n', { n: dateIdx + 1 }, `DAY ${dateIdx + 1}`)}</Text></View>
                      <Text style={styles.dayDateText}>{formatDateLabel(date)}</Text>
                    </View>
                  ) : (
                    <View style={[styles.dayHeader, { marginTop: 8 }]}>
                      <Text style={styles.dayDateText}>{t('flow.unscheduled', 'Unscheduled')}</Text>
                    </View>
                  )}
                  {groupedSteps[date].map((step, index) => (
                    <View key={step.id} style={styles.stepRow}>
                      <View style={styles.timeCol}>
                        <Text style={[styles.timeText, step.inactive && { color: Colors.outline }]}>{step.time || '--:--'}</Text>
                      </View>
                      <View style={styles.timelineCol}>
                        <View style={[styles.timelineDot, step.status === 'completed' && styles.dotCompleted, step.inactive && { backgroundColor: Colors.outline }]} />
                        {index < groupedSteps[date].length - 1 && <View style={styles.timelineLine} />}
                      </View>
                      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                        {step.inactive ? (
                          <View style={[styles.stepInfoCard, { backgroundColor: Colors.surfaceContainerLow, borderWidth: 1, borderColor: Colors.outlineVariant, borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', flex: 1 }]}>
                            <View style={{ flex: 1 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Lock size={13} color={Colors.outline} />
                                <Text style={{ fontSize: 13, color: Colors.outline }} numberOfLines={1}>{step.activity || t('flow.untitled_schedule', 'Untitled Schedule')}</Text>
                              </View>
                              <Text style={{ fontSize: 11, color: Colors.outlineVariant, marginTop: 4 }}>{t('flow.locked_premium', '재구독 시 복원')}</Text>
                            </View>
                          </View>
                        ) : (
                          <Pressable
                            style={({ pressed }) => [styles.stepInfoCard, pressed && { opacity: 0.7 }, { flex: 1 }]}
                            onPress={() => openEditStep(step)}
                          >
                            <View style={styles.stepHeader}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.stepActivity} numberOfLines={1}>
                                  {step.activity && step.activity.trim() !== '' ? step.activity : t('flow.untitled_schedule', 'Untitled Schedule')}
                                </Text>
                                {step.memo ? <Text style={styles.stepMemo} numberOfLines={2}>{step.memo}</Text> : null}
                              </View>
                              {step.weather && (
                                <View style={{ marginLeft: 8 }}>
                                  {renderWeatherIcon(typeof step.weather === 'object' ? step.weather.condKey : 'sunny', 20, Colors.primary, step.weather?.isDay !== false)}
                                </View>
                              )}
                            </View>
                          </Pressable>
                        )}
                        
                        {/* 쓰레기통 버튼을 버블 밖으로 이동 */}
                        <GHButton 
                          onPress={() => deleteStepById(step.id)} 
                          hitSlop={{ top: 20, bottom: 20, left: 10, right: 20 }} 
                          style={styles.deleteBtnOuter}
                        >
                          <Trash2 size={18} color={Colors.outlineVariant} />
                        </GHButton>
                      </View>
                    </View>
                  ))}
                </View>
              ))
            ) : (
              <View style={styles.emptyFlow}>
                <Navigation size={40} color={Colors.outlineVariant} strokeWidth={1} />
                <Text style={styles.emptyFlowText}>{t('flow.no_schedules', 'No schedules added yet.')}</Text>
              </View>
            )}

            {/* 공유 이미지 전용 푸터 (워터마크) */}
            <View style={{ marginTop: 32, paddingVertical: 16, borderTopWidth: 1, borderTopColor: Colors.outlineVariant + '30', alignItems: 'center' }}>
              <Text style={{ fontSize: 12, color: Colors.outline, fontWeight: '700', letterSpacing: 1 }}>TODO WEATHER</Text>
              <Text style={{ fontSize: 10, color: Colors.outline, marginTop: 2, opacity: 0.6 }}>Your smart event-based weather planner</Text>
            </View>
          </ViewShot>

          <View style={styles.centerButtonWrap}>
            <Pressable 
              style={({ pressed }) => [styles.addStepDetail, pressed && { opacity: 0.7, backgroundColor: 'rgba(0, 102, 138, 0.08)' }]} 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setEditingStep(null);
                setEditActivity('');
                setEditMemo('');
                setEditDate(new Date().toISOString().split('T')[0]);
                setEditTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
                setSelectedRegion(null);
                openEditModal(true);
              }}
              hitSlop={{ top: 5, bottom: 5, left: 5, right: 5 }}
            >
              <Plus size={20} color={Colors.primary} />
              <Text style={styles.addStepText}>{t('flow.add_schedule', 'Add Schedule')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={[styles.container, { paddingTop: Constants.statusBarHeight }]}>
        {!selectedFlow && (
          <>
            <MainHeader onMenuPress={() => setMenuVisible(true)} />
            <View style={{ flex: 1 }}>
              {isLoading ? (
                <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 50 }} />
              ) : (
                <DraggableFlatList
                  ref={flatListRef}
                  data={displayFlows || []}
                  keyExtractor={(item) => item.id}
                  onDragEnd={({ data }) => { setFlows(data); saveFlows(data); }}
                  activationDistance={20}
                  renderItem={({ item: flow, drag, isActive }) => (
                    <ScaleDecorator>
                      <View style={styles.flowCardContainer}>
                        {flow.inactive ? (
                          <View style={styles.flowCardLocked}>
                            <LinearGradient colors={['#9ca3af', '#6b7280']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.flowCard, { opacity: 0.7 }]}>
                              <BorderlessButton
                                onPress={() => {
                                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                                  handleDeleteFlow(flow.id);
                                }}
                                hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
                                style={styles.deleteBtnAbsolute}
                              >
                                <Trash2 size={18} color="rgba(255,255,255,0.8)" />
                              </BorderlessButton>
                              <View style={styles.cardMainArea}>
                                <Text style={styles.cardTitle}>{flow.title}</Text>
                                <View style={styles.dateRow}><Calendar size={14} color="rgba(255,255,255,0.8)" /><Text style={styles.cardDate}>{getLocalizedPeriod(flow.period)}</Text></View>
                              </View>
                              <View style={styles.cardBottom}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <Lock size={12} color="rgba(255,255,255,0.9)" />
                                  <Text style={styles.tagText}>{t('flow.locked_premium', '구독 해지로 비활성화됨 — 재구독 시 복원')}</Text>
                                </View>
                              </View>
                            </LinearGradient>
                          </View>
                        ) : (
                        <GHButton
                          onLongPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            drag();
                          }}
                          onPress={() => setSelectedFlow(flow)}
                          style={[isActive && { opacity: 0.8, transform: [{ scale: 1.02 }] }]}
                          activeOpacity={0.9}
                          delayLongPress={250}
                        >
                          <LinearGradient colors={flow.gradient || ['#6366f1', '#a855f7']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.flowCard}>
                            <BorderlessButton
                              onPress={() => {
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                                handleDeleteFlow(flow.id);
                              }}
                              hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}
                              style={styles.deleteBtnAbsolute}
                            >
                              <Trash2 size={18} color="rgba(255,255,255,0.8)" />
                            </BorderlessButton>

                            <View style={styles.cardMainArea}>
                              <Text style={styles.cardTitle}>{flow.title}</Text>
                              <View style={styles.dateRow}><Calendar size={14} color="rgba(255,255,255,0.8)" /><Text style={styles.cardDate}>{getLocalizedPeriod(flow.period)}</Text></View>
                            </View>
                            <View style={styles.cardBottom}>
                              <View style={styles.progressContainer}><View style={[styles.progressBar, { width: `${(flow.progress || 0) * 100}%` }]} /></View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                  <MapPin size={12} color="rgba(255,255,255,0.9)" />
                                  <Text style={styles.tagText} numberOfLines={1}>
                                    {(!flow.location || flow.location === 'No Region') ? t('flow.no_region', 'No Region') : flow.location}
                                  </Text>
                                </View>
                              <View style={styles.weatherSummary}>
                                <View style={{ marginRight: 6 }}>
                                  {renderWeatherIcon(
                                    (() => {
                                      if (flow.weatherCondKey) return flow.weatherCondKey;
                                      const s = (flow.weatherSummary || '').toLowerCase();
                                      if (s.includes('rain') || s.includes('drizzle')) return 'rainy';
                                      if (s.includes('snow')) return 'snowy';
                                      if (s.includes('thunder') || s.includes('storm')) return 'thunderstorm';
                                      if (s.includes('sunny') || s.includes('clear')) return 'sunny';
                                      if (s.includes('cloud') || s.includes('overcast') || s.includes('mist') || s.includes('fog')) return 'cloudy';
                                      return 'cloudy';
                                    })(),
                                    16, "white", flow.weatherIsDay !== false
                                  )}
                                </View>
                                <Text style={styles.weatherText} numberOfLines={1}>
                                  {flow.weatherTemp && flow.weatherCondKey
                                    ? `${t('weather.currently', 'Currently')} ${formatTemp(flow.weatherTemp)}, ${t(`weather.${flow.weatherCondKey}`, flow.weatherCondKey)}`
                                    : flow.weatherSummary && flow.weatherSummary !== 'Weather not set'
                                      ? flow.weatherSummary
                                      : t('flow.weather_not_set', 'Weather not set')}
                                </Text>
                              </View>
                            </View>
                          </LinearGradient>
                        </GHButton>
                        )}
                      </View>
                    </ScaleDecorator>
                  )}
                  ListHeaderComponent={
                    <View>
                      <View style={styles.listHeader}>
                        <View style={styles.headerTopRow}>
                          <View>
                            <Text style={styles.screenTitle}>{t('flow.my_flows', 'My Flows')}</Text>
                            <Text style={styles.screenSubtitle}>{t('flow.curated_journeys', 'Curated journeys')}</Text>
                          </View>
                          <View style={{ width: 52 }} />
                        </View>
                      </View>

                      {/* Top Banner Ad for Flow Screen */}
                      <View style={{ marginBottom: 12, alignItems: 'center' }}>
                        <AdBanner />
                      </View>
                    </View>
                  }
                  contentContainerStyle={styles.listContent}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
            <View style={[StyleSheet.absoluteFill, { zIndex: 999 }]} pointerEvents="box-none">
            <Pressable
              style={({ pressed }) => [
                {
                  position: 'absolute',
                  bottom: Math.max(insets.bottom, 20) + 10 + 64 + 16,
                  right: 30,
                  width: 64, height: 64, borderRadius: 32,
                  backgroundColor: '#111827',
                  justifyContent: 'center', alignItems: 'center',
                  shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.35, shadowRadius: 10, elevation: 12,
                },
                pressed && { opacity: 0.8, transform: [{ scale: 0.92 }] }
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                openFlowModal();
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <View pointerEvents="none">
                <Plus size={32} color="white" strokeWidth={3} />
              </View>
            </Pressable>
          </View>
          </>
        )}

        {selectedFlow && renderTimelineDetail()}

        {/* --- Flow Modal --- */}
        <Modal
          visible={flowModalVisible}
          transparent={true}
          animationType="none"
          onRequestClose={closeFlowModal}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Pressable style={[StyleSheet.absoluteFill, styles.modalBg]} onPress={closeFlowModal} />
            <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
              <Animated.View style={[styles.editModalContent, { transform: [{ translateY: Animated.subtract(flowPanY, flowKeyboardOffset) }] }]}>
                    <View {...flowPanResponder.panHandlers} style={styles.handleArea}>
                      <View style={styles.modalHandle} />
                    </View>
                    <View style={styles.editHeader}>
                      <View style={{ width: 40 }} />
                      <Text style={styles.editTitle}>{editingFlow ? t('flow.edit_flow', 'Edit Flow') : t('flow.new_flow', 'New Flow')}</Text>
                      <Pressable onPress={isKeyboardVisible ? Keyboard.dismiss : saveFlow} style={styles.headerActionBtn}>
                        {isKeyboardVisible ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><KeyboardIcon size={18} color={Colors.primary} /><ChevronDown size={14} color={Colors.primary} /></View>
                        ) : (
                          <Text style={styles.headerSaveText}>{t('common.save', 'Save')}</Text>
                        )}
                      </Pressable>
                    </View>

                    <ScrollView showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
                      <View style={styles.modalContentPadding}>
                        <Text style={styles.inputLabel}>{t('flow.flow_title', 'Flow Title')} <Text style={styles.requiredAsterisk}>*</Text></Text>
                        <View style={[styles.compactInputRow, !flowTitle && styles.compactInputRowRequired]}>
                          <Flag size={18} color={flowTitle ? Colors.primary : Colors.error} />
                          <TextInput ref={flowTitleRef} style={styles.compactInput} value={flowTitle} onChangeText={setFlowTitle} placeholder={t('flow.flow_title_placeholder', 'e.g. Hawaii Trip, Morning Routine')} placeholderTextColor={Colors.outline} autoCapitalize="none" onFocus={() => { focusedFlowInputRef.current = flowTitleRef.current; }} onBlur={() => { focusedFlowInputRef.current = null; }} />
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <View style={styles.labelRow}><Text style={styles.inputLabel}>{t('flow.base_region', 'Base Region')}</Text><Pressable onPress={() => openSearch('flow')} style={({ pressed }) => [styles.searchAccessoryBtn, pressed && { opacity: 0.7 }]}><Search size={14} color={Colors.primary} /><Text style={styles.searchAccessoryText}>{t('common.find', 'Find')}</Text></Pressable></View>
                        <View style={styles.regionDisplay}>
                          {(() => { const hasLocation = flowLocation && flowLocation !== 'No Region'; return (<>
                          <MapPin size={18} color={hasLocation ? Colors.primary : Colors.outline} />
                          <Text style={[styles.regionDisplayText, !hasLocation && { color: Colors.outline }]}>
                            {hasLocation ? flowLocation : t('flow.not_set_global', 'Not set (Global)')}
                          </Text>
                          {hasLocation && (
                            <Pressable onPress={() => { setFlowLocation(''); setFlowLat(null); setFlowLon(null); }}>
                              <X size={16} color={Colors.outline} />
                            </Pressable>
                          )}</>); })()}
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>{t('flow.description', 'Description')}</Text>
                        <View style={styles.compactInputRow}><Edit3 size={18} color={Colors.primary} /><TextInput ref={flowDescRef} style={styles.compactInput} value={flowDescription} onChangeText={setFlowDescription} placeholder={t('flow.description_placeholder', 'What is this flow about?')} placeholderTextColor={Colors.outline} autoCapitalize="none" onFocus={() => { focusedFlowInputRef.current = flowDescRef.current; }} onBlur={() => { focusedFlowInputRef.current = null; }} /></View>
                      </View>

                      <View style={{ height: 100 }} />
                    </ScrollView>

                    {searchModalVisible && searchMode === 'flow' && renderSearchLayer()}
              </Animated.View>
            </View>
          </GestureHandlerRootView>
        </Modal>

        {/* --- Step Modal --- */}
        <Modal
          visible={editModalVisible}
          transparent={true}
          animationType="none"
          onRequestClose={closeEditModal}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Pressable style={[StyleSheet.absoluteFill, styles.modalBg]} onPress={closeEditModal} />
            <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
              <Animated.View style={[styles.editModalContent, { transform: [{ translateY: panY }] }]}>
                    <View {...panResponder.panHandlers} style={styles.handleArea}>
                      <View style={styles.modalHandle} />
                    </View>
                    <View style={styles.editHeader}>
                      {editingStep ? (
                        <GHButton 
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            deleteStep();
                          }} 
                          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }} 
                          style={styles.headerDeleteBtn}
                        >
                          <Trash2 size={22} color={Colors.error} />
                        </GHButton>
                      ) : (
                        <View style={{ width: 44 }} />
                      )}
                      <Text style={styles.editTitle}>{editingStep ? t('flow.edit_schedule', 'Edit Schedule') : t('flow.new_schedule', 'New Schedule')}</Text>
                      <GHButton 
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          isKeyboardVisible ? Keyboard.dismiss() : saveStep();
                        }} 
                        style={styles.headerActionBtn}
                        hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                      >
                        {isKeyboardVisible ? (
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><KeyboardIcon size={18} color={Colors.primary} /><ChevronDown size={14} color={Colors.primary} /></View>
                        ) : (
                          <Text style={styles.headerSaveText}>{t('common.save', 'Save')}</Text>
                        )}
                      </GHButton>
                    </View>

                    <ScrollView ref={stepScrollRef} showsVerticalScrollIndicator={false} bounces={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true}>
                      <View style={styles.modalContentPadding}>
                        <Text style={styles.inputLabel}>{t('flow.activity', 'Activity')} <Text style={styles.requiredAsterisk}>*</Text></Text>
                        <View style={[styles.compactInputRow, !editActivity && styles.compactInputRowRequired]}>
                          <Edit3 size={18} color={editActivity ? Colors.primary : Colors.error} />
                          <TextInput ref={activityInputRef} style={styles.compactInput} value={editActivity} onChangeText={setEditActivity} placeholder={t('flow.activity_placeholder', 'What are you doing?')} placeholderTextColor={Colors.outline} autoCapitalize="none" />
                        </View>
                      </View>

                      <View style={styles.inputGroup}>
                        <View style={styles.labelRow}><Text style={styles.inputLabel}>{t('flow.weather_region', 'Weather Region')}</Text><Pressable onPress={() => openSearch('step')} style={({ pressed }) => [styles.searchAccessoryBtn, pressed && { opacity: 0.7 }]}><Search size={14} color={Colors.primary} /><Text style={styles.searchAccessoryText}>{t('common.find', 'Find')}</Text></Pressable></View>
                        <View style={styles.regionDisplay}><MapPin size={18} color={selectedRegion ? Colors.primary : Colors.outline} /><Text style={[styles.regionDisplayText, !selectedRegion && { color: Colors.outline }]}>{selectedRegion ? selectedRegion.name : t('flow.no_region', 'No region selected')}</Text>{selectedRegion && <Pressable onPress={() => setSelectedRegion(null)}><X size={16} color={Colors.outline} /></Pressable>}</View>
                      </View>

                      <View style={styles.rowInputs}>
                        <View style={[styles.inputGroup, { flex: 1.3, marginRight: 10 }]}>
                          <View style={styles.labelRow}>
                            <Text style={styles.inputLabel}>{t('flow.start_date', 'Start Date')}</Text>
                            {editDate ? (
                              <Pressable onPress={() => setEditDate('')} hitSlop={10}>
                                <Text style={styles.resetText}>{t('common.reset', 'Reset')}</Text>
                              </Pressable>
                            ) : null}
                          </View>
                          <Pressable
                            style={({ pressed }) => [styles.editInputWrap, pressed && { opacity: 0.7 }]}
                            onPress={() => { Keyboard.dismiss(); pickerBackupRef.current = { editDate, editTime, editEndDate, editEndTime }; setPickerType('startDate'); }}
                          >
                            <Calendar size={18} color={Colors.primary} style={{ marginRight: 8 }} />
                            <Text style={[styles.editInputText, !editDate && { color: Colors.outline }]} numberOfLines={1}>
                              {editDate || '--/--'}
                            </Text>
                          </Pressable>
                        </View>

                        <View style={[styles.inputGroup, { flex: 1 }]}>
                          <View style={styles.labelRow}>
                            <Text style={styles.inputLabel}>{t('common.start_time', 'Time')}</Text>
                            {editTime ? (
                              <Pressable onPress={() => setEditTime('')} hitSlop={10}>
                                <Text style={styles.resetText}>{t('common.reset', 'Reset')}</Text>
                              </Pressable>
                            ) : null}
                          </View>
                          <Pressable
                            style={({ pressed }) => [styles.editInputWrap, pressed && { opacity: 0.7 }]}
                            onPress={() => { Keyboard.dismiss(); pickerBackupRef.current = { editDate, editTime, editEndDate, editEndTime }; setPickerType('startTime'); }}
                          >
                            <Clock size={18} color={Colors.primary} style={{ marginRight: 8 }} />
                            <Text style={[styles.editInputText, !editTime && { color: Colors.outline }]} numberOfLines={1}>
                              {editTime || '--:--'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <Text style={[styles.inputLabel, { marginBottom: 0 }]}>{t('flow.same_as_start', 'Same as start date/time')}</Text>
                        <Switch
                          value={matchStartDate}
                          onValueChange={(val) => {
                            setMatchStartDate(val);
                            if (val) {
                              setEditEndDate(editDate);
                              setEditEndTime(editTime);
                            }
                          }}
                          trackColor={{ false: Colors.surfaceContainerHigh, true: Colors.primary }}
                          thumbColor={'white'}
                        />
                      </View>

                      <View style={styles.rowInputs}>
                        <View style={[styles.inputGroup, { flex: 1.3, marginRight: 10 }]}>
                          <View style={styles.labelRow}>
                            <Text style={styles.inputLabel}>{t('flow.end_date', 'End Date')}</Text>
                            {editEndDate ? (
                              <Pressable onPress={() => { setEditEndDate(''); setMatchStartDate(false); }} hitSlop={10}>
                                <Text style={styles.resetText}>{t('common.reset', 'Reset')}</Text>
                              </Pressable>
                            ) : null}
                          </View>
                          <Pressable
                            style={({ pressed }) => [styles.editInputWrap, pressed && { opacity: 0.7 }]}
                            onPress={() => { Keyboard.dismiss(); pickerBackupRef.current = { editDate, editTime, editEndDate, editEndTime }; setPickerType('endDate'); }}
                          >
                            <Calendar size={18} color={Colors.primary} style={{ marginRight: 8 }} />
                            <Text style={[styles.editInputText, !editEndDate && { color: Colors.outline }]} numberOfLines={1}>
                              {editEndDate || '--/--'}
                            </Text>
                          </Pressable>
                        </View>

                        <View style={[styles.inputGroup, { flex: 1 }]}>
                          <View style={styles.labelRow}>
                            <Text style={styles.inputLabel}>{t('common.end_time', 'Time')}</Text>
                            {editEndTime ? (
                              <Pressable onPress={() => { setEditEndTime(''); setMatchStartDate(false); }} hitSlop={10}>
                                <Text style={styles.resetText}>{t('common.reset', 'Reset')}</Text>
                              </Pressable>
                            ) : null}
                          </View>
                          <Pressable
                            style={({ pressed }) => [styles.editInputWrap, pressed && { opacity: 0.7 }]}
                            onPress={() => { Keyboard.dismiss(); pickerBackupRef.current = { editDate, editTime, editEndDate, editEndTime }; setPickerType('endTime'); }}
                          >
                            <Clock size={18} color={Colors.primary} style={{ marginRight: 8 }} />
                            <Text style={[styles.editInputText, !editEndTime && { color: Colors.outline }]} numberOfLines={1}>
                              {editEndTime || '--:--'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>

                      <View
                        style={styles.inputGroup}
                        onLayout={(e) => { memoYRef.current = e.nativeEvent.layout.y; }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <Text style={styles.inputLabel}>{t('common.memo', 'Memo')}</Text>
                          <Text style={styles.charCount}>{editMemo.length}/500</Text>
                        </View>
                        <TextInput
                          style={styles.memoInlineInput}
                          value={editMemo}
                          onChangeText={setEditMemo}
                          placeholder={t('flow.memo_placeholder', 'Add detailed notes or addresses...')}
                          placeholderTextColor={Colors.outline}
                          multiline
                          textAlignVertical="top"
                          maxLength={500}
                          autoCapitalize="none"
                          onFocus={() => setTimeout(() => stepScrollRef.current?.scrollTo({ y: memoYRef.current - 12, animated: true }), 150)}
                        />
                      </View>

                      <View style={{ marginVertical: 12, alignItems: 'center' }}>
                        <AdBanner size={BannerAdSize.MEDIUM_RECTANGLE} />
                      </View>
                      <View style={{ height: 12 }} />
                    </ScrollView>

                    {searchModalVisible && searchMode === 'step' && renderSearchLayer()}
              </Animated.View>
            </View>

            {/* Date / Time Picker Overlay */}
            {(pickerType) && (
              <View style={[StyleSheet.absoluteFillObject, styles.pickerOverlay]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={() => { 
                  setEditDate(pickerBackupRef.current.editDate); 
                  setEditTime(pickerBackupRef.current.editTime); 
                  setEditEndDate(pickerBackupRef.current.editEndDate);
                  setEditEndTime(pickerBackupRef.current.editEndTime);
                  setPickerType(null); 
                }} />
                <View style={[styles.pickerSheet, (pickerType === 'startDate' || pickerType === 'endDate') && { height: 490 }]}>
                  <View style={{ width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 4 }} />
                  <View style={styles.pickerHeader}>
                    <Pressable onPress={() => { 
                      setEditDate(pickerBackupRef.current.editDate); 
                      setEditTime(pickerBackupRef.current.editTime); 
                      setEditEndDate(pickerBackupRef.current.editEndDate);
                      setEditEndTime(pickerBackupRef.current.editEndTime);
                      setPickerType(null); 
                    }} style={{ padding: 4 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.textSecondary }}>{t('common.cancel', 'Cancel')}</Text>
                    </Pressable>
                    <Text style={styles.pickerTitle}>
                      {pickerType === 'startDate' ? t('flow.start_date', 'Start Date') : 
                       pickerType === 'endDate' ? t('flow.end_date', 'End Date') : 
                       pickerType === 'startTime' ? t('common.start_time', 'Start Time') : 
                       t('common.end_time', 'End Time')}
                    </Text>
                    <Pressable onPress={() => setPickerType(null)} style={styles.pickerDoneBtn}>
                      <Text style={styles.pickerDoneText}>{t('common.done', 'Done')}</Text>
                    </Pressable>
                  </View>
                  {(pickerType === 'startDate' || pickerType === 'endDate') ? (
                    <DateTimePicker
                      value={new Date((pickerType === 'startDate' ? editDate : editEndDate) || Date.now())}
                      mode="date"
                      display="inline"
                      accentColor={Colors.primary}
                      onChange={onDateChange}
                      minimumDate={new Date(2020, 0, 1)}
                      style={{ width: width - 32, height: 360, alignSelf: 'center' }}
                      locale={i18n.language}
                      key={`date-${i18n.language}-${pickerType}`}
                    />
                  ) : (
                    <View style={{ height: 216, justifyContent: 'center', backgroundColor: 'white' }}>
                      <DateTimePicker
                        value={(() => {
                          const timeVal = pickerType === 'startTime' ? editTime : editEndTime;
                          const [h, m] = (timeVal || '00:00').split(':');
                          const d = new Date(); d.setHours(parseInt(h), parseInt(m)); return d;
                        })()}
                        mode="time"
                        display="spinner"
                        is24Hour={true}
                        textColor="black"
                        onChange={onTimeChange}
                        style={{ height: 216, width: width - 32, alignSelf: 'center' }}
                        locale={i18n.language}
                        key={`time-${i18n.language}-${pickerType}`}
                      />
                    </View>
                  )}
                </View>
              </View>
            )}
          </GestureHandlerRootView>
        </Modal>

        <MenuModal visible={menuVisible} onClose={() => setMenuVisible(false)} onReset={() => { loadInitialData(); }} />
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 220, paddingTop: Spacing.md },
  listHeader: { marginBottom: 0, marginTop: Spacing.md },
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
  flowCardLocked: { borderRadius: 32, overflow: 'hidden' },
  flowCard: { padding: Spacing.xl, borderRadius: 32, height: 220, justifyContent: 'space-between' },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deleteBtnAbsolute: { position: 'absolute', top: Spacing.lg, right: Spacing.lg, padding: 8, zIndex: 10 },
  cardMainArea: { marginTop: Spacing.xs },
  tagContainer: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  tagText: { color: 'white', fontSize: 12, fontWeight: '700' },
  deleteBtn: { padding: 10 },
  cardMiddle: { marginTop: Spacing.md },
  cardTitle: { ...Typography.h2, color: 'white', fontSize: 26, lineHeight: 32 },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 6 },
  cardDate: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500' },
  cardBottom: { marginTop: Spacing.lg },
  progressContainer: { height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginBottom: 12, overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: 'white', borderRadius: 2 },
  weatherSummary: { flexDirection: 'row', alignItems: 'center' },
  weatherText: { color: 'white', fontSize: 13, fontWeight: '600', flex: 1 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerAddBtn: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    ...Platform.select({ ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } })
  },
  detailContainer: { flex: 1, backgroundColor: Colors.background, paddingTop: Platform.OS === 'ios' ? 44 : 0 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, height: 60, borderBottomWidth: 1, borderBottomColor: Colors.outlineVariant + '20' },
  headerLeft: { width: 50, alignItems: 'flex-start', justifyContent: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRight: { width: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  detailHeaderTitle: { ...Typography.h3, fontSize: 17, color: Colors.onBackground, textAlign: 'center' },
  iconBtn: { padding: 8 },
  detailContent: { paddingHorizontal: Spacing.lg, paddingBottom: 200, paddingTop: Spacing.sm },
  heroSection: { marginBottom: Spacing.xl },
  heroDate: { ...Typography.bodySmall, color: Colors.primary, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 },
  heroLocationRow: { 
    flexDirection: 'row', alignItems: 'center', marginTop: Spacing.xs, justifyContent: 'space-between',
    backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 20,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 }, android: { elevation: 2 } })
  },
  locationMain: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 12 },
  heroWeather: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 12, borderLeftWidth: 1, borderLeftColor: 'rgba(0,0,0,0.05)' },
  heroTemp: { ...Typography.bodyMedium, fontWeight: '800', color: Colors.onBackground },
  dayGroup: { marginBottom: 16 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, paddingHorizontal: 16 },
  dayBadge: { backgroundColor: Colors.primary, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginRight: 8 },
  dayBadgeText: { ...Typography.labelSmall, color: 'white', fontWeight: '800' },
  dayDateText: { ...Typography.bodyLarge, fontWeight: '800', color: Colors.onBackground },
  stepRow: { flexDirection: 'row', paddingLeft: 12, paddingRight: 4, marginBottom: 8 },
  timeCol: { width: 45, alignItems: 'flex-end', paddingTop: 8 },
  timeText: { ...Typography.labelMedium, fontWeight: '800', color: Colors.onBackground },
  timelineCol: { width: 32, alignItems: 'center' },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.outlineVariant, marginTop: 14, borderWidth: 2, borderColor: 'white' },
  dotCurrent: { backgroundColor: Colors.primary, width: 12, height: 12, borderRadius: 6, borderWidth: 3, borderColor: 'rgba(0, 102, 138, 0.2)' },
  dotCompleted: { backgroundColor: Colors.secondary },
  timelineLine: { width: 1.5, flex: 1, backgroundColor: Colors.outlineVariant, opacity: 0.3, marginVertical: 4 },
  stepInfoCard: {
    backgroundColor: 'white', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 14, marginLeft: 12, marginBottom: Spacing.sm, minHeight: 68, justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.03)',
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8 }, android: { elevation: 2 } })
  },
  deleteBtnOuter: {
    padding: 10,
    marginLeft: 4,
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.6,
  },
  activeStepCard: { borderColor: 'rgba(0, 102, 138, 0.15)', ...Platform.select({ ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20 }, android: { elevation: 6 } }) },
  warningStepCard: { borderWidth: 1.5, borderColor: 'rgba(239, 68, 68, 0.2)' },
  stepHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  stepActivity: { ...Typography.h3, fontSize: 16, color: Colors.onBackground, fontWeight: '700', letterSpacing: -0.3 },
  stepMemo: { ...Typography.caption, color: Colors.outline, marginTop: 4, lineHeight: 16 },
  stepRegionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  stepRegionLabel: { fontSize: 11, color: Colors.outline, fontWeight: '600', maxWidth: 120 },
  warningBadge: { backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: 10, borderRadius: 12, marginTop: 12 },
  warningText: { fontSize: 12, color: '#dc2626', fontWeight: '600' },
  centerButtonWrap: { alignItems: 'center', marginTop: Spacing.xl },
  addStepDetail: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, paddingHorizontal: 32, borderRadius: 20,
    borderWidth: 1.5, borderColor: 'rgba(0, 102, 138, 0.15)', borderStyle: 'dashed',
    backgroundColor: 'rgba(0, 102, 138, 0.03)', gap: 10,
  },
  addStepText: { ...Typography.body, fontWeight: '800', color: Colors.primary, letterSpacing: -0.5 },
  emptyFlow: { alignItems: 'center', padding: 60, gap: 16 },
  emptyFlowText: { ...Typography.bodySmall, color: Colors.outline },
  rowInputs: { flexDirection: 'row', width: '100%', alignItems: 'flex-start', justifyContent: 'space-between' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
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
  modalBg: { backgroundColor: 'rgba(0,0,0,0.5)' },
  editModalContent: { backgroundColor: Colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingTop: 0, paddingHorizontal: Spacing.xl, paddingBottom: Platform.OS === 'ios' ? 40 : 20, maxHeight: height * 0.9 },
  editHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  editTitle: { ...Typography.h2, fontSize: 24, letterSpacing: -0.5, color: Colors.onBackground },
  modalHandle: { width: 40, height: 4, backgroundColor: Colors.outlineVariant, borderRadius: 2, alignSelf: 'center', marginBottom: 16, opacity: 0.5 },
  headerActionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(0, 191, 255, 0.05)' },
  headerSaveText: { ...Typography.body, fontWeight: '800', color: Colors.primary },
  searchAccessoryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0, 191, 255, 0.08)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  searchAccessoryText: { fontSize: 13, fontWeight: '700', color: Colors.primary },
  modalContentPadding: { marginBottom: Spacing.xl },
  handleArea: { alignItems: 'center', paddingTop: 12, paddingBottom: 12 },
  charCount: { fontSize: 12, color: Colors.outline, fontWeight: '500' },
  headerDeleteBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,59,48,0.08)', alignItems: 'center', justifyContent: 'center' },
  requiredAsterisk: { color: Colors.error, fontWeight: '700' },
  compactInputRowRequired: { borderColor: 'rgba(255,59,48,0.35)', borderWidth: 1.5 },
  inputGroup: { marginBottom: Spacing.xl },
  inputLabel: { ...Typography.bodySmall, color: Colors.onBackground, fontWeight: '800', opacity: 0.8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, height: 20 },
  resetText: { fontSize: 12, color: Colors.primary, fontWeight: '700' },
  editInputWrap: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 16, paddingHorizontal: 16, height: 60, borderWidth: 1.5, borderColor: Colors.surfaceContainerLow,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 2 } })
  },
  editInput: { flex: 1, ...Typography.body, fontSize: 16, color: Colors.onBackground, fontWeight: '600' },
  regionSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerLow, borderRadius: 24, padding: 16, gap: 16 },
  regionSelectorActive: { backgroundColor: 'white', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 10 }, android: { elevation: 6 } }) },
  regionIconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: Colors.surfaceContainer, alignItems: 'center', justifyContent: 'center' },
  regionIconWrapActive: { backgroundColor: Colors.primary },
  regionInfo: { flex: 1 },
  regionMainText: { ...Typography.h3, fontSize: 16, color: Colors.onBackground },
  regionPlaceholder: { color: Colors.outline, fontWeight: '500' },
  regionSubText: { ...Typography.bodySmall, color: Colors.onSurfaceVariant, marginTop: 2, fontSize: 12 },
  premiumSubmitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 64, borderRadius: 24, gap: 12, marginTop: 8,
    ...Platform.select({ ios: { shadowColor: Colors.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15 }, android: { elevation: 6 } })
  },
  premiumSubmitText: { color: 'white', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  editInputText: { ...Typography.body, fontSize: 14.5, color: Colors.onBackground, fontWeight: '600' },
  inputClearBtn: { padding: 8, marginLeft: 4, backgroundColor: Colors.surfaceContainer, borderRadius: 10 },
  pickerContainer: { backgroundColor: Colors.surfaceContainerLowest, borderRadius: 24, marginTop: 8, marginBottom: 20, overflow: 'hidden', paddingBottom: 8 },
  modalFooter: { flexDirection: 'row', gap: 12, marginTop: 20, marginBottom: 20, alignItems: 'center' },
  // Picker Sheet Styles
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  pickerSheet: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingBottom: 40, overflow: 'hidden' },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainerLow },
  pickerTitle: { ...Typography.h3, fontSize: 18, color: Colors.onBackground },
  pickerDoneBtn: { paddingVertical: 8, paddingHorizontal: 16, backgroundColor: Colors.primaryContainer, borderRadius: 12 },
  pickerDoneText: { color: Colors.primary, fontWeight: '700', fontSize: 15 },
  pickerContent: { paddingVertical: 10, alignItems: 'center' },
  deleteAction: { width: 56, height: 56, borderRadius: 16, backgroundColor: '#FFE5E5', justifyContent: 'center', alignItems: 'center' },
  saveAction: { flex: 1, height: 56, borderRadius: 16, overflow: 'hidden', backgroundColor: Colors.primary },
  saveGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveActionText: { color: 'white', fontWeight: '700', fontSize: 16 },
  compactInputRow: { 
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 20, paddingHorizontal: 16, height: 56, gap: 12, borderWidth: 1.5, borderColor: Colors.surfaceContainerLow,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 2 } })
  },
  compactInputText: { flex: 1, ...Typography.body, fontSize: 16, color: Colors.onBackground, fontWeight: '600' },
  compactInput: { flex: 1, ...Typography.body, fontSize: 16, color: Colors.onBackground, fontWeight: '600', paddingVertical: 0, textAlignVertical: 'center', lineHeight: undefined },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingRight: 4 },
  regionDisplay: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceContainerLow, padding: 12, borderRadius: 16, gap: 10, borderWidth: 1, borderColor: Colors.outlineVariant, opacity: 0.9 },
  memoInlineInput: {
    backgroundColor: 'white', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14,
    minHeight: 90, maxHeight: 180, borderWidth: 1.5, borderColor: Colors.surfaceContainerLow,
    ...Typography.body, fontSize: 15, color: Colors.onBackground, lineHeight: 22,
    ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }, android: { elevation: 2 } })
  },
  pickerConfirmBtn: { backgroundColor: 'rgba(0, 191, 255, 0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  pickerConfirmText: { color: Colors.primary, fontWeight: '800', fontSize: 14 },
  flowAdWrapper: {
    backgroundColor: 'white',
    marginBottom: Spacing.lg,
    borderRadius: 32,
    padding: Spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 270,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.1, shadowRadius: 15 },
      android: { elevation: 6 }
    }),
  },
  adBadge: {
    position: 'absolute',
    top: 10,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    zIndex: 10,
  },
  adBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.onSurfaceVariant,
    letterSpacing: 0.5,
  },
  bannerAdWrapper: {
    marginTop: 8,
    marginBottom: 12,
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
});

export default FlowScreen;
