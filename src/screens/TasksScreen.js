import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions,
  Alert, Modal, TextInput, ActivityIndicator, Animated, Platform, FlatList,
  Keyboard, Switch
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import {
  Plus, MapPin, Clock, Calendar, ChevronLeft, ChevronRight,
  CheckCircle2, Circle, Search, X, Sun, CloudRain, Cloud,
  CloudSnow, Moon, CheckSquare, Square, Trash2, CalendarDays, Compass,
  Pencil, AlignLeft
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
      // Holidays first
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
              isSelected && { backgroundColor: '#F1F5F9' }
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
              {dayTasks.length <= 4 ? (
                [0, 1, 2, 3].map(slotIdx => {
                  const taskInSlot = dayTasks.find(t => taskSlots[t.id] === slotIdx);
                  if (!taskInSlot) return <View key={slotIdx} style={styles.emptySlotRow} />;
                  const isStart = ds === taskInSlot.date;
                  const isEnd = ds === (taskInSlot.endDate || taskInSlot.date);
                  const col = taskInSlot.color || TASK_COLORS[(tasks || []).findIndex(gt => gt.id === taskInSlot.id) % TASK_COLORS.length];
                  const opacity = taskInSlot.isCompleted ? '40' : (day.current ? 'CC' : '30');
                  return (
                    <View key={slotIdx} style={[styles.calendarTaskBar, { backgroundColor: col + opacity }, isStart && styles.barStart, isEnd && styles.barEnd, !isStart && !isEnd && styles.barMiddle]}>
                      {(isStart || (i % 7 === 0)) && <Text style={[styles.calendarBarText, !day.current && { color: 'rgba(255,255,255,0.7)' }]} numberOfLines={1}>{taskInSlot.title}</Text>}
                    </View>
                  );
                })
              ) : (
                <>
                  {[0, 1, 2].map(slotIdx => {
                    const taskInSlot = dayTasks.find(t => taskSlots[t.id] === slotIdx);
                    if (!taskInSlot) return <View key={slotIdx} style={styles.emptySlotRow} />;
                    const isStart = ds === taskInSlot.date;
                    const isEnd = ds === (taskInSlot.endDate || taskInSlot.date);
                    const col = taskInSlot.color || TASK_COLORS[(tasks || []).findIndex(gt => gt.id === taskInSlot.id) % TASK_COLORS.length];
                    const opacity = taskInSlot.isCompleted ? '40' : (day.current ? 'CC' : '30');
                    return (
                      <View key={slotIdx} style={[styles.calendarTaskBar, { backgroundColor: col + opacity }, isStart && styles.barStart, isEnd && styles.barEnd, !isStart && !isEnd && styles.barMiddle]}>
                        {(isStart || (i % 7 === 0)) && <Text style={[styles.calendarBarText, !day.current && { color: 'rgba(255,255,255,0.7)' }]} numberOfLines={1}>{taskInSlot.title}</Text>}
                      </View>
                    );
                  })}
                  <View style={styles.moreTasksRow}>
                    <Text style={[styles.moreTasksText, !day.current && { opacity: 0.5 }]}>+{dayTasks.length - 3}</Text>
                  </View>
                </>
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

const TasksScreen = ({ navigation }) => {
  const { t, i18n } = useTranslation();
  const isKorean = i18n.language === 'ko';

  // State
  const [tasks, setTasks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month'); // 기본값 'month'로 변경
  const [menuVisible, setMenuVisible] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [isTaskListVisible, setIsTaskListVisible] = useState(false);
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

  const [editingTask, setEditingTask] = useState(null);
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

  useEffect(() => {
    loadData();
    loadPreferences();
    loadHolidays();
  }, []);

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
    // Fetch for current, previous and next year to ensure smooth transitions
    const h1 = getHolidaysForYear(year - 1, holidayCountries);
    const h2 = getHolidaysForYear(year, holidayCountries);
    const h3 = getHolidaysForYear(year + 1, holidayCountries);
    setHolidaysMap({ ...h1, ...h2, ...h3 });
  }, [holidayCountries, selectedDate.getFullYear()]);

  const loadPreferences = async () => {
    try {
      const savedMode = await AsyncStorage.getItem('@task_view_mode');
      if (savedMode) {
        setViewMode(savedMode);
      }
    } catch (e) {
      console.log('[Tasks] View mode loaded:', savedMode);
    }
  };

  const toggleViewMode = async () => {
    const nextMode = viewMode === 'week' ? 'month' : 'week';
    setViewMode(nextMode);
    try {
      await AsyncStorage.setItem('@task_view_mode', nextMode);
    } catch (e) {
      console.error('[Tasks] Save mode failed:', e);
    }
  };

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
  const weekDays = useMemo(() => {
    const start = new Date(selectedDate);
    const day = selectedDate.getDay();
    const diff = selectedDate.getDate() - day; // Start from Sunday
    start.setDate(diff);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [selectedDate]);

  const monthGridData = useMemo(() => {
    // We only need a few months for performance if we use FlatList properly, 
    // but for simplicity we'll pass the range indices
    return Array.from({ length: CALENDAR_MONTH_RANGE }, (_, i) => i);
  }, []);

  // Sync scroll position when selectedDate changes (e.g. from Picker)
  useEffect(() => {
    if (viewMode === 'month' && !isScrollingRef.current) {
      const index = getMonthIndex(selectedDate);
      calendarListRef.current?.scrollToIndex({ index, animated: false });
    }
  }, [selectedDate.getFullYear(), selectedDate.getMonth(), viewMode]);

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

  const onTimeChange = (event, date) => {
    if (Platform.OS === 'android') setShowTimePicker(false);
    if (date) {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      setNewTime(`${hours}:${minutes}`);
    }
  };

  const onEndDateChange = (event, date) => {
    if (Platform.OS === 'android') setShowEndDatePicker(false);
    if (date) setEndDate(date);
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

    const taskData = {
      title: newTitle,
      date: dateStr(taskDate),
      time: isAllDay ? null : newTime,
      endDate: dateStr(endDate),
      endTime: isAllDay ? null : endTime,
      isAllDay,
      memo: newMemo,
      color: selectedColor,
      locationName: newLocName,
      weatherRegion: newWeatherRegion,
    };

    let updated;
    if (editingTask) {
      updated = await updateTask(editingTask.id, taskData);
    } else {
      updated = await addTask(taskData);
    }

    setTasks(updated);
    fetchTasksWeather(updated);
    setIsAdding(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const formatDisplayDate = (date) => {
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  };

  const handleToggle = async (id) => {
    const updated = await toggleTaskCompletion(id);
    setTasks(updated);
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
      setIsTaskListVisible(true);
    } else {
      setSelectedDate(date);
      setTaskDate(date);
    }
  }, []);

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

  return (
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
              style={styles.viewToggleBtn}
              onPress={toggleViewMode}
            >
              <Text style={styles.viewToggleText}>{viewMode === 'week' ? 'Month View' : 'Week View'}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.taskCountText}>{(tasks || []).filter(t => !t.isCompleted).length} tasks scheduled this month</Text>
          <TouchableOpacity 
            style={styles.holidaySettingsBtn}
            onPress={() => setShowHolidaySettings(true)}
          >
            <MapPin size={12} color={Colors.primary} />
            <Text style={styles.holidaySettingsText}>
              Holidays: {holidayCountries.join(', ')}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.calendarArea}>
          <View style={styles.weekdayLabels}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <Text key={d} style={styles.weekdayText}>{d}</Text>
            ))}
          </View>

          {viewMode === 'week' ? (
            <View style={styles.weekStrip}>
              {weekDays.map((day, idx) => {
                const active = isSameDay(day, selectedDate);
                const ds = dateStr(day);
                const dayTasks = (tasks || []).filter(t => ds >= t.date && ds <= (t.endDate || t.date)).slice(0, 3);

                return (
                  <TouchableOpacity key={idx} style={[styles.dayCell, active && styles.activeCell]} onPress={() => setSelectedDate(day)}>
                    <Text style={[styles.dayNum, active && styles.activeText]}>{day.getDate()}</Text>
                    <View style={styles.dotContainer}>
                      {dayTasks.map((t, i) => (
                        <View key={i} style={[styles.taskDot, { backgroundColor: TASK_COLORS[i % TASK_COLORS.length] }]} />
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <FlatList
              ref={calendarListRef}
              data={monthGridData}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              keyExtractor={item => item.toString()}
              initialScrollIndex={getMonthIndex(selectedDate)}
              getItemLayout={(_, index) => ({
                length: width - Spacing.lg * 2,
                offset: (width - Spacing.lg * 2) * index,
                index,
              })}
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
          )}
        </View>
      </ScrollView>

      {/* Task List Bottom Sheet Modal */}
      <Modal
        visible={isTaskListVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsTaskListVisible(false)}
      >
        <View style={styles.sheetBg}>
          <TouchableOpacity 
            style={styles.sheetCloser} 
            activeOpacity={1} 
            onPress={() => setIsTaskListVisible(false)} 
          />
          <View style={styles.sheetContent}>
            <View style={styles.sheetHeader}>
              <View style={styles.sheetKnob} />
              <View style={styles.sheetTitleArea}>
                <Text style={styles.sheetDateTitle}>{selectedDate.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
                <Text style={styles.sheetSubtitle}>Scheduled Tasks</Text>
              </View>
              <TouchableOpacity onPress={() => setIsTaskListVisible(false)} style={styles.sheetCloseBtn}>
                <X size={20} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.sheetList} 
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 10 }}
            >
              {(filteredTasks || []).length === 0 && !isPublicHoliday(dateStr(selectedDate), holidaysMap) ? (
                <View style={styles.emptyState}>
                  <CalendarDays size={48} color={Colors.outlineVariant} strokeWidth={1} style={{ marginBottom: Spacing.md }} />
                  <Text style={styles.emptyText}>{t('tasks.empty', 'No tasks scheduled.')}</Text>
                </View>
              ) : (
                <View style={styles.taskList}>
                  {/* Public Holidays Section */}
                  {isPublicHoliday(dateStr(selectedDate), holidaysMap) && (
                    <View style={styles.holidaySection}>
                      {holidaysMap[dateStr(selectedDate)].map((h, idx) => (
                        <View key={idx} style={styles.holidayBadge}>
                          <Text style={styles.holidayNameText}>[{h.country}] {h.name}</Text>
                          <Text style={styles.holidayTypeText}>Public Holiday</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {(filteredTasks || []).map((task) => {
                    const weather = taskWeather[task.id];
                    const taskCol = task.color || TASK_COLORS[tasks.findIndex(gt => gt.id === task.id) % TASK_COLORS.length];
                    return (
                      <View key={task.id} style={[styles.taskCard, task.isCompleted && styles.completedTask]}>
                        <TouchableOpacity onPress={() => handleToggle(task.id)} style={styles.checkArea}>
                          {task.isCompleted ? <CheckSquare size={24} color={taskCol} strokeWidth={2} /> : <Square size={24} color={taskCol + '80'} strokeWidth={2} />}
                        </TouchableOpacity>
                        <View style={styles.taskInfo}>
                          <Text style={[styles.taskTitle, task.isCompleted && styles.taskTitleCompleted]}>{task.title}</Text>
                          <View style={styles.taskMeta}>
                            <Clock size={14} color={Colors.textSecondary} style={{ marginRight: 4 }} />
                            <Text style={styles.metaText}>{task.time || 'All Day'}</Text>
                          </View>
                        </View>
                        {weather && !task.isCompleted && (
                          <View style={styles.weatherBadge}>
                            {renderWeatherIcon(weather.condKey)}
                            <Text style={styles.weatherTemp}>{weather.temp}</Text>
                          </View>
                        )}
                        <TouchableOpacity style={styles.itemActionBtn} onPress={() => { setIsTaskListVisible(false); handleEditTask(task); }}>
                          <Pencil size={18} color={Colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.trashBtn} onPress={() => handleDelete(task.id)}>
                          <Trash2 size={18} color={Colors.outlineVariant} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            <TouchableOpacity 
              style={styles.sheetAddBtn} 
              onPress={() => {
                setIsTaskListVisible(false);
                openAddModal();
              }}
            >
              <Plus size={20} color="white" strokeWidth={3} />
              <Text style={styles.sheetAddBtnText}>Add New Task</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <TouchableOpacity 
        style={[
          styles.fab, 
          { bottom: Math.max(insets.bottom, 20) + 10 + 64 + 16 } // TabBar height(64) + spacing(10) + extra(16)
        ]} 
        onPress={openAddModal}
      >
        <Plus size={32} color="white" strokeWidth={3} />
      </TouchableOpacity>

      {/* Wheel Picker Modal */}
      <Modal visible={isPickerVisible} transparent animationType="fade" onRequestClose={() => setIsPickerVisible(false)}>
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
      </Modal>

      {/* Add Task Modal */}
      <Modal
        visible={isAdding}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAdding(false)}
        onShow={() => {
          modalScrollRef.current?.scrollTo({ y: 0, animated: false });
          setTimeout(() => titleInputRef.current?.focus(), 150);
        }}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingTask ? t('tasks.edit_task', 'Edit Task') : t('tasks.add_new', 'Add Task')}</Text>
              <TouchableOpacity onPress={() => { Keyboard.dismiss(); setIsAdding(false); }}><X size={24} color={Colors.text} /></TouchableOpacity>
            </View>
            <ScrollView
              ref={modalScrollRef}
              style={styles.modalForm}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 40 }}
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
                <TouchableOpacity onPress={() => setSearchMode('location')}>
                  <Search size={20} color={Colors.primary} />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.timeTreeRow} onPress={() => setSearchMode('weather')}>
                <View style={styles.rowLead}>
                  <Sun size={22} color={newWeatherRegion ? Colors.primary : Colors.textSecondary} />
                  <Text style={[styles.timeTreeValue, !newWeatherRegion && { color: Colors.outline }]}>
                    {newWeatherRegion ? newWeatherRegion.name : t('tasks.weather_loc', 'Weather Region')}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Memo */}
              <View style={[styles.timeTreeRow, { alignItems: 'flex-start', marginTop: 12 }]}>
                <View style={[styles.rowLead, { paddingTop: 4 }]}>
                  <AlignLeft size={22} color={Colors.textSecondary} />
                </View>
                <TextInput
                  style={styles.timeTreeMemo}
                  placeholder={t('tasks.memo_placeholder', 'Memo')}
                  value={newMemo}
                  onChangeText={setNewMemo}
                  multiline
                />
              </View>

            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.modalCancelBtn} 
                onPress={() => { Keyboard.dismiss(); setIsAdding(false); }}
              >
                <Text style={styles.cancelBtnText}>{t('common.cancel', 'Cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveTask}>
                <Text style={styles.saveBtnText}>
                  {editingTask ? t('common.done', 'Done') : t('common.save', 'Save')}
                </Text>
              </TouchableOpacity>
            </View>
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
              {showDatePicker && <DateTimePicker value={taskDate} mode="date" display="default" onChange={onDateChange} />}
              {showTimePicker && <DateTimePicker value={(() => { const [h, m] = newTime.split(':').map(Number); const d = new Date(taskDate); d.setHours(h); d.setMinutes(m); return d; })()} mode="time" is24Hour={true} display="default" onChange={onTimeChange} />}
              {showEndDatePicker && <DateTimePicker value={endDate} mode="date" display="default" onChange={onEndDateChange} />}
              {showEndTimePicker && <DateTimePicker value={(() => { const [h, m] = endTime.split(':').map(Number); const d = new Date(endDate); d.setHours(h); d.setMinutes(m); return d; })()} mode="time" is24Hour={true} display="default" onChange={onEndTimeChange} />}
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
                <DateTimePicker
                  value={(() => {
                    if (showDatePicker) return taskDate;
                    if (showEndDatePicker) return endDate;
                    if (showTimePicker) {
                      const [h, m] = newTime.split(':').map(Number);
                      const d = new Date(taskDate); d.setHours(h); d.setMinutes(m); return d;
                    }
                    if (showEndTimePicker) {
                      const [h, m] = endTime.split(':').map(Number);
                      const d = new Date(endDate); d.setHours(h); d.setMinutes(m); return d;
                    }
                    return new Date();
                  })()}
                  mode={(showDatePicker || showEndDatePicker) ? "date" : "time"}
                  display="spinner"
                  is24Hour={true}
                  onChange={(e, d) => {
                    if (showDatePicker) onDateChange(e, d);
                    else if (showEndDatePicker) onEndDateChange(e, d);
                    else if (showTimePicker) onTimeChange(e, d);
                    else if (showEndTimePicker) onEndTimeChange(e, d);
                  }}
                />
              </View>
            </View>
          )}
        </View>
      </Modal>

      <Modal
        visible={showHolidaySettings}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { setShowHolidaySettings(false); setCountrySearch(''); }}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t('tasks.holiday_settings', 'Holiday Settings')}</Text>
                <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 2 }}>{t('tasks.holiday_guide', 'Select countries to show public holidays')}</Text>
              </View>
              <TouchableOpacity onPress={() => { setShowHolidaySettings(false); setCountrySearch(''); }}>
                <X size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBox, { marginTop: 16, marginHorizontal: 0 }]}>
              <Search size={18} color={Colors.outline} style={{ marginRight: 8 }} />
              <TextInput 
                style={styles.searchField} 
                placeholder="Search country (e.g. Korea, United States)" 
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
                <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                  <Text style={styles.sectionSmallTitle}>Search Results</Text>
                  {processedCountries
                    .filter(c => 
                      c.ename.toLowerCase().includes(countrySearch.toLowerCase()) || 
                      c.code.toLowerCase().includes(countrySearch.toLowerCase()) ||
                      (c.kname && c.kname.includes(countrySearch))
                    )
                    .slice(0, 15)
                    .map((c, idx) => (
                      <TouchableOpacity 
                        key={idx} 
                        style={styles.countryResultItem}
                        onPress={() => {
                          if (!holidayCountries.includes(c.code)) {
                            const next = [...holidayCountries, c.code];
                            setHolidayCountries(next);
                            saveCountries(next);
                          }
                          setCountrySearch('');
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.countryResultName}>{c.displayPrimary}</Text>
                          {c.displaySecondary ? <Text style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 2 }}>{c.displaySecondary}</Text> : null}
                        </View>
                        <Text style={styles.countryResultCode}>{c.code}</Text>
                        {holidayCountries.includes(c.code) && <CheckCircle2 size={18} color={Colors.primary} />}
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              ) : (
                <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                  <Text style={styles.sectionSmallTitle}>Selected Countries</Text>
                  {holidayCountries.map((code, idx) => {
                    const country = processedCountries.find(c => c.code === code);
                    return (
                      <View key={idx} style={styles.selectedCountryItem}>
                        <View>
                          <Text style={styles.selectedCountryName}>{country?.displayPrimary || code}</Text>
                          <Text style={styles.selectedCountryCode}>{country?.displaySecondary || country?.name || code} ({code})</Text>
                        </View>
                        <TouchableOpacity 
                          style={styles.countryRemoveBtn}
                          onPress={() => {
                            const next = holidayCountries.filter(c => c !== code);
                            setHolidayCountries(next);
                            saveCountries(next);
                          }}
                        >
                          <Trash2 size={18} color={Colors.error} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>

            <View style={[styles.modalFooter, { paddingHorizontal: 0 }]}>
              <TouchableOpacity 
                style={[styles.modalSaveBtn, { flex: 1 }]} 
                onPress={() => { setShowHolidaySettings(false); setCountrySearch(''); }}
              >
                <Text style={styles.saveBtnText}>{t('common.close', 'Close')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <MenuModal 
        visible={menuVisible} 
        onClose={() => setMenuVisible(false)} 
        onReset={() => loadData()} 
      />
    </View>
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
  taskCountText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', marginBottom: Spacing.md },
  calendarArea: { paddingHorizontal: 0 },
  weekdayLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 0 },
  weekdayText: { width: (width - Spacing.lg * 2) / 7, textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.outlineVariant, textTransform: 'uppercase' },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  dayCell: { width: (width - Spacing.lg * 2 - 20) / 7, height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  dayCellMonth: { width: (width - Spacing.lg * 2) / 7, height: 95, borderRadius: 8, marginBottom: 4, overflow: 'hidden' },
  dayCellTop: { paddingVertical: 4, alignItems: 'center', height: 32, zIndex: 10 },
  dayNumContainer: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  todayCircle: { backgroundColor: Colors.text },
  todayText: { color: 'white' },
  dayNum: { fontSize: 13, fontWeight: '700', color: Colors.text },

  calendarSlotContainer: { flex: 1, paddingHorizontal: 1, gap: 1 },
  emptySlotRow: { height: 13 },
  calendarTaskBar: { height: 13, justifyContent: 'center', paddingHorizontal: 4 },
  barStart: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4, marginLeft: 2 },
  barEnd: { borderTopRightRadius: 4, borderBottomRightRadius: 4, marginRight: 2 },
  barMiddle: { marginHorizontal: 0 },
  calendarBarText: { fontSize: 9, fontWeight: '700', color: 'white' },
  moreTasksRow: { height: 13, justifyContent: 'center', alignItems: 'center', marginTop: 1 },
  moreTasksText: { fontSize: 9, fontWeight: '800', color: Colors.textSecondary },

  scrollContent: { padding: Spacing.lg, paddingBottom: 180 },
  sectionHeader: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  sectionSubtitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginTop: 2 },
  taskList: { gap: Spacing.sm },
  taskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 20, elevation: 1, shadowColor: Colors.shadow, shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  completedTask: { opacity: 0.5 },
  checkArea: { marginRight: 12 },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 4 },
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
  fab: { position: 'absolute', bottom: 100, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center', elevation: 10, zIndex: 999 },

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
  todayBtn: { flex: 1, height: 52, borderRadius: 16, borderColor: '#1B254B', borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  todayBtnText: { fontSize: 15, fontWeight: '700', color: '#1B254B' },
  confirmBtn: { flex: 1.5, height: 52, borderRadius: 16, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center' },
  confirmBtnText: { fontSize: 15, fontWeight: '700', color: 'white' },

  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: height * 0.9, padding: Spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text },
  modalForm: { flex: 1 },

  // TimeTree Style
  timeTreeTitle: { fontSize: 26, fontWeight: '800', color: Colors.text, paddingVertical: 12, borderBottomWidth: 1.5, borderBottomColor: '#F1F5F9', marginBottom: 12 },
  timeTreeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14 },
  rowLead: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowTail: { flexDirection: 'row', alignItems: 'center' },
  timeTreeRowText: { fontSize: 16, fontWeight: '700', color: Colors.text, marginLeft: 12 },
  timeTreeLabel: { fontSize: 15, fontWeight: '700', color: Colors.textSecondary, marginLeft: 12, width: 42 },
  timeTreeValue: { fontSize: 16, fontWeight: '600', color: Colors.text, marginLeft: 12 },
  timeTreePickerText: { fontSize: 15, fontWeight: '700', color: Colors.primary, backgroundColor: Colors.primary + '10', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  timeTreeTimeText: { fontSize: 15, fontWeight: '700', color: Colors.primary },
  timeLabelSmall: { backgroundColor: Colors.primary + '10', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginLeft: 8 },
  timeTreeDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 4 },
  timeTreeInput: { flex: 1, fontSize: 16, fontWeight: '600', color: Colors.text, marginLeft: 10, paddingVertical: 4 },
  timeTreeMemo: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text, marginLeft: 12, minHeight: 120, textAlignVertical: 'top', paddingTop: 4 },
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
    borderRadius: 18, 
    backgroundColor: '#F4F7FE', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  modalSaveBtn: { 
    flex: 2, 
    height: 56, 
    borderRadius: 18, 
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
  iosPickerCard: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 20 },
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
  holidaySettingsBtn: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 6, backgroundColor: Colors.primary + '10', borderRadius: 10, marginBottom: 8 },
  holidaySettingsText: { fontSize: 11, fontWeight: '700', color: Colors.primary, marginLeft: 6 },
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
});

export default TasksScreen;
