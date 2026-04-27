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
import { BorderlessButton } from 'react-native-gesture-handler';
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
import { getFlows } from '../services/FlowService';
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

import { BANNER_UNIT_ID } from '../constants/AdUnits';
import AdBanner from '../components/AdBanner';
import { useSubscription } from '../contexts/SubscriptionContext';
import { BannerAdSize } from 'react-native-google-mobile-ads';

// Moved width/height inside component for logic, but need global for styles
const { width, height } = Dimensions.get('window');
const YEARS = Array.from({ length: 201 }, (_, i) => 1900 + i);
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const ITEM_HEIGHT = 50;
const TASK_COLOR_LABELS = [
  { key: 'dark_blue', name: '다크 블루', color: '#2A234F' },
  { key: 'charcoal', name: '차콜', color: '#2B2B2B' },
  { key: 'navy_blue', name: '네이비 블루', color: '#10367D' },
  { key: 'burgundy', name: '버건디', color: '#7D2027' },
  { key: 'indigo', name: '인디고', color: '#3730A3' },
  { key: 'forest_green', name: '포레스트 그린', color: '#06530B' },
  { key: 'olive_green', name: '올리브 그린', color: '#574C00' },
  { key: 'crimson_red', name: '크림슨 레드', color: '#B40023' },
  { key: 'slate', name: '슬레이트', color: '#475569' },
  { key: 'peacock_blue', name: '피콕 블루', color: '#006D77' },
  { key: 'violet', name: '바이올렛', color: '#7C3AED' },
  { key: 'emerald', color: '#047857', name: '에메랄드' },
  { key: 'mustard', color: '#887114', name: '머스타드' },
  { key: 'orange', color: '#EA2E00', name: '오렌지' },
  { key: 'coral', color: '#E05252', name: '코럴' },
  { key: 'terracotta', color: '#C66B3D', name: '테라코타' },
  { key: 'sky_blue', color: '#2196F3', name: '스카이 블루' },
  { key: 'sage_green', color: '#A8B89F', name: '세이지 그린' },
  { key: 'blush_pink', color: '#FFB3C3', name: '블러쉬 핑크' },
  { key: 'pastel_purple', color: '#BBBFEC', name: '파스텔 퍼플' },
  { key: 'lavender', color: '#EBEBEB', name: '라벤더' },
  { key: 'cream', color: '#F4EFE6', name: '크림' },
  { key: 'ivory', color: '#FEF9DB', name: '아이보리' },
  { key: 'beige', color: '#F0E7D6', name: '베이지' },
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

const MonthGrid = React.memo(({ index, tasks, flows, selectedDateStr, holidaysMap, onDayPress }) => {
  const baseDate = React.useMemo(() => getDateFromIndex(index), [index]);
  const days = React.useMemo(() => getMonthDays(baseDate), [baseDate]);

  const { monthTasks, taskSlots } = React.useMemo(() => {
    const monthStart = dateStr(days[0].date);
    const monthEnd = dateStr(days[days.length - 1].date);

    // 1. Filter user tasks
    const mTasksFromUser = (tasks || []).filter(t => {
      if (t.isCompleted) return false;
      return t.date <= monthEnd && (t.endDate || t.date) >= monthStart;
    });

    // 2. Convert Flow steps to tasks
    const fTasks = [];
    (flows || []).forEach(flow => {
      (flow.steps || []).forEach(step => {
        if (step.date && step.date <= monthEnd && (step.endDate || step.date) >= monthStart) {
          fTasks.push({
            id: `flow_${flow.id}_${step.id}`,
            title: `[${flow.title || '플로우'}] ${step.activity}`,
            date: step.date,
            endDate: step.endDate || step.date,
            color: flow.color || (flow.gradient && flow.gradient[0]) || Colors.primary,
            isFlowTask: true,
            flowId: flow.id,
            stepId: step.id
          });
        }
      });
    });

    // 3. Convert public holidays to tasks
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

    // 4. Combine and sort
    const combinedTasks = [...mTasksFromUser, ...fTasks, ...hTasks].sort((a, b) => {
      const pA = a.isHoliday ? 0 : (a.isFlowTask ? 1 : 2);
      const pB = b.isHoliday ? 0 : (b.isFlowTask ? 1 : 2);
      if (pA !== pB) return pA - pB;
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      const durA = new Date(a.endDate || a.date) - new Date(a.date);
      const durB = new Date(b.endDate || b.date) - new Date(b.date);
      return durB - durA;
    });

    const slots = {};
    const numWeeks = Math.ceil(days.length / 7);

    for (let week = 0; week < numWeeks; week++) {
      const weekStart = week * 7;
      const weekEnd = Math.min(weekStart + 6, days.length - 1);
      const occ = Array.from({ length: 7 }, () => []);

      const weekTasks = combinedTasks.filter(task => {
        const si = days.findIndex(d => dateStr(d.date) === task.date);
        const ei = days.findIndex(d => dateStr(d.date) === (task.endDate || task.date));
        const es = si === -1 ? 0 : si;
        const ee = ei === -1 ? days.length - 1 : ei;
        return es <= weekEnd && ee >= weekStart;
      });

      weekTasks.forEach(task => {
        const si = days.findIndex(d => dateStr(d.date) === task.date);
        const ei = days.findIndex(d => dateStr(d.date) === (task.endDate || task.date));
        const es = si === -1 ? 0 : si;
        const ee = ei === -1 ? days.length - 1 : ei;
        const segStart = Math.max(es, weekStart) - weekStart;
        const segEnd = Math.min(ee, weekEnd) - weekStart;

        let slot = 0;
        while (slot < 4) {
          let available = true;
          for (let i = segStart; i <= segEnd; i++) {
            if (occ[i].includes(slot)) { available = false; break; }
          }
          if (available) break;
          slot++;
        }

        const key = `${task.id}_${week}`;
        if (slot < 4) {
          slots[key] = slot;
          for (let i = segStart; i <= segEnd; i++) occ[i].push(slot);
        }
      });
    }

    return { monthTasks: combinedTasks, taskSlots: slots };
  }, [tasks, flows, days, holidaysMap]);

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
                const weekIndex = Math.floor(i / 7);
                const task = dayTasks.find(t => taskSlots[`${t.id}_${weekIndex}`] === slotIdx);
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
              {(() => {
                const wk = Math.floor(i / 7);
                const hidden = dayTasks.filter(t => taskSlots[`${t.id}_${wk}`] === undefined).length;
                return hidden > 0 ? (
                  <View style={styles.moreTasksRow}>
                    <Text style={[styles.moreTasksText, !day.current && { opacity: 0.5 }]}>+{hidden}</Text>
                  </View>
                ) : null;
              })()}
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
  const isKorean = i18n.language.startsWith('ko');

  // State
  const [tasks, setTasks] = useState([]);
  const [flows, setFlows] = useState([]);
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

  const { isPremium } = useSubscription();

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
  const [isEditingInSheet, setIsEditingInSheet] = useState(false);
  const editSheetX = useRef(new Animated.Value(width)).current;

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

    setShowColorPicker(false);
    setSearchMode(null);
    // 날짜/시간 피커가 열린 채 모달을 닫을 경우 피커 상태 초기화
    setShowDatePicker(false);
    setShowTimePicker(false);
    setShowEndDatePicker(false);
    setShowEndTimePicker(false);
    setIsAdding(false);
    if (typeof onAfterClose === 'function') {
      onAfterClose();
    }
  }, [isMemoEditing, setShowColorPicker, setSearchMode]);

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
      onStartShouldSetPanResponderCapture: () => false,
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 1 && Math.abs(gs.dy) > Math.abs(gs.dx),
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

  // Modal open animations are now triggered directly via onPress/onShow for better reliability.



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
  const [pendingColor, setPendingColor] = useState(TASK_COLOR_LABELS[0].color);
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

  useEffect(() => {
    const unsubscribe = navigation.addListener('tabPress', () => {
      setIsAdding(false);
      setIsTaskListVisible(false);
      setSelectedTaskDetail(null);
      setIsDetailMenuVisible(false);
      setIsEditingInSheet(false);
      const today = new Date();
      setSelectedDate(today);
      calendarListRef.current?.scrollToIndex({ index: getMonthIndex(today), animated: true });
    });
    return unsubscribe;
  }, [navigation]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  // 취소 시 원복을 위한 백업 ref
  const pickerBackupRef = useRef({ taskDate: null, endDate: null, newTime: null, endTime: null });
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
    const flowsData = await getFlows();
    setTasks(data);
    setFlows(flowsData);
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
    // 1. User tasks
    const ut = (tasks || []).filter(t => {
      const start = t.date;
      const end = t.endDate || t.date;
      return ds >= start && ds <= end;
    });

    // 2. Flow tasks
    const ft = [];
    (flows || []).forEach(flow => {
      (flow.steps || []).forEach(step => {
        const sEnd = step.endDate || step.date;
        if (step.date && ds >= step.date && ds <= sEnd) {
          ft.push({
            id: `flow_${flow.id}_${step.id}`,
            title: `[${flow.title || '플로우'}] ${step.activity}`,
            date: step.date,
            endDate: sEnd,
            color: flow.color || (flow.gradient && flow.gradient[0]) || Colors.primary,
            isFlowTask: true,
            flowTitle: flow.title,
            memo: step.memo,
            region: step.region,
            time: step.time,
            flowId: flow.id
          });
        }
      });
    });

    return [...ut, ...ft];
  }, [tasks, flows, selectedDate]);

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

  // 취소: 피커를 열기 전 값으로 원복
  const cancelPickers = () => {
    const b = pickerBackupRef.current;
    if (b.taskDate) setTaskDate(b.taskDate);
    if (b.endDate) setEndDate(b.endDate);
    if (b.newTime) setNewTime(b.newTime);
    if (b.endTime) setEndTime(b.endTime);
    closeAllPickers();
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
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    } catch (e) { }

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
    modalAddY.setValue(height);
    Animated.spring(modalAddY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
      speed: 14,
    }).start();
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
    modalAddY.setValue(height);
    Animated.spring(modalAddY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
      speed: 14,
    }).start();
  };

  const openEditInSheet = (task) => {
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
    setSelectedColor(task.color || Colors.primary);
    editSheetX.setValue(width);
    setIsEditingInSheet(true);
    Animated.spring(editSheetX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
      speed: 14,
    }).start();
  };

  const closeEditInSheet = useCallback((onAfterClose) => {
    Keyboard.dismiss();
    setShowColorPicker(false);
    setSearchMode(null);
    setShowDatePicker(false);
    setShowTimePicker(false);
    setShowEndDatePicker(false);
    setShowEndTimePicker(false);
    setIsMemoEditing(false);
    Animated.timing(editSheetX, {
      toValue: width,
      duration: 260,
      useNativeDriver: true,
    }).start(() => {
      setIsEditingInSheet(false);
      setEditingTask(null);
      if (typeof onAfterClose === 'function') onAfterClose();
    });
  }, [editSheetX]);

  const handleSaveTask = async () => {
    if (!newTitle.trim()) {
      showToast(t('tasks.enter_title', '투두를 입력해주세요'));
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

    if (isEditingInSheet) {
      closeEditInSheet();
    } else {
      closeAddModal();
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    showToast(editingTask ? t('tasks.edit_success') : t('tasks.save_success'));
  };

  const formatDisplayDate = (date) => {
    const locale = isKorean ? 'ko-KR' : 'en-US';
    return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  };

  const formatDetailDate = (dateStr) => {
    const date = new Date(dateStr);
    const locale = isKorean ? 'ko-KR' : 'en-US';
    const year = isKorean ? `${date.getFullYear()}년` : `${date.getFullYear()}`;
    const main = date.toLocaleDateString(locale, { month: 'short', day: 'numeric', weekday: 'short' });
    return { year, main };
  };

  const handleToggle = async (id) => {
    const updated = await toggleTaskCompletion(id);
    const task = tasks.find(t => t.id === id);
    const newStatus = !task?.isCompleted;
    setTasks(updated);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    showToast(newStatus ? t('tasks.complete_success') : t('tasks.incomplete_success'));
  };

  const handleDelete = (id) => {
    Alert.alert(t('common.delete'), t('tasks.delete_confirm'), [
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
      listModalTranslateY.setValue(height);
      Animated.spring(listModalTranslateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
        speed: 14,
      }).start();
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
        flows={flows}
        selectedDateStr={dateStr(selectedDate)}
        holidaysMap={holidaysMap}
        onDayPress={handleDayPress}
      />
    );
  }, [tasks, flows, selectedDate, holidaysMap, handleDayPress]);

  const searchTimerRef = useRef(null);
  const handleSearch = (val) => {
    setSearchQuery(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (val.length < 2) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(async () => {
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
    }, 500);
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
    <>
      <View style={[styles.container, { paddingTop: Constants.statusBarHeight }]}>
        <MainHeader onMenuPress={() => setMenuVisible(true)} />
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingTop: Spacing.md }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Content */}
          <View style={{ marginBottom: 0 }}>
            <View style={styles.monthHeaderRow}>
              <TouchableOpacity style={styles.monthSelectBtn} onPress={openPicker}>
                <Text style={styles.monthText}>
                  {selectedDate.toLocaleString(i18n.language === 'ko' ? 'ko-KR' : 'en-US', { month: 'long', year: 'numeric' })}
                </Text>
                <Calendar size={20} color="#1B254B" style={{ marginLeft: 8 }} pointerEvents="none" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.holidayHeaderBtn, { flexShrink: 1, maxWidth: width * 0.4 }]}
                onPress={() => {
                  setShowHolidaySettings(true);
                  holidayModalY.setValue(height);
                  Animated.spring(holidayModalY, {
                    toValue: 0,
                    useNativeDriver: true,
                    bounciness: 4,
                    speed: 14,
                  }).start();
                }}
              >
                <MapPin size={14} color={Colors.primary} />
                <Text style={styles.holidayHeaderText} numberOfLines={1} ellipsizeMode="tail">
                  {t('tasks.holidays_label')}{(holidayCountries || []).join(', ')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {isPremium ? (
            <View style={{ height: 18 }} />
          ) : (
            <View style={{ marginBottom: 10 }}>
              <AdBanner />
            </View>
          )}

          <View style={styles.calendarArea}>
            <View style={styles.weekdayLabels}>
              {(t('common.days_short', { returnObjects: true }) || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']).map(d => (
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
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.sheetDateTitle}>{formatDisplayDate(selectedDate)}</Text>
                          <Text style={styles.sheetSubtitle}>{t('tasks.scheduled_tasks', 'Scheduled Tasks')}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={closeTaskListModal}
                          style={styles.headerSaveBtn}
                          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                          <Text style={styles.headerSaveText} pointerEvents="none">{t('common.close', '닫기')}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <ScrollView
                    style={styles.sheetList}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
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

                              <TouchableOpacity
                                onPress={task.isFlowTask ? null : () => handleToggle(task.id)}
                                style={[styles.listItemCheck, task.isFlowTask && { opacity: 0.3 }]}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                disabled={task.isFlowTask}
                              >
                                {task.isCompleted ?
                                  <CheckCircle2 size={20} color={taskCol} pointerEvents="none" /> :
                                  <Circle size={20} color={Colors.outlineVariant} pointerEvents="none" />
                                }
                              </TouchableOpacity>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </ScrollView>

                  {/* Fixed Footer with Large Ad and Add Button (TimeTree Style) */}
                  <View style={styles.modalFooter}>
                    {isPremium ? (
                      <View style={{ height: 18 }} />
                    ) : (
                      <View style={{ marginBottom: 12, alignItems: 'center' }}>
                        <AdBanner size={BannerAdSize.MEDIUM_RECTANGLE} />
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.sheetAddBtn}
                      onPress={() => { setIsTaskListVisible(false); openAddModal(); }}
                    >
                      <Plus size={20} color="white" strokeWidth={3} />
                      <Text style={styles.sheetAddBtnText}>{t('tasks.addNew', 'Add New Task')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* PAGE 2: Task Detail */}
                <View style={{ width: width }}>
                  <View style={styles.modalHeader} {...listModalPanResponder.panHandlers}>
                    <View style={styles.modalHandle} />
                    <View style={{ flexDirection: 'row', width: '100%', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 }}>
                      <TouchableOpacity onPress={handleBackToList} style={styles.detailHeaderBtn} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                        <ChevronLeft size={28} color={Colors.text} pointerEvents="none" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={selectedTaskDetail?.isFlowTask ? null : () => setIsDetailMenuVisible(true)}
                        style={[styles.detailHeaderBtn, selectedTaskDetail?.isFlowTask && { opacity: 0.3 }]}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        disabled={!selectedTaskDetail || selectedTaskDetail.isFlowTask}
                      >
                        <MoreHorizontal size={24} color={Colors.text} pointerEvents="none" />
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
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.detailTitle, { color: Colors.text }, selectedTaskDetail.isCompleted && styles.taskTitleCompleted]}>{selectedTaskDetail.title}</Text>
                            {selectedTaskDetail.isFlowTask && (
                              <Text style={{ fontSize: 12, color: Colors.primary, marginTop: 4, fontWeight: '600' }}>
                                {t('tasks.flowReadOnlyNotice', '* This task is read-only information managed in Flow.')}
                              </Text>
                            )}
                          </View>
                        </View>

                        <View style={[styles.detailDateSection, { justifyContent: 'center', gap: 15 }]}>
                          {(() => {
                            const { year, main } = formatDetailDate(selectedTaskDetail.date); return (
                              <View style={{ alignItems: 'center' }}>
                                <Text style={styles.detailDateYear}>{year}</Text>
                                <Text style={styles.detailDateMain}>{main}</Text>
                                {!selectedTaskDetail.isAllDay && <Text style={styles.detailDateTime}>{selectedTaskDetail.time || '00:00'}</Text>}
                              </View>
                            );
                          })()}
                          <ArrowRight size={24} color={Colors.primary} />
                          {(() => {
                            const { year, main } = formatDetailDate(selectedTaskDetail.endDate || selectedTaskDetail.date); return (
                              <View style={{ alignItems: 'center' }}>
                                <Text style={styles.detailDateYear}>{year}</Text>
                                <Text style={styles.detailDateMain}>{main}</Text>
                                {!selectedTaskDetail.isAllDay && <Text style={styles.detailDateTime}>{selectedTaskDetail.endTime || selectedTaskDetail.time || '00:00'}</Text>}
                              </View>
                            );
                          })()}
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
                                {(() => {
                                  const label = TASK_COLOR_LABELS.find(l => l.color === (selectedTaskDetail.color || Colors.primary));
                                  return label ? t(`tasks.colors.${label.key}`, label.name) : t('tasks.defaultColor', 'Default Color');
                                })()}
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
                          showToast(newStatus ? t('tasks.complete_success') : t('tasks.incomplete_success'));
                        }}>
                          <CheckCircle2 size={18} color={selectedTaskDetail.isCompleted ? Colors.primary : Colors.text} />
                          <Text style={[styles.menuText, selectedTaskDetail.isCompleted && { color: Colors.primary }]}>
                            {selectedTaskDetail.isCompleted ? t('tasks.mark_incomplete') : t('tasks.mark_complete')}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.menuItem} onPress={async () => {
                          setIsDetailMenuVisible(false);
                          const shareText = `[Todo] ${selectedTaskDetail.title}\nPeriod: ${selectedTaskDetail.date} ~ ${selectedTaskDetail.endDate || selectedTaskDetail.date}\nNotes: ${selectedTaskDetail.memo || ''}`;
                          await Clipboard.setStringAsync(shareText);
                          showToast(t('tasks.copy_success'));
                        }}>
                          <Share2 size={18} color={Colors.text} /><Text style={styles.menuText}>{t('tasks.share')}</Text>
                        </TouchableOpacity>

                        <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 4 }} />

                        <TouchableOpacity style={styles.menuItem} onPress={() => { setIsDetailMenuVisible(false); openEditInSheet(selectedTaskDetail); }}>
                          <Pencil size={18} color={Colors.text} /><Text style={styles.menuText}>{t('common.edit')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.menuItem} onPress={() => {
                          setIsDetailMenuVisible(false);
                          const taskId = selectedTaskDetail.id;
                          isAlertActiveRef.current = true;
                          Alert.alert(t('common.delete'), t('tasks.delete_confirm'), [
                            { text: t('common.cancel'), style: 'cancel', onPress: () => { isAlertActiveRef.current = false; } },
                            {
                              text: t('common.delete'), style: 'destructive', onPress: async () => {
                                isAlertActiveRef.current = false;
                                handleBackToList();
                                const updated = await deleteTask(taskId);
                                setTasks(updated);
                                showToast(t('tasks.delete_success'));
                              }
                            }
                          ], { cancelable: false });
                        }}>
                          <Trash2 size={18} color={Colors.error} /><Text style={[styles.menuText, { color: Colors.error }]}>{t('common.delete')}</Text>
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              </Animated.View>

              {/* PAGE 3: Edit Panel (slides in from right within the same modal) */}
              {isEditingInSheet && (
                <Animated.View style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: 'white', paddingHorizontal: Spacing.xl, transform: [{ translateX: editSheetX }] }
                ]}>
                  <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={{ flex: 1 }}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
                  >
                    {isMemoEditing ? (
                      <View style={{ flex: 1 }}>
                        <View style={styles.modalHeader}>
                          <View style={styles.modalHandle} />
                          <View style={{ flexDirection: 'row', width: '100%', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 }}>
                            <TouchableOpacity onPress={() => setIsMemoEditing(false)} style={styles.headerActionBtn} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                              <ChevronLeft size={28} color={Colors.text} pointerEvents="none" />
                            </TouchableOpacity>
                            <View style={{ alignItems: 'center' }}>
                              <Text style={styles.modalTitle}>Memo</Text>
                              <Text style={{ fontSize: 11, color: Colors.outline, fontWeight: '600' }}>{newMemo.length} / 1000</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsMemoEditing(false)} style={styles.headerSaveBtn} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                              <Text style={styles.headerSaveText} pointerEvents="none">{t('common.done', 'Done')}</Text>
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
                            autoCapitalize="none"
                            maxLength={1000}
                            placeholderTextColor={Colors.outline}
                            textAlignVertical="top"
                          />
                        </View>
                      </View>
                    ) : (
                      <>
                        <View style={styles.modalHeader} {...addModalPanResponder.panHandlers}>
                          <View style={styles.modalHandle} />
                          <View style={{ flexDirection: 'row', width: '100%', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 8 }}>
                            <TouchableOpacity onPress={() => closeEditInSheet()} style={styles.headerActionBtn} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                              <ChevronLeft size={28} color={Colors.text} pointerEvents="none" />
                            </TouchableOpacity>
                            <Text style={styles.modalTitle}>{t('tasks.edit_task', 'Edit Task')}</Text>
                            {isKeyboardVisible ? (
                              <TouchableOpacity onPress={() => Keyboard.dismiss()} style={styles.headerActionBtn} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }} pointerEvents="none">
                                  <KeyboardIcon size={22} color={Colors.primary} pointerEvents="none" />
                                  <ChevronDown size={14} color={Colors.primary} pointerEvents="none" />
                                </View>
                              </TouchableOpacity>
                            ) : (
                              <TouchableOpacity onPress={handleSaveTask} style={styles.headerSaveBtn} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                                <Text style={styles.headerSaveText} pointerEvents="none">{t('common.save', 'Save')}</Text>
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
                            placeholder={t('tasks.placeholder', '투두')}
                            value={newTitle}
                            onChangeText={setNewTitle}
                            returnKeyType="done"
                            autoCapitalize="none"
                            onSubmitEditing={() => Keyboard.dismiss()}
                          />
                          <TouchableOpacity style={styles.timeTreeRow} onPress={() => { Keyboard.dismiss(); setPendingColor(selectedColor); setShowColorPicker(true); }}>
                            <View style={styles.rowLead}>
                              <View style={[styles.colorIndicator, { backgroundColor: selectedColor, marginRight: 12 }]} />
                              <Text style={styles.timeTreeRowText}>
                                {(() => {
                                  const label = TASK_COLOR_LABELS.find(l => l.color === selectedColor);
                                  return label ? t(`tasks.colors.${label.key}`, label.name) : t('tasks.selectLabel', 'Select Label');
                                })()}
                              </Text>
                            </View>
                            <ChevronRight size={20} color={Colors.outline} />
                          </TouchableOpacity>
                          <View style={styles.timeTreeDivider} />
                          <View style={styles.timeTreeRow}>
                            <View style={styles.rowLead}>
                              <Compass size={22} color={isAllDay ? Colors.primary : Colors.textSecondary} />
                              <Text style={styles.timeTreeRowText}>{t('tasks.all_day', 'All Day')}</Text>
                            </View>
                            <Switch value={isAllDay} onValueChange={setIsAllDay} trackColor={{ false: '#E2E8F0', true: Colors.primary + '80' }} thumbColor={isAllDay ? Colors.primary : '#F4F7FE'} />
                          </View>
                          <View style={styles.timeTreeDivider} />
                          <View style={styles.timeTreeRow}>
                            <View style={styles.rowLead}>
                              <Calendar size={20} color={Colors.textSecondary} />
                              <Text style={styles.timeTreeLabel}>{t('tasks.start', 'Start')}</Text>
                            </View>
                            <View style={styles.rowTail}>
                              <TouchableOpacity onPress={() => { Keyboard.dismiss(); pickerBackupRef.current = { taskDate: new Date(taskDate), endDate: new Date(endDate), newTime, endTime }; setShowDatePicker(true); }}>
                                <Text style={styles.timeTreePickerText}>{formatDisplayDate(taskDate)}</Text>
                              </TouchableOpacity>
                              {!isAllDay && (
                                <TouchableOpacity style={styles.timeLabelSmall} onPress={() => { Keyboard.dismiss(); pickerBackupRef.current = { taskDate: new Date(taskDate), endDate: new Date(endDate), newTime, endTime }; setShowTimePicker(true); }}>
                                  <Text style={styles.timeTreeTimeText}>{newTime}</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                          <View style={styles.timeTreeRow}>
                            <View style={styles.rowLead}>
                              <View style={{ width: 22 }} />
                              <Text style={styles.timeTreeLabel}>{t('tasks.end', 'End')}</Text>
                            </View>
                            <View style={styles.rowTail}>
                              <TouchableOpacity onPress={() => { Keyboard.dismiss(); pickerBackupRef.current = { taskDate: new Date(taskDate), endDate: new Date(endDate), newTime, endTime }; setShowEndDatePicker(true); }}>
                                <Text style={styles.timeTreePickerText}>{formatDisplayDate(endDate)}</Text>
                              </TouchableOpacity>
                              {!isAllDay && (
                                <TouchableOpacity style={styles.timeLabelSmall} onPress={() => { Keyboard.dismiss(); pickerBackupRef.current = { taskDate: new Date(taskDate), endDate: new Date(endDate), newTime, endTime }; setShowEndTimePicker(true); }}>
                                  <Text style={styles.timeTreeTimeText}>{endTime}</Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          </View>
                          <View style={styles.timeTreeDivider} />
                          <View style={styles.timeTreeRow}>
                            <View style={styles.rowLead}>
                              <MapPin size={22} color={Colors.textSecondary} />
                              <TextInput
                                style={styles.timeTreeInput}
                                placeholder={t('tasks.loc_placeholder', 'Location')}
                                value={newLocName}
                                onChangeText={setNewLocName}
                                autoCapitalize="none"
                              />
                            </View>
                          </View>
                          <View style={styles.timeTreeDivider} />
                          <TouchableOpacity style={styles.memoSection} onPress={() => { Keyboard.dismiss(); setIsMemoEditing(true); }}>
                            <View style={styles.memoHeader}>
                              <AlignLeft size={18} color={Colors.textSecondary} />
                              <Text style={styles.memoLabel}>{t('tasks.memo', 'Memo')}</Text>
                            </View>
                            <View style={styles.memoPreviewBox}>
                              <Text style={[styles.memoPreviewText, !newMemo && { color: Colors.outline }]} numberOfLines={10} ellipsizeMode="tail">
                                {newMemo ? (newMemo.split('\n').length > 10 ? newMemo.split('\n').slice(0, 10).join('\n') + '...' : newMemo) : t('tasks.memo_placeholder', 'Add notes...')}
                              </Text>
                            </View>
                          </TouchableOpacity>
                        </ScrollView>
                      </>
                    )}
                  </KeyboardAvoidingView>

                  {/* Date / Time Picker Overlay */}
                  {Platform.OS === 'ios' && (showDatePicker || showTimePicker || showEndDatePicker || showEndTimePicker) && (
                    <View style={styles.iosPickerOverlay}>
                      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeAllPickers} />
                      <View style={[styles.iosPickerCard, (showDatePicker || showEndDatePicker) && { height: 490 }]}>
                        <View style={{ width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 4 }} />
                        <View style={styles.iosPickerHeader}>
                          <TouchableOpacity onPress={cancelPickers} style={{ padding: 4 }}>
                            <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.textSecondary }}>{t('common.cancel', '취소')}</Text>
                          </TouchableOpacity>
                          <Text style={styles.iosPickerTitle}>
                            {(showDatePicker || showEndDatePicker) ? t('tasks.date', '날짜') : t('tasks.time', '시간')}
                          </Text>
                          <TouchableOpacity onPress={closeAllPickers} style={{ padding: 4 }}>
                            <Text style={[styles.iosPickerDone, { color: Colors.primary }]}>{t('common.done', '완료')}</Text>
                          </TouchableOpacity>
                        </View>
                        {(showDatePicker || showEndDatePicker) ? (
                          <DateTimePicker
                            key={i18n.language}
                            value={(() => {
                              try {
                                if (showDatePicker) return taskDate instanceof Date ? taskDate : new Date(taskDate);
                                if (showEndDatePicker) return endDate instanceof Date ? endDate : new Date(endDate);
                              } catch (e) { return new Date(); }
                              return new Date();
                            })()}
                            mode="date"
                            display="inline"
                            locale={i18n.language}
                            accentColor={Colors.primary}
                            onChange={(event, date) => {
                              if (showDatePicker) onDateChange(event, date);
                              else if (showEndDatePicker) onEndDateChange(event, date);
                            }}
                            style={{ width: width - 32, height: 360, alignSelf: 'center' }}
                          />
                        ) : (
                          <View style={{ height: 216, justifyContent: 'center', backgroundColor: 'white' }}>
                            <DateTimePicker
                              key={i18n.language}
                              value={(() => {
                                try {
                                  if (showTimePicker) {
                                    const [h, m] = newTime.split(':').map(Number);
                                    const d = new Date(taskDate); d.setHours(h); d.setMinutes(m); return d;
                                  }
                                  if (showEndTimePicker) {
                                    const [h, m] = endTime.split(':').map(Number);
                                    const d = new Date(endDate); d.setHours(h); d.setMinutes(m); return d;
                                  }
                                } catch (e) { return new Date(); }
                                return new Date();
                              })()}
                              mode="time"
                              display="spinner"
                              locale={i18n.language}
                              is24Hour={true}
                              textColor="black"
                              onChange={(event, date) => {
                                if (showTimePicker) onTimeChange(event, date);
                                else if (showEndTimePicker) onEndTimeChange(event, date);
                              }}
                              style={{ height: 216, width: width - 32, alignSelf: 'center' }}
                            />
                          </View>
                        )}
                      </View>
                    </View>
                  )}

                  {/* Color Picker Overlay */}
                  {showColorPicker && (
                    <View style={styles.innerSearchOverlay}>
                      <View style={[styles.searchHeader, { alignItems: 'flex-start', flexDirection: 'column', gap: 12 }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                          <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.text }}>{t('tasks.select_color', '라벨 선택')}</Text>
                          <TouchableOpacity onPress={() => { setSelectedColor(pendingColor); setShowColorPicker(false); }} style={{ paddingHorizontal: 16, paddingVertical: 7, backgroundColor: Colors.primary, borderRadius: 20 }}>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: 'white' }}>{t('common.select', 'Select')}</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, width: '100%' }}>
                          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: pendingColor, shadowColor: pendingColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 4 }} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 }}>
                              {(() => {
                                const label = TASK_COLOR_LABELS.find(l => l.color === pendingColor);
                                return label ? t(`tasks.colors.${label.key}`, label.name) : t('tasks.label', 'Label');
                              })()}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: pendingColor, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' }}>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: 'white' }}>{t('tasks.sample_task', 'Task Sample')}</Text>
                            </View>
                          </View>
                        </View>
                      </View>
                      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 8 }}>
                        <View style={styles.colorGrid}>
                          {TASK_COLOR_LABELS.map((item, idx) => {
                            const isPending = pendingColor === item.color;
                            return (
                              <TouchableOpacity
                                key={idx}
                                style={[styles.colorGridCell, isPending && { borderColor: item.color, borderWidth: 2, backgroundColor: item.color + '18' }]}
                                onPress={() => { if (isPending) { setSelectedColor(item.color); setShowColorPicker(false); } else { setPendingColor(item.color); } }}
                                activeOpacity={0.7}
                              >
                                <View style={[styles.colorSwatch, { backgroundColor: item.color }, item.color.toUpperCase() === '#EBEBEB' || item.color.toUpperCase() === '#F4EFE6' || item.color.toUpperCase() === '#FEF9DB' || item.color.toUpperCase() === '#F0E7D6' ? { borderWidth: 1, borderColor: '#E2E8F0' } : {}]}>
                                  {isPending && <View style={{ position: 'absolute', inset: 0, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: 'white' }} /></View>}
                                </View>
                                <Text style={styles.colorLabel} numberOfLines={1}>{t(`tasks.colors.${item.key}`, item.name)}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </ScrollView>
                    </View>
                  )}
                </Animated.View>
              )}
            </Animated.View>
            {renderToast('isTaskListVisible')}
          </View>

        </Modal>

        {renderToast('main')}


        {/* Picker and Adding modals will be rendered here as siblings */}

        {/* Wheel Picker Modal */}
        <Modal visible={isPickerVisible} transparent animationType="fade" onRequestClose={() => setIsPickerVisible(false)}>

          <View style={styles.pickerBg}>
            <View style={styles.pickerContent}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>{t('common.select_date', 'Select Date')}</Text>
                <TouchableOpacity onPress={() => setIsPickerVisible(false)} style={styles.headerSaveBtn} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                  <Text style={styles.headerSaveText} pointerEvents="none">{t('common.close', '닫기')}</Text>
                </TouchableOpacity>
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
                          <Text style={[styles.wheelItemText, tempYear === year && styles.activeWheelText]}>{year}{t('common.year_unit', '년')}</Text>
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
                          <Text style={[styles.wheelItemText, tempMonth === (month - 1) && styles.activeWheelText]}>
                            {t(`months.${month - 1}`)}{t('common.month_unit', '월')}
                          </Text>
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
                  <Text style={styles.todayBtnText}>{t('common.go_to_today', 'Go to Today')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={applyPicker}>
                  <Text style={styles.confirmBtnText}>{t('common.done', 'Done')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

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
                        <TouchableOpacity
                          onPress={() => setIsMemoEditing(false)}
                          style={styles.headerActionBtn}
                          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                          <ChevronLeft size={28} color={Colors.text} pointerEvents="none" />
                        </TouchableOpacity>
                        <View style={{ alignItems: 'center' }}>
                          <Text style={styles.modalTitle}>{t('tasks.memo', 'Memo')}</Text>
                          <Text style={{ fontSize: 11, color: Colors.outline, fontWeight: '600' }}>
                            {newMemo.length} / 1000
                          </Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => setIsMemoEditing(false)}
                          style={styles.headerSaveBtn}
                          hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                        >
                          <Text style={styles.headerSaveText} pointerEvents="none">{t('common.done', 'Done')}</Text>
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
                        autoCapitalize="none"
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
                        <TouchableOpacity onPress={() => closeAddModal()} style={styles.headerActionBtn} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                          <ChevronLeft size={28} color={Colors.text} pointerEvents="none" />
                        </TouchableOpacity>

                        <Text style={styles.modalTitle}>{editingTask ? t('tasks.edit_task', 'Edit Task') : t('tasks.add_new', 'Add Task')}</Text>

                        {isKeyboardVisible ? (
                          <TouchableOpacity onPress={() => Keyboard.dismiss()} style={styles.headerActionBtn} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }} pointerEvents="none">
                              <KeyboardIcon size={22} color={Colors.primary} pointerEvents="none" />
                              <ChevronDown size={14} color={Colors.primary} pointerEvents="none" />
                            </View>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            onPress={handleSaveTask}
                            style={styles.headerSaveBtn}
                            hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                          >
                            <Text style={styles.headerSaveText} pointerEvents="none">{t('common.save', 'Save')}</Text>
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
                        placeholder={t('tasks.placeholder', 'Todo')}
                        value={newTitle}
                        onChangeText={setNewTitle}
                        returnKeyType="done"
                        autoCapitalize="none"
                        onSubmitEditing={() => Keyboard.dismiss()}
                      />

                      {/* Color Selection Row */}
                      <TouchableOpacity style={styles.timeTreeRow} onPress={() => { Keyboard.dismiss(); setPendingColor(selectedColor); setShowColorPicker(true); }}>
                        <View style={styles.rowLead}>
                          <View style={[styles.colorIndicator, { backgroundColor: selectedColor, marginRight: 12 }]} />
                          <Text style={styles.timeTreeRowText}>
                            {(() => {
                              const label = TASK_COLOR_LABELS.find(l => l.color === selectedColor);
                              return label ? t(`tasks.colors.${label.key}`, label.name) : t('tasks.selectLabel', '라벨 선택');
                            })()}
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
                          <TouchableOpacity onPress={() => { Keyboard.dismiss(); pickerBackupRef.current = { taskDate: new Date(taskDate), endDate: new Date(endDate), newTime, endTime }; setShowDatePicker(true); }}>
                            <Text style={styles.timeTreePickerText}>{formatDisplayDate(taskDate)}</Text>
                          </TouchableOpacity>
                          {!isAllDay && (
                            <TouchableOpacity style={styles.timeLabelSmall} onPress={() => { Keyboard.dismiss(); pickerBackupRef.current = { taskDate: new Date(taskDate), endDate: new Date(endDate), newTime, endTime }; setShowTimePicker(true); }}>
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
                          <TouchableOpacity onPress={() => { Keyboard.dismiss(); pickerBackupRef.current = { taskDate: new Date(taskDate), endDate: new Date(endDate), newTime, endTime }; setShowEndDatePicker(true); }}>
                            <Text style={styles.timeTreePickerText}>{formatDisplayDate(endDate)}</Text>
                          </TouchableOpacity>
                          {!isAllDay && (
                            <TouchableOpacity style={styles.timeLabelSmall} onPress={() => { Keyboard.dismiss(); pickerBackupRef.current = { taskDate: new Date(taskDate), endDate: new Date(endDate), newTime, endTime }; setShowEndTimePicker(true); }}>
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
                            autoCapitalize="none"
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
                {/* 헤더: 프리뷰 + 선택 버튼 */}
                <View style={[styles.searchHeader, { alignItems: 'flex-start', flexDirection: 'column', gap: 12 }]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: Colors.text }}>{t('tasks.select_color', '라벨 선택')}</Text>
                    <TouchableOpacity
                      onPress={() => { setSelectedColor(pendingColor); setShowColorPicker(false); }}
                      style={{ paddingHorizontal: 16, paddingVertical: 7, backgroundColor: Colors.primary, borderRadius: 20 }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '800', color: 'white' }}>{t('common.select', 'Select')}</Text>
                    </TouchableOpacity>
                  </View>
                  {/* 컬러 프리뷰 샘플 */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 12, width: '100%' }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: pendingColor, shadowColor: pendingColor, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 6, elevation: 4 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: Colors.textSecondary, marginBottom: 4 }}>
                        {(() => {
                          const label = TASK_COLOR_LABELS.find(l => l.color === pendingColor);
                          return label ? t(`tasks.colors.${label.key}`, label.name) : t('tasks.label', '라벨');
                        })()}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: pendingColor, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 5, alignSelf: 'flex-start' }}>
                        <Text style={{ fontSize: 13, fontWeight: '700', color: 'white' }}>{t('tasks.sample_task', 'Task Sample')}</Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* 컬러 그리드 — 그룹 없이 순서대로 */}
                <ScrollView
                  style={{ flex: 1 }}
                  keyboardShouldPersistTaps="handled"
                  contentContainerStyle={{ paddingVertical: 8 }}
                >
                  <View style={styles.colorGrid}>
                    {TASK_COLOR_LABELS.map((item, idx) => {
                      const isPending = pendingColor === item.color;
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            styles.colorGridCell,
                            isPending && { borderColor: item.color, borderWidth: 2, backgroundColor: item.color + '18' }
                          ]}
                          onPress={() => {
                            if (isPending) {
                              // 이미 선택된 색 재탭 → 확정 후 닫기
                              setSelectedColor(item.color);
                              setShowColorPicker(false);
                            } else {
                              setPendingColor(item.color);
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={[
                            styles.colorSwatch,
                            { backgroundColor: item.color },
                            item.color.toUpperCase() === '#EBEBEB' || item.color.toUpperCase() === '#F4EFE6' ||
                              item.color.toUpperCase() === '#FEF9DB' || item.color.toUpperCase() === '#F0E7D6'
                              ? { borderWidth: 1, borderColor: '#E2E8F0' } : {}
                          ]}>
                            {isPending && (
                              <View style={styles.colorCheckOverlay}>
                                <CheckCircle2 size={16} color="white" strokeWidth={3} />
                              </View>
                            )}
                          </View>
                          <Text
                            style={[
                              styles.colorCellName,
                              isPending && { color: item.color === '#EBEBEB' || item.color === '#FEF9DB' ? Colors.primary : item.color, fontWeight: '800' }
                            ]}
                            numberOfLines={1}
                          >
                            {t(`tasks.colors.${item.key}`, item.name)}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            )}

            {searchMode && (
              <View style={styles.innerSearchOverlay}>
                <View style={styles.searchHeader}>
                  <Search size={20} color={Colors.outline} />
                  <TextInput style={styles.innerSearchPath} placeholder={t('search.placeholder')} autoFocus autoCapitalize="none" value={searchQuery} onChangeText={handleSearch} />
                  <TouchableOpacity
                    onPress={() => setSearchMode(null)}
                    hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                  >
                    <X size={24} color={Colors.text} pointerEvents="none" />
                  </TouchableOpacity>
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
                <View style={[styles.iosPickerCard, (showDatePicker || showEndDatePicker) && { height: 490 }]}>
                  {/* 핸들바 */}
                  <View style={{ width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginTop: 8, marginBottom: 4 }} />
                  <View style={styles.iosPickerHeader}>
                    <TouchableOpacity onPress={cancelPickers} style={{ padding: 4 }}>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: Colors.textSecondary }}>
                        {t('common.cancel', '취소')}
                      </Text>
                    </TouchableOpacity>
                    <Text style={styles.iosPickerTitle}>
                      {(showDatePicker || showEndDatePicker) ? t('tasks.date', '날짜') : t('tasks.time', '시간')}
                    </Text>
                    <TouchableOpacity onPress={closeAllPickers} style={{ padding: 4 }}>
                      <Text style={[styles.iosPickerDone, { color: Colors.primary }]}>{t('common.done', '완료')}</Text>
                    </TouchableOpacity>
                  </View>
                  {(showDatePicker || showEndDatePicker) ? (
                    <DateTimePicker
                      value={(() => {
                        try {
                          if (showDatePicker) return taskDate instanceof Date ? taskDate : new Date(taskDate);
                          if (showEndDatePicker) return endDate instanceof Date ? endDate : new Date(endDate);
                        } catch (e) { return new Date(); }
                        return new Date();
                      })()}
                      mode="date"
                      display="inline"
                      accentColor={Colors.primary}
                      onChange={(event, date) => {
                        if (showDatePicker) onDateChange(event, date);
                        else if (showEndDatePicker) onEndDateChange(event, date);
                      }}
                      style={{ width: width - 32, height: 360, alignSelf: 'center' }}
                    />
                  ) : (
                    <View style={{ height: 216, justifyContent: 'center', backgroundColor: 'white' }}>
                      <DateTimePicker
                        value={(() => {
                          try {
                            if (showTimePicker) {
                              const [h, m] = newTime.split(':').map(Number);
                              const d = new Date(taskDate); d.setHours(h); d.setMinutes(m); return d;
                            }
                            if (showEndTimePicker) {
                              const [h, m] = endTime.split(':').map(Number);
                              const d = new Date(endDate); d.setHours(h); d.setMinutes(m); return d;
                            }
                          } catch (e) { return new Date(); }
                          return new Date();
                        })()}
                        mode="time"
                        display="spinner"
                        is24Hour={true}
                        textColor="black"
                        onChange={(event, date) => {
                          if (showTimePicker) onTimeChange(event, date);
                          else if (showEndTimePicker) onEndTimeChange(event, date);
                        }}
                        style={{ height: 216, width: width - 32, alignSelf: 'center' }}
                      />
                    </View>
                  )}
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
                      <TouchableOpacity onPress={() => Keyboard.dismiss()} style={styles.headerActionBtn} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }} pointerEvents="none">
                          <KeyboardIcon size={22} color={Colors.primary} pointerEvents="none" />
                          <ChevronDown size={14} color={Colors.primary} pointerEvents="none" />
                        </View>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={closeHolidayModal}
                        style={styles.headerSaveBtn}
                        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
                      >
                        <Text style={styles.headerSaveText} numberOfLines={1} pointerEvents="none">{t('common.close', '닫기')}</Text>
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
                  autoCapitalize="none"
                />
                {countrySearch.length > 0 && (
                  <TouchableOpacity onPress={() => setCountrySearch('')}>
                    <X size={16} color={Colors.outline} pointerEvents="none" />
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
                    ListHeaderComponent={<Text style={styles.sectionSmallTitle}>{t('tasks.search_results', 'Search Results')}</Text>}
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
                    ListHeaderComponent={<Text style={styles.sectionSmallTitle}>{t('tasks.selected_countries', 'Selected Countries')}</Text>}
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

        </Modal>

        <MenuModal
          visible={menuVisible}
          onClose={() => setMenuVisible(false)}
          onReset={() => loadData()}
        />

      </View>
      <Pressable
        style={({ pressed }) => [
          styles.fabCircle,
          {
            position: 'absolute',
            bottom: Math.max(insets.bottom, 20) + 10 + 64 + 16,
            right: 30,
            zIndex: 999999,
            opacity: pressed ? 0.7 : 1,
          }
        ]}
        onPress={() => {
          console.log('[FAB] Press detected');
          openAddModal();
        }}
        hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
      >
        <Plus size={32} color="white" strokeWidth={3} pointerEvents="none" />
      </Pressable>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: 'white', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingBottom: Spacing.xl, elevation: 4, zIndex: 10 },
  monthHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 0 },
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
  labelItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  labelMark: { width: 6, height: 20, borderRadius: 3, marginRight: 16 },
  labelName: { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.textSecondary },

  // 컬러 그리드 스타일
  colorGroupLabel: { fontSize: 11, fontWeight: '700', color: Colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10, marginTop: 4, paddingHorizontal: 2 },
  colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  colorGridCell: { width: '22%', alignItems: 'center', borderRadius: 14, paddingVertical: 10, paddingHorizontal: 4, borderWidth: 1.5, borderColor: 'transparent', backgroundColor: '#F8FAFC' },
  colorSwatch: { width: 40, height: 40, borderRadius: 20, marginBottom: 6, justifyContent: 'center', alignItems: 'center' },
  colorCheckOverlay: { position: 'absolute', justifyContent: 'center', alignItems: 'center', width: '100%', height: '100%', borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.15)' },
  colorCellName: { fontSize: 10, fontWeight: '600', color: Colors.textSecondary, textAlign: 'center' },

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
    width: '100%',
    backgroundColor: 'white',
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

  modalBg: { flex: 1, justifyContent: 'flex-end', backgroundColor: Platform.OS === 'ios' ? 'transparent' : 'rgba(0,0,0,0.5)' },
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
  iosPickerOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', zIndex: 1000 },
  iosPickerCard: { backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 16, paddingBottom: 40, height: 320 },
  iosPickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.surfaceContainer, width: '100%' },
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
    minWidth: 200,
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
  modalAdWrapper: {
    marginVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: 10,
    width: width - 32,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    overflow: 'hidden',
  },
  modalFooter: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16, // Respect safe area
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  sheetAddBtn: {
    backgroundColor: '#1B254B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
  },
  sheetAddBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default TasksScreen;
