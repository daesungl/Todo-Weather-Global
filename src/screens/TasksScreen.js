import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Animated,
  Platform,
  FlatList,
  Keyboard,
  Switch,
  useWindowDimensions,
  PanResponder,
  KeyboardAvoidingView,
  Pressable,
  TouchableOpacity,
} from 'react-native';
import { GestureHandlerRootView, TouchableOpacity as GHButton } from 'react-native-gesture-handler';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { useFocusEffect } from '@react-navigation/native';
import {
  Plus, MapPin, Clock, Calendar, ChevronLeft, ChevronRight,
  CheckCircle2, Circle, Search, X, Sun, CloudRain, Cloud,
  CloudSnow, Moon, CheckSquare, Square, Trash2, CalendarDays, Compass,
  Pencil, AlignLeft, Eye, MoreHorizontal, Share2, CornerUpLeft, ArrowRight, Tag, Keyboard as KeyboardIcon, ChevronDown
} from 'lucide-react-native';
import { Colors, Spacing, Typography } from '../theme';
import { getTasks, addTask, toggleTaskCompletion, deleteTask, updateTask } from '../services/task/TaskService';
import { getWeather } from '../services/weather/WeatherService';
import { searchPlaces } from '../services/weather/VWorldService';
import { searchLocations } from '../services/weather/GlobalService';
import MenuModal from '../components/MenuModal';
import MainHeader from '../components/MainHeader';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  getHolidaysForYear, 
  loadSavedCountries, 
  saveCountries, 
  isPublicHoliday,
  getSupportedCountries
} from '../services/task/HolidayService';

// Moved width/height inside component for logic, but need global for styles
const { width, height } = Dimensions.get('window');
const YEARS = Array.from({ length: 201 }, (_, i) => 1900 + i);
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const ITEM_HEIGHT = 50;
const TASK_COLOR_LABELS = [
  { name: '세이지 그린', color: '#A8B89F' },
  { name: '올리브 그린', color: '#574C00' },
  { name: '테라코타', color: '#C66B3D' },
  { name: '네이비 블루', color: '#10367D' },
  { name: '차콜', color: '#2B2B2B' },
  { name: '오렌지', color: '#EA2E00' },
  { name: '크림슨 레드', color: '#B40023' },
  { name: '다크 블루', color: '#2A234F' },
  { name: '블러쉬 핑크', color: '#FFB3C3' },
  { name: '머스타드', color: '#887114' },
  { name: '포레스트 그린', color: '#06530B' },
  { name: '파스텔 퍼플', color: '#BBBFEC' },
  { name: '라벤더', color: '#EBEBEB' },
  { name: '크림', color: '#F4EFE6' },
  { name: '아이보리', color: '#FEF9DB' },
  { name: '베이지', color: '#F0E7D6' },
];

const TASK_COLORS = TASK_COLOR_LABELS.map(l => l.color);

// Calendar Swiping Constants
const CALENDAR_START_DATE = new Date(2000, 0, 1);
const CALENDAR_MONTH_RANGE = (2100 - 2000 + 1) * 12;

const getMonthIndex = (date) => {
  return (date.getFullYear() - CALENDAR_START_DATE.getFullYear()) * 12 + date.getMonth() - CALENDAR_START_DATE.getMonth();
};

const getDateFromIndex = (index) => {
  const date = new Date(CALENDAR_START_DATE);
  date.setMonth(CALENDAR_START_DATE.getMonth() + index);
  return date;
};

const dateStr = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};
const isSameDay = (d1, d2) => dateStr(d1) === dateStr(d2);

const getMonthDays = (baseDate) => {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const days = [];
  const startPadding = firstDay.getDay(); // 0 (Sun) ~ 6 (Sat)
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = startPadding - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month - 1, prevMonthLastDay - i), current: false });
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), current: true });
  }
  
  // Fill until the end of the last week that has current month days
  const totalDays = Math.ceil(days.length / 7) * 7;
  const nextPadding = totalDays - days.length;
  for (let i = 1; i <= nextPadding; i++) {
    days.push({ date: new Date(year, month + 1, i), current: false });
  }
  return days;
};

const MonthGrid = React.memo(({ index, tasks, selectedDateStr, holidaysMap, onDayPress }) => {
  const baseDate = React.useMemo(() => getDateFromIndex(index), [index]);
  const days = React.useMemo(() => getMonthDays(baseDate), [baseDate]);
  
  const { monthTasks, taskSlots } = React.useMemo(() => {
    // 1. Filter user tasks
    const mTasksFromUser = (tasks || []).filter(t => {
      if (t.isCompleted) return false;
      const monthStart = dateStr(days[0].date);
      const monthEnd = dateStr(days[days.length - 1].date);
      return t.date <= monthEnd && (t.endDate || t.date) >= monthStart;
    });

    // 2. Convert public holidays to tasks (Group consecutive days with same name)
    const hTasks = [];
    let currentH = null;
    days.forEach(day => {
      const ds = dateStr(day.date);
      const hols = (holidaysMap[ds] || []).filter(h => h.type === 'public');
      if (hols.length > 0) {
        const name = hols[0].name;
        if (currentH && currentH.title === name) {
          currentH.endDate = ds;
        } else {
          currentH = {
            id: `h_${name}_${ds}`,
            title: name,
            date: ds,
            endDate: ds,
            color: Colors.error,
            isHoliday: true
          };
          hTasks.push(currentH);
        }
      } else {
        currentH = null;
      }
    });

    // 3. Combine and sort
    const combinedTasks = [...mTasksFromUser, ...hTasks].sort((a, b) => {
      const pA = a.isHoliday ? 0 : 1;
      const pB = b.isHoliday ? 0 : 1;
      if (pA !== pB) return pA - pB;
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const durA = new Date(a.endDate || a.date) - new Date(a.date);
      const durB = new Date(b.endDate || b.date) - new Date(b.date);
      return durB - durA;
    });

    const slots = {};
    const occ = Array.from({ length: days.length }, () => []);

    combinedTasks.forEach(task => {
      const startIdx = days.findIndex(d => dateStr(d.date) === task.date);
      const endIdx = days.findIndex(d => dateStr(d.date) === (task.endDate || task.date));
      const effectiveStart = startIdx === -1 ? 0 : startIdx;
      const effectiveEnd = endIdx === -1 ? days.length - 1 : endIdx;

      let slot = 0;
      while (slot < 4) {
        let available = true;
        for (let i = effectiveStart; i <= effectiveEnd; i++) {
          if (occ[i].includes(slot)) {
            available = false;
            break;
          }
        }
        if (available) break;
        slot++;
      }
      
      if (slot < 4) {
        slots[task.id] = slot;
        for (let i = effectiveStart; i <= effectiveEnd; i++) {
          occ[i].push(slot);
        }
      }
    });
    
    return { monthTasks: combinedTasks, taskSlots: slots };
  }, [tasks, days, holidaysMap]);

  const todayStr = React.useMemo(() => dateStr(new Date()), []);

  return (
    <View style={[styles.monthGrid, { width: width - Spacing.lg * 2 }]}>
      {days.map((day, i) => {
        const ds = dateStr(day.date);
        const isSelected = ds === selectedDateStr;
        const isToday = ds === todayStr;
        const dayTasks = monthTasks.filter(t => ds >= t.date && ds <= (t.endDate || t.date));

        return (
          <TouchableOpacity
            key={i}
            style={[
              styles.dayCellMonth,
              isSelected && { backgroundColor: '#E2E8F0' },
              { zIndex: 7 - (i % 7) } // Ensure text from left-side cells overlaps right-side cells
            ]}
            onPress={() => onDayPress(day.date, isSelected)}
          >
            <View style={styles.dayCellTop}>
              <View style={[
                styles.dayNumContainer,
                isToday && styles.todayCircle
              ]}>
                <Text style={[
                  styles.dayNum,
                  !day.current && { color: Colors.outlineVariant },
                  isToday && styles.todayText,
                  (!isToday && (isPublicHoliday(ds, holidaysMap) || day.date.getDay() === 0)) && { 
                    color: day.current ? Colors.error : Colors.error + '40' 
                  },
                  (!isToday && day.date.getDay() === 6) && { 
                    color: day.current ? Colors.secondary : Colors.secondary + '40' 
                  }
                ]}>{day.date.getDate()}</Text>
              </View>
            </View>
            <View style={styles.calendarSlotContainer}>
              {[0, 1, 2, 3].map(slotIdx => {
                const task = dayTasks.find(t => taskSlots[t.id] === slotIdx);
                if (!task) return <View key={slotIdx} style={styles.emptySlotRow} />;
                
                const isStart = ds === task.date;
                const isEnd = ds === (task.endDate || task.date);
                const isMulti = task.endDate && task.endDate !== task.date;
                const col = task.color || TASK_COLORS[(tasks || []).findIndex(gt => gt.id === task.id) % TASK_COLORS.length];
                const opacity = task.isCompleted ? '40' : (day.current ? 'CC' : '30');
                
                const startIdx = days.findIndex(d => dateStr(d.date) === task.date);
                const endIdx = days.findIndex(d => dateStr(d.date) === (task.endDate || task.date));
                // Clamp -1 (out-of-range) to calendar bounds, matching slot-calculation logic
                const effectiveStartIdx = startIdx === -1 ? 0 : startIdx;
                const effectiveEndIdx = endIdx === -1 ? days.length - 1 : endIdx;
                const weekStartIdx = Math.max(effectiveStartIdx, i - (i % 7));
                const weekEndIdx = Math.min(effectiveEndIdx, weekStartIdx + (6 - (weekStartIdx % 7)));
                const isSegmentStart = i === weekStartIdx;
                const spanInWeek = weekEndIdx - weekStartIdx + 1;
                const cellWidth = Math.floor((width - Spacing.lg * 2) / 7);

                return (
                  <View 
                    key={slotIdx} 
                    style={[
                      styles.calendarTaskBar, 
                      { backgroundColor: col + opacity },
                      isStart && styles.barStart,
                      isEnd && styles.barEnd,
                      isMulti && !isStart && { borderTopLeftRadius: 0, borderBottomLeftRadius: 0, marginLeft: -1, paddingLeft: 0 },
                      isMulti && !isEnd && { borderTopRightRadius: 0, borderBottomRightRadius: 0, marginRight: -1, paddingRight: 0 }
                    ]}
                  >
                    {isSegmentStart && spanInWeek === 1 && (
                      // Single-day: direct child so bar's flex layout centers the text
                      <Text
                        pointerEvents="none"
                        style={[
                          styles.calendarBarText,
                          { textAlign: 'center', width: '100%' },
                          !day.current && { color: 'rgba(255,255,255,0.7)' }
                        ]}
                        numberOfLines={1}
                      >
                        {task.title}
                      </Text>
                    )}
                    {isSegmentStart && spanInWeek > 1 && (
                      // Multi-day: absolute overlay spanning multiple cells
                      <View
                        pointerEvents="none"
                        style={{
                          width: cellWidth * spanInWeek,
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          justifyContent: 'center',
                          alignItems: 'center',
                          zIndex: 20,
                        }}
                      >
                        <Text
                          style={[
                            styles.calendarBarText,
                            { textAlign: 'center', width: '100%', paddingHorizontal: 2 },
                            !day.current && { color: 'rgba(255,255,255,0.7)' }
                          ]}
                          numberOfLines={1}
                        >
                          {task.title}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
              {dayTasks.length > 4 && (
                <View style={styles.moreTasksRow}>
                  <Text style={[styles.moreTasksText, !day.current && { opacity: 0.5 }]}>+{dayTasks.length - 4}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}, (prev, next) => {
  if (prev.tasks !== next.tasks) return false;
  if (prev.holidaysMap !== next.holidaysMap) return false;
  if (prev.index !== next.index) return false;
  if (prev.selectedDateStr !== next.selectedDateStr) {
    const baseDate = getDateFromIndex(prev.index);
    const mYear = baseDate.getFullYear();
    const mMonth = baseDate.getMonth();
    
    const pDate = new Date(prev.selectedDateStr);
    const nDate = new Date(next.selectedDateStr);
    
    const diffPrev = (pDate.getFullYear() - mYear) * 12 + (pDate.getMonth() - mMonth);
    const diffNext = (nDate.getFullYear() - mYear) * 12 + (nDate.getMonth() - mMonth);
    
    if (Math.abs(diffPrev) <= 1 || Math.abs(diffNext) <= 1) return false;
  }
  return true;
});

// Toast item — animation starts after mount so native driver works correctly
const ToastItem = React.memo(({ toast, bottom, onDone, styles }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]);
    anim.start(() => onDone(toast.id));
    return () => anim.stop();
  }, []);

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: toast.targetY,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [toast.targetY]);

  return (
    <Animated.View style={[styles.toastContainer, { opacity, transform: [{ translateY }], bottom }]}>
      <Text style={styles.toastText}>{toast.message}</Text>
    </Animated.View>
  );
});

const CountryItem = React.memo(({ item, isSelected, onPress }) => (
  <TouchableOpacity 
    style={styles.countryResultItem}
    onPress={() => onPress(item.code)}
  >
    <View style={{ flex: 1 }}>
      <Text style={styles.countryResultName}>{item.displayPrimary}</Text>
      {item.displaySecondary ? <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 2 }}>{item.displaySecondary}</Text> : null}
    </View>
    <Text style={styles.countryResultCode}>{item.code}</Text>
    {isSelected && <CheckCircle2 size={18} color={Colors.primary} />}
  </TouchableOpacity>
));

const SelectedCountryItem = React.memo(({ code, country, onRemove }) => (
  <View style={styles.selectedCountryItem}>
    <View>
      <Text style={styles.selectedCountryName}>{country?.displayPrimary || code}</Text>
      <Text style={styles.selectedCountryCode}>{country?.displaySecondary || country?.name || code} ({code})</Text>
    </View>
    <TouchableOpacity 
      style={styles.countryRemoveBtn}
      onPress={() => onRemove(code)}
    >
      <Trash2 size={18} color={Colors.error} />
    </TouchableOpacity>
  </View>
));

const TasksScreen = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const isKorean = i18n.language === 'ko';

  // State
  const [tasks, setTasks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [menuVisible, setMenuVisible] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isTaskListVisible, setIsTaskListVisible] = useState(false);
    
  const [selectedTaskDetail, setSelectedTaskDetail] = useState(null);
  
  // FlatList 강제 리마운트용 키 (대규모 점프 시 렉 방지)
  const [calendarListKey, setCalendarListKey] = useState('calendar-list-init');
  
  const [taskWeather, setTaskWeather] = useState({});
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();
  
  // Holiday State
  const [holidayCountries, setHolidayCountries] = useState(['KR']); // Default, will be updated from storage
  const [holidaysMap, setHolidaysMap] = useState({});

  // Picker Temporary State
  const [tempYear, setTempYear] = useState(new Date().getFullYear());
  const [tempMonth, setTempMonth] = useState(new Date().getMonth());
  const lastTickYearIndex = useRef(-1);
  const lastTickMonthIndex = useRef(-1);
  const yearListRef = useRef(null);
  const monthListRef = useRef(null);
  const titleInputRef = useRef(null);
  const modalScrollRef = useRef(null);
  const calendarListRef = useRef(null);
  const isScrollingRef = useRef(false);
  const sheetAnim = useRef(new Animated.Value(0)).current; // 0: list, 1: detail
  const [isDetailMenuVisible, setIsDetailMenuVisible] = useState(false);
  
  // Toast Stack State
  const [toasts, setToasts] = useState([]);
  const toastIdCounter = useRef(0);
  const TOAST_SPACING = 42;
  const isAlertActiveRef = useRef(false);

  const showToast = (message) => {
    const id = toastIdCounter.current++;
    setToasts(prev => {
      // Move old toasts UPWARDS when new ones appear at the bottom
      const shifted = prev.map(t => ({ ...t, targetY: t.targetY - TOAST_SPACING }));
      return [...shifted, { id, message, targetY: 0 }];
    });
  };

  const handleToastDone = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Modal swipe-to-dismiss logic
  const modalAddY = useRef(new Animated.Value(height)).current;
  const holidayModalY = useRef(new Animated.Value(height)).current;
  const listModalTranslateY = useRef(new Animated.Value(height)).current;

  const closeHolidayModal = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(holidayModalY, {
      toValue: height,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      setShowHolidaySettings(false);
      setCountrySearch('');
    });
  }, [holidayModalY]);

  const closeAddModal = useCallback((onAfterClose) => {
    Keyboard.dismiss();
    
    if (isMemoEditing) {
      setIsMemoEditing(false);
      return;
    }
    
    setIsAdding(false);
    if (typeof onAfterClose === 'function') {
      onAfterClose();
    }
  }, [isMemoEditing]);

  const closeTaskListModal = useCallback(() => {
    Animated.timing(listModalTranslateY, {
      toValue: height,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      setIsTaskListVisible(false);
      // Reset state so next time it opens at Page 1
      sheetAnim.setValue(0);
      setSelectedTaskDetail(null);
    });
  }, [listModalTranslateY, sheetAnim]);

  const createModalPanResponder = (translateValue, closeCallback) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => gs.dy > 5 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderGrant: () => { Keyboard.dismiss(); },
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) translateValue.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 120 || gs.vy > 0.5) {
          closeCallback();
        } else {
          Animated.spring(translateValue, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 8,
            speed: 18,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateValue, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 8,
          speed: 18,
        }).start();
      },
    });
  };

  const addModalPanResponder = useRef(createModalPanResponder(modalAddY, closeAddModal)).current;
  const holidayModalPanResponder = useRef(createModalPanResponder(holidayModalY, closeHolidayModal)).current;
  const listModalPanResponder = useRef(createModalPanResponder(listModalTranslateY, closeTaskListModal)).current;

  // Modal open animations triggered via useEffect (more reliable than onShow on iOS)
  useEffect(() => {
    if (isAdding) {
      modalAddY.setValue(height);
      Animated.spring(modalAddY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
        speed: 14,
      }).start();
    }
  }, [isAdding]);

  useEffect(() => {
    if (isTaskListVisible) {
      listModalTranslateY.setValue(height);
      Animated.spring(listModalTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
        speed: 14,
      }).start();
    }
  }, [isTaskListVisible]);

  useEffect(() => {
    if (showHolidaySettings) {
      holidayModalY.setValue(height);
      Animated.spring(holidayModalY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
        speed: 14,
      }).start();
    }
  }, [showHolidaySettings]);


  const renderToast = (context) => {
    if (toasts.length === 0) return null;

    // Only render the toast in the highest active layer to avoid duplicate overlaps
    if (isAdding && context !== 'isAdding') return null;
    if (!isAdding && isTaskListVisible && context !== 'isTaskListVisible') return null;
    if (!isAdding && !isTaskListVisible && context !== 'main') return null;

    // Position the toast stack at the bottom, just above the "Add New Task" button
    const toastBottom = insets.bottom + 90;

    return (
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none', zIndex: 9999, justifyContent: 'flex-end' }]}>
        {toasts.map(toast => (
          <ToastItem
            key={toast.id}
            toast={toast}
            bottom={toastBottom}
            onDone={handleToastDone}
            styles={styles}
          />
        ))}
      </View>
    );
  };

  // New Task State
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [taskDate, setTaskDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [endTime, setEndTime] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [newMemo, setNewMemo] = useState('');
  const [selectedColor, setSelectedColor] = useState(TASK_COLOR_LABELS[0].color);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newWeatherRegion, setNewWeatherRegion] = useState(null);

  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [isMemoEditing, setIsMemoEditing] = useState(false);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardDidShow', () => setIsKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => setIsKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [showHolidaySettings, setShowHolidaySettings] = useState(false);
  const [allCountries, setAllCountries] = useState([]);
  const [countrySearch, setCountrySearch] = useState('');

  // Search/Picker State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(null);

  const processedCountries = useMemo(() => {
    return allCountries.map(c => {
      // 한국어면 한국어 이름을 우선, 영어면 영어 이름을 우선 (ename 사용으로 현지어 노출 방지)
      const primary = isKorean ? (c.kname || c.ename) : c.ename;
      const secondary = isKorean ? (c.ename || '') : (c.kname || '');
      return { ...c, displayPrimary: primary, displaySecondary: secondary };
    }).sort((a, b) => {
      // 주요 국가 우선 순위 (한국어면 KR, 그 외엔 US)
      const priorityCode = isKorean ? 'KR' : 'US';
      if (a.code === priorityCode) return -1;
      if (b.code === priorityCode) return 1;
      
      // 일본, 영국, 중국 등도 주요 국가로 앞쪽에 배치 (선택 사항)
      const majorCodes = isKorean ? ['US', 'JP', 'CN', 'GB'] : ['GB', 'CA', 'AU', 'KR'];
      const aIdx = majorCodes.indexOf(a.code);
      const bIdx = majorCodes.indexOf(b.code);
      if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
      if (aIdx !== -1) return -1;
      if (bIdx !== -1) return 1;

      return a.displayPrimary.localeCompare(b.displayPrimary);
    });
  }, [allCountries, isKorean]);

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadPreferences();
      loadHolidays();
    }, [])
  );

  const loadHolidays = async () => {
    const saved = await loadSavedCountries();
    setHolidayCountries(saved);
    setAllCountries(getSupportedCountries());
  };

  useEffect(() => {
    const year = selectedDate.getFullYear();
    if (holidayCountries.length === 0) {
      setHolidaysMap({});
      return;
    }
    
    // Defer the heavy calculation by 50ms so the UI (checkbox) updates instantly
    const timer = setTimeout(() => {
      const h1 = getHolidaysForYear(year - 1, holidayCountries);
      const h2 = getHolidaysForYear(year, holidayCountries);
      const h3 = getHolidaysForYear(year + 1, holidayCountries);
      setHolidaysMap({ ...h1, ...h2, ...h3 });
    }, 50);

    return () => clearTimeout(timer);
  }, [holidayCountries, selectedDate.getFullYear()]);

  const loadPreferences = async () => {
    // Week view removed as per user preference
  };

  const filteredCountries = useMemo(() => {
    if (!countrySearch) return [];
    const search = countrySearch.toLowerCase();
    return processedCountries
      .filter(c => 
        c.ename.toLowerCase().includes(search) || 
        c.code.toLowerCase().includes(search) ||
        (c.kname && c.kname.includes(countrySearch))
      )
      .slice(0, 15);
  }, [countrySearch, processedCountries]);

  const loadData = async () => {
    const data = await getTasks();
    setTasks(data);
    fetchTasksWeather(data);
    setLoading(false);
  };

  const fetchTasksWeather = async (taskList) => {
    const weatherMap = {};
    for (const task of taskList) {
      if (task.weatherRegion?.lat && !task.isCompleted) {
        try {
          const w = await getWeather(task.weatherRegion.lat, task.weatherRegion.lon);
          weatherMap[task.id] = w;
        } catch (e) {
          console.log('Task weather fetch error', e);
        }
      }
    }
    setTaskWeather(prev => ({ ...prev, ...weatherMap }));
  };

  // Calendar Logic
  const monthGridData = useMemo(() => {
    // We only need a few months for performance if we use FlatList properly, 
    // but for simplicity we'll pass the range indices
    return Array.from({ length: CALENDAR_MONTH_RANGE }, (_, i) => i);
  }, []);

  // Sync scroll position when selectedDate changes (e.g. from Picker)
  useEffect(() => {
    if (!isScrollingRef.current) {
      const index = getMonthIndex(selectedDate);
      calendarListRef.current?.scrollToIndex({ index, animated: false });
    }
  }, [selectedDate.getFullYear(), selectedDate.getMonth()]);

  const filteredTasks = useMemo(() => {
    const ds = dateStr(selectedDate);
    return (tasks || []).filter(t => {
      const start = t.date;
      const end = t.endDate || t.date;
      return ds >= start && ds <= end;
    });
  }, [tasks, selectedDate]);

  // Open Picker
  const openPicker = () => {
    setTempYear(selectedDate.getFullYear());
    setTempMonth(selectedDate.getMonth());
    setIsPickerVisible(true);
  };

  const applyPicker = () => {
    const newDate = new Date(tempYear, tempMonth, selectedDate.getDate());
    
    // 점프 거리가 3개월을 초과하면 FlatList를 새로고침하여 중간 렌더링 렉(Freeze) 방지
    const monthDiff = (newDate.getFullYear() - selectedDate.getFullYear()) * 12 + (newDate.getMonth() - selectedDate.getMonth());
    if (Math.abs(monthDiff) > 3) {
      setCalendarListKey(`calendar-list-${Date.now()}`);
    }

    // 해당 월의 마지막 날짜 처리
    if (newDate.getMonth() !== tempMonth) {
      newDate.setDate(0);
    }
    setSelectedDate(newDate);
    setTaskDate(newDate); // 할 일 추가용 날짜도 동기화
    setIsPickerVisible(false);
  };



  const closeAllPickers = () => {
    setShowDatePicker(false);
    setShowTimePicker(false);
    setShowEndDatePicker(false);
    setShowEndTimePicker(false);
  };

  const onDateChange = (event, date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) setTaskDate(date);
  };

  const onEndDateChange = (event, date) => {
    if (Platform.OS === 'android') setShowEndDatePicker(false);
    if (date) setEndDate(date);
  };

  const onTimeChange = (event, date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (date) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      setNewTime(`${hours}:${minutes}`);
    }
  };

  const onEndTimeChange = (event, date) => {
    if (Platform.OS === 'android') setShowEndTimePicker(false);
    if (date) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      setEndTime(`${hours}:${minutes}`);
    }
  };

  const openAddModal = () => {
    console.log('[FAB] openAddModal called');
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (e) {}
    
    setEditingTask(null);
    setNewTitle('');
    setTaskDate(new Date(selectedDate));
    setNewTime('09:00');
    setEndDate(new Date(selectedDate));
    setEndTime('10:00');
    setIsAllDay(false);
    setNewMemo('');
    setNewLocName('');
    setNewWeatherRegion(null);
    setIsAdding(true);
  };

  const handleBackToList = () => {
    Animated.timing(sheetAnim, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setSelectedTaskDetail(null);
      setIsDetailMenuVisible(false);
    });
  };

  const handleEditTask = (task) => {
    setEditingTask(task);
    setNewTitle(task.title);
    setTaskDate(new Date(task.date));
    setNewTime(task.time || '09:00');
    setEndDate(new Date(task.endDate || task.date));
    setEndTime(task.endTime || '10:00');
    setIsAllDay(!!task.isAllDay);
    setNewMemo(task.memo || '');
    setNewLocName(task.locationName || '');
    setNewWeatherRegion(task.weatherRegion || null);
    setIsAdding(true);
  };

  const handleSaveTask = async () => {
    if (!newTitle.trim()) {
      Alert.alert(t('common.tip', 'Tip'), t('tasks.enter_title', 'Please enter a title'));
      return;
    }

    // Validation: Ensure end is after start. If not, auto-adjust end to match start.
    let finalEndDate = endDate;
    let finalEndTime = endTime;

    const startCheck = new Date(taskDate);
    const endCheck = new Date(endDate);
    
    if (!isAllDay) {
      const [sh, sm] = newTime.split(':').map(Number);
      const [eh, em] = endTime.split(':').map(Number);
      startCheck.setHours(sh, sm, 0, 0);
      endCheck.setHours(eh, em, 0, 0);
    } else {
      startCheck.setHours(0, 0, 0, 0);
      endCheck.setHours(0, 0, 0, 0);
    }

    if (endCheck < startCheck) {
      finalEndDate = taskDate;
      finalEndTime = newTime;
    }

    const taskData = {
      title: newTitle,
      date: dateStr(taskDate),
      time: isAllDay ? null : newTime,
      endDate: dateStr(finalEndDate),
      endTime: isAllDay ? null : finalEndTime,
      isAllDay,
      memo: newMemo,
      color: selectedColor,
      locationName: newLocName,
      weatherRegion: newWeatherRegion,
    };

    let updated;
    if (editingTask) {
      updated = await updateTask(editingTask.id, taskData);
      if (selectedTaskDetail && selectedTaskDetail.id === editingTask.id) {
        setSelectedTaskDetail({ ...editingTask, ...taskData });
      }
    } else {
      updated = await addTask(taskData);
    }

    setTasks(updated);
    fetchTasksWeather(updated);

    const afterClose = editingTask ? () => {
      setTimeout(() => {
        setIsTaskListVisible(true);
        sheetAnim.setValue(1);
      }, 50);
    } : undefined;
    closeAddModal(afterClose);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(editingTask ? '일정이 수정되었습니다.' : '새 일정이 등록되었습니다.');
  };

  const formatDisplayDate = (date) => {
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  };

  const handleToggle = async (id) => {
    const updated = await toggleTaskCompletion(id);
    const task = tasks.find(t => t.id === id);
    const newStatus = !task?.isCompleted;
    setTasks(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast(newStatus ? '일정이 완료되었습니다.' : '일정이 미완료 상태로 변경되었습니다.');
  };

  const handleDelete = (id) => {
    Alert.alert(t('common.delete'), t('tasks.delete_confirm', '이 일정을 삭제할까요?'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive', onPress: async () => {
          const updated = await deleteTask(id);
          setTasks(updated);
        }
      }
    ]);
  };

  const handleDayPress = React.useCallback((date, isSelected) => {
    if (isSelected) {
      // Ensure we start from Page 1 (List) when opening
      sheetAnim.setValue(0);
      setSelectedTaskDetail(null);
      setIsTaskListVisible(true);
    } else {
      setSelectedDate(date);
      setTaskDate(date);
    }
  }, [sheetAnim, setSelectedTaskDetail, setIsTaskListVisible, setSelectedDate, setTaskDate]);

  const calendarItemLayout = React.useCallback((data, index) => ({
    length: width - Spacing.lg * 2,
    offset: (width - Spacing.lg * 2) * index,
    index,
  }), []);

  const renderCalendarItem = React.useCallback(({ item: index }) => {
    return (
      <MonthGrid
        index={index}
        tasks={tasks}
        selectedDateStr={dateStr(selectedDate)}
        holidaysMap={holidaysMap}
        onDayPress={handleDayPress}
      />
    );
  }, [tasks, selectedDate, holidaysMap, handleDayPress]);

  const handleSearch = async (val) => {
    setSearchQuery(val);
    if (val.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const domestic = await searchPlaces(val);
      const global = await searchLocations(val);
      setSearchResults([...domestic, ...global]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearching(false);
    }
  };

  const selectSearchResult = (item) => {
    if (searchMode === 'location') setNewLocName(item.name);
    else setNewWeatherRegion({ name: item.name, lat: item.lat, lon: item.lon, address: item.address });
    setSearchMode(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const renderWeatherIcon = (condKey, size = 18) => {
    switch (condKey) {
      case 'rainy': return <CloudRain size={size} color="#64b5f6" />;
      case 'snow': return <CloudSnow size={size} color="#90caf9" />;
      case 'cloudy': return <Cloud size={size} color="#90a4ae" />;
      default: return <Sun size={size} color="#FFB800" />;
    }
  };
  const getTaskTimeDisplay = (task, targetDate) => {
    if (task.isAllDay) return t('tasks.allDay', '종일');
    
    const curStr = dateStr(targetDate);
    const startStr = task.date;
    const endStr = task.endDate || task.date;
    
    const isStart = curStr === startStr;
    const isEnd = curStr === endStr;
    const isMiddle = curStr > startStr && curStr < endStr;
    
    if (isMiddle) return '00:00 - 24:00';
    if (isStart && isEnd) return `${task.time} - ${task.endTime || task.time}`;
    if (isStart) return `${task.time} - 24:00`;
    if (isEnd) return `00:00 - ${task.endTime || task.time}`;
    
    return task.time || t('tasks.allDay', '종일');
  };


  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
    <View style={[styles.container, { paddingTop: Constants.statusBarHeight }]}>
      <MainHeader onMenuPress={() => setMenuVisible(true)} />
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: Spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Content */}
        <View style={{ marginBottom: Spacing.md }}>
          <View style={styles.monthHeaderRow}>
            <TouchableOpacity style={styles.monthSelectBtn} onPress={openPicker}>
              <Text style={styles.monthText}>
                {selectedDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
              </Text>
              <Calendar size={20} color="#1B254B" style={{ marginLeft: 8 }} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.holidayHeaderBtn, { flexShrink: 1, maxWidth: width * 0.4 }]}
              onPress={() => {
                holidayModalY.setValue(height);
                setShowHolidaySettings(true);
              }}
            >
              <MapPin size={14} color={Colors.primary} />
              <Text style={styles.holidayHeaderText} numberOfLines={1} ellipsizeMode="tail">
                Holidays: {(holidayCountries || []).join(', ')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.calendarArea}>
          <View style={styles.weekdayLabels}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <Text key={d} style={styles.weekdayText}>{d}</Text>
            ))}
          </View>

          <FlatList
            key={calendarListKey}
            ref={calendarListRef}
            data={monthGridData}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={item => item.toString()}
            initialScrollIndex={getMonthIndex(selectedDate)}
            getItemLayout={(data, index) => ({
              length: width - Spacing.lg * 2,
              offset: (width - Spacing.lg * 2) * index,
              index,
            })}
            windowSize={3}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews={true}
            onMomentumScrollBegin={() => { isScrollingRef.current = true; }}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / (width - Spacing.lg * 2));
              const newBaseDate = getDateFromIndex(index);
              
              if (newBaseDate.getMonth() !== selectedDate.getMonth() || newBaseDate.getFullYear() !== selectedDate.getFullYear()) {
                const targetDay = Math.min(selectedDate.getDate(), new Date(newBaseDate.getFullYear(), newBaseDate.getMonth() + 1, 0).getDate());
                const finalDate = new Date(newBaseDate.getFullYear(), newBaseDate.getMonth(), targetDay);
                setSelectedDate(finalDate);
                setTaskDate(finalDate);
              }
              isScrollingRef.current = false;
            }}
            renderItem={renderCalendarItem}
          />
        </View>
      </ScrollView>

      {/* Unified Task Sheet (List + Detail Navigation) */}
      <Modal
        visible={isTaskListVisible}
        animationType="none"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={closeTaskListModal}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.modalBg}>
          <Animated.View 
            style={[
              StyleSheet.absoluteFill,
              { 
                backgroundColor: 'black',
                opacity: listModalTranslateY.interpolate({
                  inputRange: [0, height],
                  outputRange: [0.5, 0],
                  extrapolate: 'clamp'
                })
              }
            ]} 
          />
          <Animated.View style={[styles.sheetContent, { 
            height: height * 0.9, 
            overflow: 'hidden',
            transform: [{ translateY: listModalTranslateY }]
          }]}>
            <Animated.View style={{ 
              flex: 1, 
              flexDirection: 'row', 
              width: width * 2,
              transform: [{
                translateX: sheetAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -width]
                })
              }]
            }}>
              {/* PAGE 1: Task List */}
              <View style={{ width: width }}>
                <View style={styles.modalHeader} {...listModalPanResponder.panHandlers}>
                  <View style={styles.modalHandle} />
                  <View style={styles.sheetTitleArea}>
                    <Text style={styles.sheetDateTitle}>{selectedDate.getFullYear()}년 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 {['일', '월', '화', '수', '목', '금', '토'][selectedDate.getDay()]}요일</Text>
                    <Text style={styles.sheetSubtitle}>Scheduled Tasks</Text>
                  </View>
                </View>

                <ScrollView 
                  style={styles.sheetList} 
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 100 }}
                >
                  {(filteredTasks || []).length === 0 && !isPublicHoliday(dateStr(selectedDate), holidaysMap) ? (
                    <View style={styles.emptyState}>
                      <CalendarDays size={48} color={Colors.outlineVariant} strokeWidth={1} style={{ marginBottom: Spacing.md }} />
                      <Text style={styles.emptyText}>{t('tasks.empty', 'No tasks scheduled.')}</Text>
                    </View>
                  ) : (
                    <View style={styles.taskList}>
                      {/* Public Holidays Section */}
                      {holidaysMap[dateStr(selectedDate)] && holidaysMap[dateStr(selectedDate)].length > 0 && (
                        <View style={styles.holidaySection}>
                          {holidaysMap[dateStr(selectedDate)].map((h, idx) => (
                            <View key={idx} style={styles.holidayBadge}>
                              <Text style={styles.holidayNameText}>[{h.country}] {h.name}</Text>
                              <Text style={styles.holidayTypeText}>{h.type === 'public' ? t('tasks.public_holiday', 'Public Holiday') : t('tasks.observance', 'Observance')}</Text>
                            </View>
                          ))}
                        </View>
                      )}

                      {(filteredTasks || []).map((task) => {
                        const taskCol = task.color || TASK_COLORS[tasks.findIndex(gt => gt.id === task.id) % TASK_COLORS.length];
                        const timeDisplay = getTaskTimeDisplay(task, selectedDate);
                        
                        return (
                          <TouchableOpacity 
                            key={task.id} 
                            style={[styles.timeTreeListItem, task.isCompleted && { opacity: 0.5 }]}
                            onPress={() => { 
                              setSelectedTaskDetail(task);
                              Animated.timing(sheetAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
                            }}
                          >
                            <View style={styles.listItemTimeArea}>
                              <Text style={styles.listItemTimeText}>{timeDisplay}</Text>
                            </View>
                            
                            <View style={[styles.listItemColorBar, { backgroundColor: taskCol }]} />
                            
                            <View style={styles.listItemContent}>
                              <Text style={[styles.listItemTitle, task.isCompleted && styles.taskTitleCompleted]} numberOfLines={1}>
                                {task.title}
                              </Text>
                            </View>

                            <TouchableOpacity onPress={() => handleToggle(task.id)} style={styles.listItemCheck} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                              {task.isCompleted ? 
                                <CheckCircle2 size={20} color={taskCol} /> : 
                                <Circle size={20} color={Colors.outlineVariant} />
                              }
                            </TouchableOpacity>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )}
                </ScrollView>

                <TouchableOpacity 
                  style={[styles.sheetAddBtn, { position: 'absolute', bottom: 16, left: 0, right: 0 }]} 
                  onPress={() => { setIsTaskListVisible(false); openAddModal(); }}
                >
                  <Plus size={20} color="white" strokeWidth={3} />
                  <Text style={styles.sheetAddBtnText}>{t('tasks.addNew', 'Add New Task')}</Text>
                </TouchableOpacity>
              </View>

              {/* PAGE 2: Task Detail */}
              <View style={{ width: width }}>
                <View style={styles.modalHeader} {...listModalPanResponder.panHandlers}>
                  <View style={styles.modalHandle} />
                  <View style={{ flexDirection: 'row', width: '100%', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
                    <TouchableOpacity onPress={handleBackToList} style={styles.detailHeaderBtn}>
                      <ChevronLeft size={28} color={Colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setIsDetailMenuVisible(true)} style={styles.detailHeaderBtn}>
                      <MoreHorizontal size={24} color={Colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>

                {selectedTaskDetail && (
                  <ScrollView 
                    style={{ flex: 1 }} 
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 60 }}
                  >
                    <View style={styles.detailBody}>
                      <View style={styles.detailTitleSection}>
                        <View style={[styles.detailColorBar, { backgroundColor: selectedTaskDetail.color || Colors.primary }]} />
                        <Text style={[styles.detailTitle, { color: selectedTaskDetail.color || Colors.text }, selectedTaskDetail.isCompleted && styles.taskTitleCompleted]}>{selectedTaskDetail.title}</Text>
                      </View>

                      <View style={[styles.detailDateSection, { justifyContent: 'center', gap: 15 }]}>
                        <View style={{ alignItems: 'center' }}>
                          <Text style={styles.detailDateYear}>{selectedTaskDetail.date.split('-')[0]}년</Text>
                          <Text style={styles.detailDateMain}>{parseInt(selectedTaskDetail.date.split('-')[1])}월 {parseInt(selectedTaskDetail.date.split('-')[2])}일 ({['일','월','화','수','목','금','토'][new Date(selectedTaskDetail.date).getDay()]})</Text>
                          {!selectedTaskDetail.isAllDay && <Text style={styles.detailDateTime}>{selectedTaskDetail.time || '00:00'}</Text>}
                        </View>
                        <ArrowRight size={24} color={Colors.primary} />
                        <View style={{ alignItems: 'center' }}>
                          <Text style={styles.detailDateYear}>{(selectedTaskDetail.endDate || selectedTaskDetail.date).split('-')[0]}년</Text>
                          <Text style={styles.detailDateMain}>{parseInt((selectedTaskDetail.endDate || selectedTaskDetail.date).split('-')[1])}월 {parseInt((selectedTaskDetail.endDate || selectedTaskDetail.date).split('-')[2])}일 ({['일','월','화','수','목','금','토'][new Date(selectedTaskDetail.endDate || selectedTaskDetail.date).getDay()]})</Text>
                          {!selectedTaskDetail.isAllDay && <Text style={styles.detailDateTime}>{selectedTaskDetail.endTime || selectedTaskDetail.time || '00:00'}</Text>}
                        </View>
                      </View>

                      <View style={styles.detailInfoList}>
                        {selectedTaskDetail.isAllDay && (
                          <View style={styles.detailInfoItem}>
                            <Clock size={20} color={Colors.outline} />
                            <Text style={styles.detailInfoText}>{t('tasks.allDay', '종일')}</Text>
                          </View>
                        )}
                        {(selectedTaskDetail.locationName || selectedTaskDetail.weatherRegion) && (
                          <View style={styles.detailInfoItem}>
                            <MapPin size={20} color={Colors.outline} />
                            <Text style={styles.detailInfoText}>
                              {selectedTaskDetail.locationName || selectedTaskDetail.weatherRegion?.name}
                            </Text>
                          </View>
                        )}
                        <View style={styles.detailInfoItem}>
                          <Tag size={20} color={Colors.outline} />
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: selectedTaskDetail.color || Colors.primary }} />
                            <Text style={styles.detailInfoText}>
                              {TASK_COLOR_LABELS.find(l => l.color === (selectedTaskDetail.color || Colors.primary))?.name || '기본 색상'}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.detailInfoItem}>
                          <AlignLeft size={20} color={Colors.outline} />
                          <Text style={styles.detailInfoText}>{selectedTaskDetail.memo || 'No memo'}</Text>
                        </View>
                      </View>
                    </View>
                  </ScrollView>
                )}

                {isDetailMenuVisible && (
                  <>
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setIsDetailMenuVisible(false)} />
                    <View style={styles.floatingMenu}>
                      <TouchableOpacity style={styles.menuItem} onPress={async () => {
                        setIsDetailMenuVisible(false);
                        const updated = await toggleTaskCompletion(selectedTaskDetail.id);
                        setTasks(updated);
                        const newStatus = !selectedTaskDetail.isCompleted;
                        setSelectedTaskDetail(prev => ({ ...prev, isCompleted: newStatus }));
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        showToast(newStatus ? '일정이 완료되었습니다.' : '일정이 미완료 상태로 변경되었습니다.');
                      }}>
                        <CheckCircle2 size={18} color={selectedTaskDetail.isCompleted ? Colors.primary : Colors.text} />
                        <Text style={[styles.menuText, selectedTaskDetail.isCompleted && { color: Colors.primary }]}>
                          {selectedTaskDetail.isCompleted ? '미완료로 표시' : '완료로 표시'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.menuItem} onPress={async () => {
                        setIsDetailMenuVisible(false);
                        const shareText = `[Todo] ${selectedTaskDetail.title}\nPeriod: ${selectedTaskDetail.date} ~ ${selectedTaskDetail.endDate || selectedTaskDetail.date}\nNotes: ${selectedTaskDetail.memo || ''}`;
                        await Clipboard.setStringAsync(shareText);
                        showToast('일정 내용이 복사되었습니다.');
                      }}>
                        <Share2 size={18} color={Colors.text} /><Text style={styles.menuText}>공유</Text>
                      </TouchableOpacity>

                      <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 4 }} />

                      <TouchableOpacity style={styles.menuItem} onPress={() => { setIsDetailMenuVisible(false); setIsTaskListVisible(false); handleEditTask(selectedTaskDetail); }}>
                        <Pencil size={18} color={Colors.text} /><Text style={styles.menuText}>편집</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.menuItem} onPress={() => {
                        setIsDetailMenuVisible(false);
                        const taskId = selectedTaskDetail.id;
                        isAlertActiveRef.current = true;
                        Alert.alert('삭제', '이 일정을 삭제할까요?', [
                          { text: '취소', style: 'cancel', onPress: () => { isAlertActiveRef.current = false; } },
                          { text: '삭제', style: 'destructive', onPress: async () => {
                            isAlertActiveRef.current = false;
                            handleBackToList();
                            const updated = await deleteTask(taskId);
                            setTasks(updated);
                            showToast('일정이 삭제되었습니다.');
                          } }
                        ], { cancelable: false });
                      }}>
                        <Trash2 size={18} color={Colors.error} /><Text style={[styles.menuText, { color: Colors.error }]}>삭제</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </Animated.View>
          </Animated.View>
          {renderToast('isTaskListVisible')}
        </View>
        </GestureHandlerRootView>
      </Modal>

      {renderToast('main')}
    

      {/* Picker and Adding modals will be rendered here as siblings */}

      {/* Wheel Picker Modal */}
      <Modal visible={isPickerVisible} transparent animationType="fade" onRequestClose={() => setIsPickerVisible(false)}>
        <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.pickerBg}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Date</Text>
              <TouchableOpacity onPress={() => setIsPickerVisible(false)}><X size={24} color={Colors.text} /></TouchableOpacity>
            </View>

            <View style={styles.wheelWrapper}>
              {/* Visual Highlight Overlay */}
              <View style={styles.wheelOverlay} pointerEvents="none" />

              <View style={styles.wheelRow}>
                {/* Year Wheel */}
                <View style={styles.wheelCol}>
                  <FlatList
                    ref={yearListRef}
                    data={YEARS}
                    keyExtractor={item => item.toString()}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={ITEM_HEIGHT}
                    initialScrollIndex={tempYear - 1900}
                    getItemLayout={(data, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                    contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
                    onScroll={(e) => {
                      const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                      if (index !== lastTickYearIndex.current) {
                        lastTickYearIndex.current = index;
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                    scrollEventThrottle={16}
                    onMomentumScrollEnd={(e) => {
                      const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                      setTempYear(1900 + index);
                    }}
                    renderItem={({ item: year }) => (
                      <View style={styles.wheelItem}>
                        <Text style={[styles.wheelItemText, tempYear === year && styles.activeWheelText]}>{year}년</Text>
                      </View>
                    )}
                  />
                </View>

                {/* Month Wheel */}
                <View style={styles.wheelCol}>
                  <FlatList
                    ref={monthListRef}
                    data={MONTHS}
                    keyExtractor={item => item.toString()}
                    showsVerticalScrollIndicator={false}
                    snapToInterval={ITEM_HEIGHT}
                    initialScrollIndex={tempMonth}
                    getItemLayout={(data, index) => ({ length: ITEM_HEIGHT, offset: ITEM_HEIGHT * index, index })}
                    contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
                    onScroll={(e) => {
                      const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                      if (index !== lastTickMonthIndex.current) {
                        lastTickMonthIndex.current = index;
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                    scrollEventThrottle={16}
                    onMomentumScrollEnd={(e) => {
                      const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
                      setTempMonth(index);
                    }}
                    renderItem={({ item: month }) => (
                      <View style={styles.wheelItem}>
                        <Text style={[styles.wheelItemText, tempMonth === (month - 1) && styles.activeWheelText]}>{month}월</Text>
                      </View>
                    )}
                  />
                </View>
              </View>
            </View>

            <View style={styles.pickerFooter}>
              <TouchableOpacity style={styles.todayBtn} onPress={() => {
                const today = new Date();
                const y = today.getFullYear();
                const m = today.getMonth();
                setTempYear(y);
                setTempMonth(m);
                yearListRef.current?.scrollToIndex({ index: y - 1900, animated: true });
                monthListRef.current?.scrollToIndex({ index: m, animated: true });
              }}>
                <Text style={styles.todayBtnText}>Go to Today</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={applyPicker}>
                <Text style={styles.confirmBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </GestureHandlerRootView>
      </Modal>

      <Modal
        visible={isAdding}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeAddModal}
        onShow={() => {
          modalScrollRef.current?.scrollTo({ y: 0, animated: false });
          setTimeout(() => titleInputRef.current?.focus(), 300);
        }}
      >
        <View style={[styles.modalBg, { flex: 1 }]}>
          <View style={styles.modalContent}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1 }}
              keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
            >
              {isMemoEditing ? (
                /* Full Screen Memo Editor */
                <View style={{ flex: 1 }}>
                  <View style={styles.modalHeader}>
                    <View style={styles.modalHandle} />
                    <View style={{ flexDirection: 'row', width: '100%', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 }}>
                      <TouchableOpacity onPress={() => setIsMemoEditing(false)} style={styles.headerActionBtn}>
                        <ChevronLeft size={28} color={Colors.text} />
                      </TouchableOpacity>
                      <View style={{ alignItems: 'center' }}>
                        <Text style={styles.modalTitle}>Memo</Text>
                        <Text style={{ fontSize: 11, color: Colors.outline, fontWeight: '600' }}>
                          {newMemo.length} / 1000
                        </Text>
                      </View>
                      <TouchableOpacity onPress={() => setIsMemoEditing(false)} style={styles.headerSaveBtn}>
                        <Text style={styles.headerSaveText}>{t('common.done', 'Done')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={{ flex: 1, paddingBottom: Platform.OS === 'ios' ? 20 : 0 }}>
                    <TextInput
                      style={[styles.fullMemoInput, { flex: 1 }]}
                      placeholder={t('tasks.memo_placeholder', 'Add notes...')}
                      value={newMemo}
                      onChangeText={setNewMemo}
                      multiline
                      autoFocus
                      maxLength={1000}
                      placeholderTextColor={Colors.outline}
                      textAlignVertical="top"
                    />
                  </View>
                </View>
              ) : (
                /* Main Form */
                <>
                  <View style={styles.modalHeader} {...addModalPanResponder.panHandlers}>
                    <View style={styles.modalHandle} />
                    <View style={{ flexDirection: 'row', width: '100%', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 }}>
                      <TouchableOpacity onPress={() => closeAddModal()} style={styles.headerActionBtn}>
                        <ChevronLeft size={28} color={Colors.text} />
                      </TouchableOpacity>
                      
                      <Text style={styles.modalTitle}>{editingTask ? t('tasks.edit_task', 'Edit Task') : t('tasks.add_new', 'Add Task')}</Text>
                      
                      {isKeyboardVisible ? (
                        <TouchableOpacity onPress={() => Keyboard.dismiss()} style={styles.headerActionBtn}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <KeyboardIcon size={22} color={Colors.primary} />
                            <ChevronDown size={14} color={Colors.primary} />
                          </View>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity 
                          onPress={handleSaveTask} 
                          disabled={!newTitle.trim()} 
                          style={[styles.headerSaveBtn, !newTitle.trim() && { opacity: 0.5 }]}
                        >
                          <Text style={styles.headerSaveText}>{t('common.save', 'Save')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                  <ScrollView
                    ref={modalScrollRef}
                    style={styles.modalForm}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 250 }}
                    automaticallyAdjustKeyboardInsets={true}
                  >
                    <TextInput
                      ref={titleInputRef}
                      style={styles.timeTreeTitle}
                      placeholder={t('tasks.placeholder', 'Title')}
                      value={newTitle}
                      onChangeText={setNewTitle}
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                    />

                    {/* Color Selection Row */}
                    <TouchableOpacity style={styles.timeTreeRow} onPress={() => { Keyboard.dismiss(); setShowColorPicker(true); }}>
                      <View style={styles.rowLead}>
                        <View style={[styles.colorIndicator, { backgroundColor: selectedColor, marginRight: 12 }]} />
                        <Text style={styles.timeTreeRowText}>
                          {TASK_COLOR_LABELS.find(l => l.color === selectedColor)?.name || '라벨 선택'}
                        </Text>
                      </View>
                      <ChevronRight size={20} color={Colors.outline} />
                    </TouchableOpacity>

                    <View style={styles.timeTreeDivider} />

                    {/* All-day Toggle */}
                    <View style={styles.timeTreeRow}>
                      <View style={styles.rowLead}>
                        <Compass size={22} color={isAllDay ? Colors.primary : Colors.textSecondary} />
                        <Text style={styles.timeTreeRowText}>{t('tasks.all_day', 'All Day')}</Text>
                      </View>
                      <Switch
                        value={isAllDay}
                        onValueChange={setIsAllDay}
                        trackColor={{ false: '#E2E8F0', true: Colors.primary + '80' }}
                        thumbColor={isAllDay ? Colors.primary : '#F4F7FE'}
                      />
                    </View>

                    <View style={styles.timeTreeDivider} />

                    {/* Start Date/Time */}
                    <View style={styles.timeTreeRow}>
                      <View style={styles.rowLead}>
                        <Calendar size={20} color={Colors.textSecondary} />
                        <Text style={styles.timeTreeLabel}>{t('tasks.start', 'Start')}</Text>
                      </View>
                      <View style={styles.rowTail}>
                        <TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowDatePicker(true); }}>
                          <Text style={styles.timeTreePickerText}>{formatDisplayDate(taskDate)}</Text>
                        </TouchableOpacity>
                        {!isAllDay && (
                          <TouchableOpacity style={styles.timeLabelSmall} onPress={() => { Keyboard.dismiss(); setShowTimePicker(true); }}>
                            <Text style={styles.timeTreeTimeText}>{newTime}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* End Date/Time */}
                    <View style={styles.timeTreeRow}>
                      <View style={styles.rowLead}>
                        <View style={{ width: 22 }} />
                        <Text style={styles.timeTreeLabel}>{t('tasks.end', 'End')}</Text>
                      </View>
                      <View style={styles.rowTail}>
                        <TouchableOpacity onPress={() => { Keyboard.dismiss(); setShowEndDatePicker(true); }}>
                          <Text style={styles.timeTreePickerText}>{formatDisplayDate(endDate)}</Text>
                        </TouchableOpacity>
                        {!isAllDay && (
                          <TouchableOpacity style={styles.timeLabelSmall} onPress={() => { Keyboard.dismiss(); setShowEndTimePicker(true); }}>
                            <Text style={styles.timeTreeTimeText}>{endTime}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    <View style={styles.timeTreeDivider} />

                    {/* Location & Weather */}
                    <View style={styles.timeTreeRow}>
                      <View style={styles.rowLead}>
                        <MapPin size={22} color={Colors.textSecondary} />
                        <TextInput
                          style={styles.timeTreeInput}
                          placeholder={t('tasks.loc_placeholder', 'Location')}
                          value={newLocName}
                          onChangeText={setNewLocName}
                        />
                      </View>
                    </View>



                    <View style={styles.timeTreeDivider} />

                    {/* Memo Section */}
                    <TouchableOpacity style={styles.memoSection} onPress={() => { Keyboard.dismiss(); setIsMemoEditing(true); }}>
                      <View style={styles.memoHeader}>
                        <AlignLeft size={18} color={Colors.textSecondary} />
                        <Text style={styles.memoLabel}>{t('tasks.memo', 'Memo')}</Text>
                      </View>
                      <View style={styles.memoPreviewBox}>
                        <Text 
                          style={[styles.memoPreviewText, !newMemo && { color: Colors.outline }]} 
                          numberOfLines={10}
                          ellipsizeMode="tail"
                        >
                          {newMemo ? (
                            newMemo.split('\n').length > 10 
                              ? newMemo.split('\n').slice(0, 10).join('\n') + '...'
                              : newMemo
                          ) : t('tasks.memo_placeholder', 'Add notes...')}
                        </Text>
                      </View>
                    </TouchableOpacity>

                  </ScrollView>
                </>
              )}
            </KeyboardAvoidingView>
          </View>

          {/* Color Picker Overlay */}
          {showColorPicker && (
            <View style={styles.innerSearchOverlay}>
              <View style={styles.searchHeader}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.text }}>{t('tasks.select_color', 'Select Label')}</Text>
                <TouchableOpacity onPress={() => setShowColorPicker(false)}><X size={24} color={Colors.text} /></TouchableOpacity>
              </View>
              <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                {TASK_COLOR_LABELS.map((item, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.labelItem}
                    onPress={() => { setSelectedColor(item.color); setShowColorPicker(false); }}
                  >
                    <View style={[styles.labelMark, { backgroundColor: item.color }]} />
                    <Text style={[styles.labelName, selectedColor === item.color && { color: Colors.primary, fontWeight: '800' }]}>
                      {item.name}
                    </Text>
                    {selectedColor === item.color && <CheckCircle2 size={20} color={Colors.primary} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {searchMode && (
            <View style={styles.innerSearchOverlay}>
              <View style={styles.searchHeader}>
                <Search size={20} color={Colors.outline} />
                <TextInput style={styles.innerSearchPath} placeholder={t('search.placeholder')} autoFocus value={searchQuery} onChangeText={handleSearch} />
                <TouchableOpacity onPress={() => setSearchMode(null)}><X size={24} color={Colors.text} /></TouchableOpacity>
              </View>
              <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                {isSearching ? <ActivityIndicator style={{ marginTop: 20 }} /> : null}
                {searchResults.map((item, idx) => (
                  <TouchableOpacity key={idx} style={styles.searchItem} onPress={() => selectSearchResult(item)}>
                    <MapPin size={18} color={item.type === 'domestic' ? Colors.primary : Colors.outline} />
                    <View style={{ marginLeft: 12 }}>
                      <Text style={styles.searchItemName}>{item.name}</Text>
                      <Text style={styles.searchItemAddr}>{item.address}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Date / Time Pickers */}
          {Platform.OS === 'android' && (
            <>
              {showDatePicker && (
                <View style={styles.inlinePickerContainer}>
                  <DateTimePicker value={taskDate} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'calendar'} onChange={onDateChange} />
                </View>
              )}
              {showTimePicker && (
                <View style={styles.customWheelContainer}>
                  <View style={styles.wheelHeader}><Text style={styles.wheelHeaderTitle}>Select Start Time</Text></View>
                  <DateTimePicker
                    value={(() => {
                      const d = new Date(taskDate);
                      const [h, m] = newTime.split(':').map(Number);
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
              {showEndDatePicker && (
                <View style={styles.inlinePickerContainer}>
                  <DateTimePicker value={endDate} mode="date" display={Platform.OS === 'ios' ? 'inline' : 'calendar'} onChange={onEndDateChange} />
                </View>
              )}
              {showEndTimePicker && (
                <View style={styles.customWheelContainer}>
                  <View style={styles.wheelHeader}><Text style={styles.wheelHeaderTitle}>Select End Time</Text></View>
                  <DateTimePicker
                    value={(() => {
                      const d = new Date(endDate);
                      const [h, m] = endTime.split(':').map(Number);
                      d.setHours(h, m);
                      return d;
                    })()}
                    mode="time"
                    is24Hour={true}
                    display="spinner"
                    onChange={onEndTimeChange}
                  />
                </View>
              )}
            </>
          )}

          {Platform.OS === 'ios' && (showDatePicker || showTimePicker || showEndDatePicker || showEndTimePicker) && (
            <View style={styles.iosPickerOverlay}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={closeAllPickers}
              />
              <View style={styles.iosPickerCard}>
                <View style={styles.iosPickerHeader}>
                  <Text style={styles.iosPickerTitle}>
                    {(showDatePicker || showEndDatePicker) ? t('tasks.date', 'Date') : t('tasks.time', 'Time')}
                  </Text>
                  <TouchableOpacity onPress={closeAllPickers}>
                    <Text style={[styles.iosPickerDone, { color: Colors.primary }]}>{t('common.done', 'Done')}</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ height: 216, justifyContent: 'center', backgroundColor: 'white' }}>
                  <DateTimePicker
                    value={(() => {
                      try {
                        if (showDatePicker) return taskDate instanceof Date ? taskDate : new Date(taskDate);
                        if (showEndDatePicker) return endDate instanceof Date ? endDate : new Date(endDate);
                        if (showTimePicker) {
                          const [h, m] = newTime.split(':').map(Number);
                          const d = new Date(taskDate); d.setHours(h); d.setMinutes(m); return d;
                        }
                        if (showEndTimePicker) {
                          const [h, m] = endTime.split(':').map(Number);
                          const d = new Date(endDate); d.setHours(h); d.setMinutes(m); return d;
                        }
                      } catch (e) {
                        return new Date();
                      }
                      return new Date();
                    })()}
                    mode={(showDatePicker || showEndDatePicker) ? 'date' : 'time'}
                    display="spinner"
                    is24Hour={true}
                    textColor="black"
                    onChange={(event, date) => {
                      if (showDatePicker) onDateChange(event, date);
                      else if (showEndDatePicker) onEndDateChange(event, date);
                      else if (showTimePicker) onTimeChange(event, date);
                      else if (showEndTimePicker) onEndTimeChange(event, date);
                    }}
                    style={{ height: 216, width: width }}
                  />
                </View>
              </View>
            </View>
          )}
          {renderToast('isAdding')}
        </View>
      </Modal>

      <Modal
        visible={showHolidaySettings}
        animationType="none"
        transparent={true}
        statusBarTranslucent={true}
        onRequestClose={closeHolidayModal}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.modalBg}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { 
                backgroundColor: 'black',
                opacity: holidayModalY.interpolate({
                  inputRange: [0, height],
                  outputRange: [0.5, 0],
                  extrapolate: 'clamp'
                })
              }
            ]} 
          />
          <Animated.View style={[styles.modalContent, { transform: [{ translateY: holidayModalY }] }]}>
            <View style={styles.modalHeader} {...holidayModalPanResponder.panHandlers}>
              <View style={styles.modalHandle} />
              <View style={{ flexDirection: 'row', width: '100%', alignItems: 'center', justifyContent: 'center', paddingTop: 8, paddingBottom: 4 }}>
                <View style={{ flex: 1 }} />
                <View style={{ flex: 3, alignItems: 'center' }}>
                  <Text style={styles.modalTitle}>{t('tasks.holiday_settings', 'Holiday Settings')}</Text>
                  <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 2 }}>{t('tasks.holiday_guide', 'Select countries to show public holidays')}</Text>
                </View>
                <View style={{ flex: 1.5, alignItems: 'flex-end' }}>
                  {isKeyboardVisible ? (
                    <TouchableOpacity onPress={() => Keyboard.dismiss()} style={styles.headerActionBtn}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <KeyboardIcon size={22} color={Colors.primary} />
                        <ChevronDown size={14} color={Colors.primary} />
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity 
                      onPress={closeHolidayModal} 
                      style={styles.headerSaveBtn}
                    >
                      <Text style={styles.headerSaveText} numberOfLines={1}>{t('common.save', 'Save')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>

            <View style={[styles.searchBox, { marginTop: 16, marginHorizontal: 0 }]}>
              <Search size={18} color={Colors.outline} style={{ marginRight: 8 }} />
              <TextInput 
                style={styles.searchField} 
                placeholder={t('tasks.search_country_placeholder', 'Search country (e.g. Korea)')} 
                value={countrySearch}
                onChangeText={setCountrySearch}
              />
              {countrySearch.length > 0 && (
                <TouchableOpacity onPress={() => setCountrySearch('')}>
                  <X size={16} color={Colors.outline} />
                </TouchableOpacity>
              )}
            </View>

            <View style={{ flex: 1, marginTop: 12 }}>
              {countrySearch.length > 0 ? (
                <FlatList
                  data={filteredCountries}
                  keyExtractor={item => item.code}
                  style={{ flex: 1 }}
                  keyboardShouldPersistTaps="handled"
                  initialNumToRender={10}
                  maxToRenderPerBatch={10}
                  windowSize={5}
                  getItemLayout={(data, index) => ({ length: 65, offset: 65 * index, index })}
                  ListHeaderComponent={<Text style={styles.sectionSmallTitle}>Search Results</Text>}
                  renderItem={({ item }) => (
                    <CountryItem 
                      item={item} 
                      isSelected={holidayCountries.includes(item.code)} 
                      onPress={(code) => {
                        if (!holidayCountries.includes(code)) {
                          const next = [...holidayCountries, code];
                          setHolidayCountries(next);
                          saveCountries(next);
                        }
                        setCountrySearch('');
                      }} 
                    />
                  )}
                />
              ) : (
                <FlatList
                  data={holidayCountries}
                  keyExtractor={item => item}
                  style={{ flex: 1 }}
                  showsVerticalScrollIndicator={false}
                  initialNumToRender={15}
                  getItemLayout={(data, index) => ({ length: 75, offset: 75 * index, index })}
                  ListHeaderComponent={<Text style={styles.sectionSmallTitle}>Selected Countries</Text>}
                  renderItem={({ item: code }) => (
                    <SelectedCountryItem 
                      code={code} 
                      country={processedCountries.find(c => c.code === code)}
                      onRemove={(cCode) => {
                        const next = holidayCountries.filter(c => c !== cCode);
                        setHolidayCountries(next);
                        saveCountries(next);
                      }}
                    />
                  )}
                />
              )}
            </View>
          </Animated.View>
        </View>
        </GestureHandlerRootView>
      </Modal>

      <MenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)} 
        onReset={() => loadData()} 
      />

    </View>
    <Pressable
      style={{
        position: 'absolute',
        bottom: Math.max(insets.bottom, 20) + 10 + 64 + 16 - 2.5, // Center the 60px circle in 65px area
        right: 30 - 2.5, // Center the 60px circle in 65px area
        width: 65,
        height: 65,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999999,
      }}
      onPress={() => {
        console.log('[FAB] Press detected');
        openAddModal();
      }}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <View style={styles.fabCircle}>
        <Plus size={32} color="white" strokeWidth={3} />
      </View>
    </Pressable>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: 'white', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingBottom: Spacing.xl, elevation: 4, zIndex: 10 },
  monthHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  monthSelectBtn: { flexDirection: 'row', alignItems: 'center' },
  monthText: { fontSize: 24, fontWeight: '800', color: '#1B254B' },
  viewToggleBtn: { padding: 8, backgroundColor: '#F4F7FE', borderRadius: 12 },
  viewToggleText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  calendarArea: { paddingHorizontal: 0 },
  weekdayLabels: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 10, paddingHorizontal: 0 },
  weekdayText: { width: Math.floor((width - Spacing.lg * 2) / 7), textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.outlineVariant, textTransform: 'uppercase' },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' },
  dayCell: { width: Math.floor((width - Spacing.lg * 2 - 20) / 7), height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  dayCellMonth: { width: Math.floor((width - Spacing.lg * 2) / 7), height: 95, borderRadius: 8, marginBottom: 4 },
  dayCellTop: { paddingVertical: 4, alignItems: 'center', height: 32, zIndex: 10 },
  dayNumContainer: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  todayCircle: { backgroundColor: Colors.text },
  todayText: { color: 'white' },
  dayNum: { fontSize: 13, fontWeight: '700', color: Colors.text },

  calendarSlotContainer: { flex: 1, paddingHorizontal: 1, gap: 1 },
  emptySlotRow: { height: 14 },
  calendarTaskBar: { height: 14, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  barStart: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4, marginLeft: 2 },
  barEnd: { borderTopRightRadius: 4, borderBottomRightRadius: 4, marginRight: 2 },
  barMiddle: { marginHorizontal: 0 },
  calendarBarText: { fontSize: 10, fontWeight: '700', color: 'white', lineHeight: 14, includeFontPadding: false, textAlignVertical: 'center' },
  moreTasksRow: { height: 13, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  moreTasksText: { fontSize: 9, fontWeight: '800', color: Colors.textSecondary },

  scrollContent: { padding: Spacing.lg, paddingBottom: 180 },
  sectionHeader: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  sectionSubtitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginTop: 2 },
  taskList: { gap: 0 },
  timeTreeListItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 12, 
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC'
  },
  listItemTimeArea: { width: 85, alignItems: 'flex-end', paddingRight: 12 },
  listItemTimeText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, textAlign: 'right' },
  listItemColorBar: { width: 3, height: 18, borderRadius: 1.5 },
  listItemContent: { flex: 1, paddingLeft: 12 },
  listItemTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  listItemCheck: { paddingHorizontal: 12 },
  taskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingLeft: 12, paddingRight: 8, borderRadius: 20, elevation: 1, shadowColor: Colors.shadow, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  taskDetailClickArea: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  completedTask: { opacity: 0.5 },
  checkArea: { paddingVertical: 10, paddingRight: 4 },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 2 },
  taskTitleCompleted: { textDecorationLine: 'line-through', color: Colors.textSecondary },
  taskMeta: { flexDirection: 'row', alignItems: 'center' },
  metaText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  metaDivider: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: Colors.outlineVariant, marginHorizontal: 8 },
  weatherBadge: { backgroundColor: '#F4F7FE', borderRadius: 14, paddingVertical: 6, paddingHorizontal: 10, alignItems: 'center', minWidth: 45, marginRight: 8 },
  weatherTemp: { fontSize: 11, fontWeight: '800', color: Colors.text, marginTop: 1 },
  trashBtn: { padding: 6 },

  colorIndicator: { width: 14, height: 14, borderRadius: 4, marginRight: 0 },
  labelItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  labelMark: { width: 6, height: 20, borderRadius: 3, marginRight: 16 },
  labelName: { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.textSecondary },

  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  fabCircle: { 
    width: 60, 
    height: 60, 
    borderRadius: 30, 
    backgroundColor: '#111827', 
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },

  pickerBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  pickerContent: { width: width * 0.9, backgroundColor: 'white', borderRadius: 32, padding: Spacing.xl },
  pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  pickerTitle: { fontSize: 22, fontWeight: '800', color: '#1B254B' },
  wheelWrapper: { height: ITEM_HEIGHT * 5, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F4F7FE', borderRadius: 24, overflow: 'hidden' },
  wheelOverlay: { position: 'absolute', top: ITEM_HEIGHT * 2, left: 0, right: 0, backgroundColor: 'rgba(27, 37, 75, 0.08)', height: ITEM_HEIGHT, borderRadius: 16 },
  wheelRow: { flexDirection: 'row', width: '100%' },
  wheelCol: { flex: 1 },
  wheelItem: { height: ITEM_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  wheelItemText: { fontSize: 18, color: Colors.outline, fontWeight: '600', lineHeight: ITEM_HEIGHT, includeFontPadding: false, textAlignVertical: 'center', textAlign: 'center' },
  activeWheelText: { color: '#1B254B', fontWeight: '800' },
  pickerFooter: { flexDirection: 'row', marginTop: 32, gap: 12 },
  modalHeader: { 
    alignItems: 'center', 
    paddingTop: 8, 
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  modalHandle: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, marginBottom: 8 },
  headerActionBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSaveBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSaveText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '800',
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: Colors.text },
  todayBtn: { flex: 1, height: 52, borderRadius: 16, borderColor: '#1B254B', borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  todayBtnText: { fontSize: 15, fontWeight: '700', color: '#1B254B' },
  confirmBtn: { flex: 1.5, height: 52, borderRadius: 16, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: 'white' },

  modalBg: { flex: 1, justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: height * 0.9, paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl },
  modalForm: { flex: 1 },

  // TimeTree Style
  timeTreeTitle: { fontSize: 20, fontWeight: '700', color: Colors.text, paddingVertical: 12, borderBottomWidth: 1.5, borderBottomColor: '#F1F5F9', marginBottom: 12 },
  timeTreeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  rowLead: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowTail: { flexDirection: 'row', alignItems: 'center' },
  timeTreeRowText: { fontSize: 16, fontWeight: '700', color: Colors.text, marginLeft: 12 },
  timeTreeLabel: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary, marginLeft: 12, width: 42 },
  timeTreeValue: { fontSize: 16, fontWeight: '600', color: Colors.text, marginLeft: 12 },
  timeTreePickerText: { fontSize: 15, fontWeight: '700', color: '#00668a', backgroundColor: '#00668a1A', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  timeTreeTimeText: { fontSize: 15, fontWeight: '700', color: '#00668a' },
  timeLabelSmall: { backgroundColor: '#00668a1A', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginLeft: 8 },
  timeTreeDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 4 },
  timeTreeInput: { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.text, marginLeft: 10, paddingVertical: 4 },
  memoSection: { marginTop: 16, paddingHorizontal: 4 },
  memoHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  memoLabel: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary },
  timeTreeMemoFull: { 
    fontSize: 16, 
    fontWeight: '500', 
    color: Colors.text, 
    minHeight: 150, 
    textAlignVertical: 'top', 
    padding: 16, 
    backgroundColor: '#F8FAFC', 
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9'
  },
  fullMemoInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    padding: 20,
    textAlignVertical: 'top',
    minHeight: 300,
  },
  memoPreviewBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginTop: 4,
    overflow: 'hidden',
  },
  memoPreviewText: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
    width: '100%',
    flexShrink: 1,
  },
  timeTreeSaveBtn: { backgroundColor: '#111827', height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 40, marginBottom: 40 },

  modalFooter: { 
    flexDirection: 'row', 
    paddingTop: 16, 
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: 'white',
    paddingHorizontal: Spacing.xl,
  },
  modalCancelBtn: { 
    flex: 1, 
    height: 56, 
    borderRadius: 16, 
    backgroundColor: '#F8FAFC', 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  modalSaveBtn: { 
    flex: 1, 
    height: 56, 
    borderRadius: 16, 
    backgroundColor: '#111827', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  cancelBtnText: { color: Colors.textSecondary, fontSize: 16, fontWeight: '700' },
  saveBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },

  inputLabel: { fontSize: 13, fontWeight: '800', color: Colors.textSecondary, marginBottom: 8, marginTop: 16 },
  textInput: { backgroundColor: '#F4F7FE', borderRadius: 16, paddingHorizontal: 16, height: 52, fontSize: 15, fontWeight: '600', color: Colors.text, justifyContent: 'center' },
  disabledInput: { opacity: 0.6 },
  inputGrid: { flexDirection: 'row' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F7FE', borderRadius: 16, paddingHorizontal: 16, height: 52 },
  searchField: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  saveBtn: { backgroundColor: '#111827', height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 40, marginBottom: 40 },
  saveBtnText: { color: 'white', fontSize: 17, fontWeight: '800' },
  innerSearchOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'white', zIndex: 100, padding: 20, paddingTop: Constants.statusBarHeight + 10 },
  iosPickerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', zIndex: 200 },
  iosPickerCard: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40, height: 320 },
  iosPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer },
  iosPickerTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  iosPickerDone: { fontSize: 16, fontWeight: '800', color: Colors.primary },
  innerSearchPath: { flex: 1, height: 50, fontSize: 18, fontWeight: '700', color: Colors.text, marginLeft: 12 },
  searchItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer },
  searchItemName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  searchItemAddr: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  clearRegionBtn: { marginTop: 6, alignSelf: 'flex-end' },
  clearRegionText: { fontSize: 11, color: Colors.error, fontWeight: '700' },

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

  // Bottom Sheet Styles
  sheetBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheetCloser: { ...StyleSheet.absoluteFillObject },
  sheetContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: height * 0.7,
    paddingTop: Spacing.sm,
  },
  sheetHeader: { alignItems: 'center', marginBottom: Spacing.md, paddingHorizontal: Spacing.lg },
  sheetKnob: { width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, marginBottom: 12 },
  sheetTitleArea: { width: '100%', marginBottom: 0, paddingHorizontal: Spacing.lg },
  sheetDateTitle: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  sheetSubtitle: { fontSize: 20, fontWeight: '800', color: Colors.text, marginTop: 0 },
  sheetCloseBtn: { position: 'absolute', right: 20, top: 18, padding: 6, backgroundColor: '#F4F7FE', borderRadius: 12 },
  sheetList: { flex: 1, marginTop: Spacing.sm, paddingHorizontal: Spacing.lg },
  sheetAddBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    backgroundColor: '#111827', 
    paddingVertical: 16, 
    borderRadius: 20, 
    marginHorizontal: Spacing.lg,
    marginBottom: Platform.OS === 'ios' ? 40 : 24,
    marginTop: 12,
    gap: 8,
  },
  sheetAddBtnText: { color: 'white', fontSize: 15, fontWeight: '800' },
  holidayHeaderBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#F8FAFC', 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  holidayHeaderText: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: Colors.primary, 
    marginLeft: 4 
  },
  holidayHint: { fontSize: 12, color: Colors.textSecondary, marginBottom: 8 },
  holidaySection: { marginBottom: 12, gap: 8 },
  holidayBadge: { backgroundColor: '#DC2626' + '10', borderRadius: 16, padding: 12, borderLeftWidth: 4, borderLeftColor: '#DC2626' },
  holidayNameText: { fontSize: 15, fontWeight: '800', color: '#DC2626' },
  holidayTypeText: { fontSize: 11, fontWeight: '700', color: '#DC2626' + '80', marginTop: 2 },

  closeBtnAbsolute: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  closeBtnHeader: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  searchHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  holidayFooter: {
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 20 : 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: 'white',
  },
  holidayCloseBtn: {
    backgroundColor: '#111827',
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  holidayCloseBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
  },
  sectionSmallTitle: { fontSize: 13, fontWeight: '800', color: Colors.textSecondary, textTransform: 'uppercase', marginBottom: 12, marginTop: 8 },
  countryResultItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  countryResultName: { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.text },
  countryResultCode: { fontSize: 13, fontWeight: '700', color: Colors.outline, marginRight: 12 },
  selectedCountryItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, backgroundColor: '#F4F7FE', borderRadius: 16, paddingHorizontal: 16, marginBottom: 10 },
  selectedCountryName: { fontSize: 16, fontWeight: '700', color: Colors.text },
  selectedCountryCode: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary, marginTop: 2 },
  countryRemoveBtn: { padding: 8, backgroundColor: 'white', borderRadius: 10 },

  // Task Detail Styles (TimeTree Style)
  detailOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  detailContent: { flex: 1, backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, marginTop: 40 },
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 60 },
  detailHeaderBtn: { padding: 10 },
  detailBody: { paddingHorizontal: 24, paddingTop: 10 },
  detailTitleSection: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 32 },
  detailColorBar: { width: 6, height: 32, borderRadius: 3, marginRight: 16, marginTop: 4 },
  detailTitle: { flex: 1, fontSize: 26, fontWeight: '800', lineHeight: 34 },
  detailDateSection: { flexDirection: 'row', alignItems: 'center', marginBottom: 40, paddingVertical: 10 },
  detailDateBlock: { flex: 1 },
  detailDateYear: { fontSize: 13, fontWeight: '700', color: Colors.outline, marginBottom: 4 },
  detailDateMain: { fontSize: 20, fontWeight: '800', color: Colors.text },
  detailDateTime: { fontSize: 24, fontWeight: '800', color: Colors.text, marginTop: 4 },
  detailInfoList: { gap: 24 },
  detailInfoItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
  detailInfoText: { fontSize: 16, fontWeight: '600', color: Colors.text },
  detailFooter: { display: 'none' },

  // Floating Menu Styles
  floatingMenu: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 8,
    width: 180,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 1000,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 12,
  },
  menuText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  toastContainer: {
    position: 'absolute',
    left: '10%',
    right: '10%',
    backgroundColor: 'rgba(60,60,60,0.72)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  toastText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  inlinePickerContainer: {
    backgroundColor: 'white',
    borderRadius: 20,
    marginTop: 10,
    padding: 10,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
      android: { elevation: 2 }
    })
  },
  customWheelContainer: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 24,
    marginTop: 10,
    overflow: 'hidden',
    paddingBottom: 8,
  },
  wheelHeader: {
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.outlineVariant,
  },
  wheelHeaderTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.primary,
  },
  wheelRowCustom: {
    flexDirection: 'row',
    height: ITEM_HEIGHT * 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelColCustom: {
    flex: 1,
    height: ITEM_HEIGHT * 3,
  },
  wheelItemCustom: {
    height: ITEM_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wheelItemTextCustom: {
    fontSize: 18,
    color: Colors.outline,
    fontWeight: '500',
  },
  activeWheelTextCustom: {
    color: Colors.onBackground,
    fontSize: 22,
    fontWeight: '800',
  },
});

export default TasksScreen;
