import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as Haptics from 'expo-haptics';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions, 
  Alert, Modal, TextInput, ActivityIndicator, Animated, Platform, FlatList 
} from 'react-native';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { 
  Plus, MapPin, Clock, Calendar, ChevronLeft, ChevronRight, 
  CheckCircle2, Circle, Search, X, Sun, CloudRain, Cloud, 
  CloudSnow, Moon, CheckSquare, Square, Trash2, CalendarDays, Compass
} from 'lucide-react-native';
import { Colors, Spacing, Typography } from '../theme';
import { getTasks, addTask, toggleTaskCompletion, deleteTask } from '../services/task/TaskService';
import { getWeather } from '../services/weather/WeatherService';
import { searchPlaces } from '../services/weather/VWorldService';
import { searchLocations } from '../services/weather/GlobalService';

const { width, height } = Dimensions.get('window');
const YEARS = Array.from({ length: 201 }, (_, i) => 1900 + i);
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const ITEM_HEIGHT = 50;

const TasksScreen = ({ navigation }) => {
  const { t } = useTranslation();
  
  // State
  const [tasks, setTasks] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('week'); // 'week' | 'month'
  const [isAdding, setIsAdding] = useState(false);
  const [isPickerVisible, setIsPickerVisible] = useState(false);
  const [taskWeather, setTaskWeather] = useState({});
  const [loading, setLoading] = useState(true);

  // Picker Temporary State
  const [tempYear, setTempYear] = useState(new Date().getFullYear());
  const [tempMonth, setTempMonth] = useState(new Date().getMonth());
  const lastTickYearIndex = useRef(-1);
  const lastTickMonthIndex = useRef(-1);
  const yearListRef = useRef(null);
  const monthListRef = useRef(null);

  // New Task State
  const [newTitle, setNewTitle] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [newLocName, setNewLocName] = useState('');
  const [newWeatherRegion, setNewWeatherRegion] = useState(null);

  // Search/Picker State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMode, setSearchMode] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

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
  const dateStr = (date) => date.toISOString().split('T')[0];
  const isSameDay = (d1, d2) => dateStr(d1) === dateStr(d2);

  const weekDays = useMemo(() => {
    const start = new Date(selectedDate);
    const day = selectedDate.getDay();
    const diff = selectedDate.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [selectedDate]);

  const monthDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const days = [];
    const startPadding = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; 
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startPadding - 1; i >= 0; i--) {
        days.push({ date: new Date(year, month - 1, prevMonthLastDay - i), current: false });
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
        days.push({ date: new Date(year, month, i), current: true });
    }
    const totalDays = 42;
    const nextPadding = totalDays - days.length;
    for (let i = 1; i <= nextPadding; i++) {
        days.push({ date: new Date(year, month + 1, i), current: false });
    }
    return days;
  }, [selectedDate]);

  const filteredTasks = useMemo(() => {
    const targetDate = dateStr(selectedDate);
    return tasks.filter(t => t.date === targetDate);
  }, [tasks, selectedDate]);

  // Open Picker
  const openPicker = () => {
    setTempYear(selectedDate.getFullYear());
    setTempMonth(selectedDate.getMonth());
    setIsPickerVisible(true);
  };

  const applyPicker = () => {
    const next = new Date(selectedDate);
    next.setFullYear(tempYear);
    next.setMonth(tempMonth);
    setSelectedDate(next);
    setIsPickerVisible(false);
  };

  const handleAddTask = async () => {
    if (!newTitle.trim()) {
      Alert.alert(t('common.info'), t('tasks.enter_title', '태스크 제목을 입력해주세요.'));
      return;
    }
    const taskData = {
      title: newTitle,
      date: dateStr(selectedDate),
      time: newTime,
      locationName: newLocName,
      weatherRegion: newWeatherRegion,
    };
    const updated = await addTask(taskData);
    setTasks(updated);
    fetchTasksWeather(updated);
    setNewTitle('');
    setNewLocName('');
    setNewWeatherRegion(null);
    setIsAdding(false);
  };

  const handleToggle = async (id) => {
    const updated = await toggleTaskCompletion(id);
    setTasks(updated);
  };

  const handleDelete = (id) => {
    Alert.alert(t('common.delete'), t('tasks.delete_confirm', '이 일정을 삭제할까요?'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: async () => {
        const updated = await deleteTask(id);
        setTasks(updated);
      }}
    ]);
  };

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
    <View style={styles.container}>
      {/* Calendar Header */}
      <View style={[styles.header, { paddingTop: Constants.statusBarHeight + Spacing.md }]}>
        <View style={styles.monthHeaderRow}>
          <TouchableOpacity style={styles.monthSelectBtn} onPress={openPicker}>
            <Text style={styles.monthText}>
              {selectedDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </Text>
            <Calendar size={20} color="#1B254B" style={{ marginLeft: 8 }} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.viewToggleBtn} 
            onPress={() => setViewMode(viewMode === 'week' ? 'month' : 'week')}
          >
             <Text style={styles.viewToggleText}>{viewMode === 'week' ? 'Month View' : 'Week View'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.taskCountText}>{(tasks || []).filter(t => !t.isCompleted).length} tasks scheduled this month</Text>

        <View style={styles.calendarArea}>
          <View style={styles.weekdayLabels}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <Text key={d} style={styles.weekdayText}>{d}</Text>
            ))}
          </View>

          {viewMode === 'week' ? (
            <View style={styles.weekStrip}>
              {weekDays.map((day, idx) => {
                const active = isSameDay(day, selectedDate);
                const hasTask = (tasks || []).some(t => t.date === dateStr(day));
                return (
                  <TouchableOpacity key={idx} style={[styles.dayCell, active && styles.activeCell]} onPress={() => setSelectedDate(day)}>
                    <Text style={[styles.dayNum, active && styles.activeText]}>{day.getDate()}</Text>
                    {hasTask && !active && <View style={styles.taskDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.monthGrid}>
              {monthDays.map((item, idx) => {
                const active = isSameDay(item.date, selectedDate);
                const hasTask = (tasks || []).some(t => t.date === dateStr(item.date));
                return (
                  <TouchableOpacity 
                    key={idx} 
                    style={[styles.dayCellMonth, active && styles.activeCell]} 
                    onPress={() => setSelectedDate(item.date)}
                  >
                    <Text style={[
                      styles.dayNum, 
                      active && styles.activeText, 
                      !item.current && { color: Colors.outlineVariant }
                    ]}>
                      {item.date.getDate()}
                    </Text>
                    {hasTask && !active && <View style={styles.taskDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.sectionHeader}>
           <Text style={styles.sectionTitle}>{selectedDate.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Text>
           <Text style={styles.sectionSubtitle}>Scheduled Tasks</Text>
        </View>

        {(filteredTasks || []).length === 0 ? (
          <View style={styles.emptyState}>
            <CalendarDays size={48} color={Colors.outlineVariant} strokeWidth={1} style={{ marginBottom: Spacing.md }} />
            <Text style={styles.emptyText}>{t('tasks.empty', 'No tasks scheduled.')}</Text>
          </View>
        ) : (
          <View style={styles.taskList}>
            {(filteredTasks || []).map((task) => {
              const weather = taskWeather[task.id];
              return (
                <View key={task.id} style={[styles.taskCard, task.isCompleted && styles.completedTask]}>
                  <TouchableOpacity onPress={() => handleToggle(task.id)} style={styles.checkArea}>
                    {task.isCompleted ? (
                      <CheckSquare size={24} color={Colors.primary} strokeWidth={2} />
                    ) : (
                      <Square size={24} color={Colors.outlineVariant} strokeWidth={2} />
                    )}
                  </TouchableOpacity>
                  <View style={styles.taskInfo}>
                    <Text style={[styles.taskTitle, task.isCompleted && styles.taskTitleCompleted]}>{task.title}</Text>
                    <View style={styles.taskMeta}>
                       <Clock size={14} color={Colors.textSecondary} style={{ marginRight: 4 }} />
                       <Text style={styles.metaText}>{task.time}</Text>
                       {task.locationName ? (
                         <>
                           <View style={styles.metaDivider} />
                           <MapPin size={14} color={Colors.textSecondary} style={{ marginRight: 4 }} />
                           <Text style={styles.metaText}>{task.locationName}</Text>
                         </>
                       ) : null}
                    </View>
                  </View>
                  {weather && !task.isCompleted && (
                    <View style={styles.weatherBadge}>
                       {renderWeatherIcon(weather.condKey)}
                       <Text style={styles.weatherTemp}>{weather.temp}</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.trashBtn} onPress={() => handleDelete(task.id)}>
                     <Trash2 size={18} color={Colors.outlineVariant} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={() => setIsAdding(true)}>
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
      <Modal visible={isAdding} animationType="slide" transparent={true} onRequestClose={() => setIsAdding(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
             <View style={styles.modalHeader}>
               <Text style={styles.modalTitle}>{t('tasks.add_new', 'Add Task')}</Text>
               <TouchableOpacity onPress={() => setIsAdding(false)}><X size={24} color={Colors.text} /></TouchableOpacity>
             </View>
             <ScrollView style={styles.modalForm} showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>{t('tasks.title', 'Title')}</Text>
                <TextInput style={styles.textInput} placeholder={t('tasks.placeholder', 'What needs to be done?')} value={newTitle} onChangeText={setNewTitle} autoFocus />
                <View style={styles.inputGrid}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>{t('tasks.time', 'Time')}</Text>
                    <TextInput style={styles.textInput} value={newTime} onChangeText={setNewTime} placeholder="09:00" />
                  </View>
                  <View style={{ width: Spacing.md }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>{t('tasks.date', 'Date')}</Text>
                    <View style={[styles.textInput, styles.disabledInput]}><Text style={{ color: Colors.textSecondary }}>{dateStr(selectedDate)}</Text></View>
                  </View>
                </View>
                <Text style={styles.inputLabel}>{t('tasks.location', 'Location')}</Text>
                <View style={styles.searchBox}>
                  <TextInput style={styles.searchField} placeholder={t('tasks.loc_placeholder', 'Optional: Cafe, Park...')} value={newLocName} onChangeText={setNewLocName} />
                  <TouchableOpacity onPress={() => setSearchMode('location')}><Search size={20} color={Colors.primary} /></TouchableOpacity>
                </View>
                <Text style={styles.inputLabel}>{t('tasks.weather_loc', 'Weather Region')}</Text>
                <TouchableOpacity style={styles.searchBox} onPress={() => setSearchMode('weather')}>
                   <Text style={[styles.searchField, !newWeatherRegion && { color: Colors.outline }]}>{newWeatherRegion ? newWeatherRegion.name : t('tasks.weather_placeholder', 'Optional: For accurate weather')}</Text>
                   <MapPin size={20} color={newWeatherRegion ? Colors.primary : Colors.outline} />
                </TouchableOpacity>
                {newWeatherRegion && (
                  <TouchableOpacity style={styles.clearRegionBtn} onPress={() => setNewWeatherRegion(null)}>
                    <Text style={styles.clearRegionText}>Clear Region</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.saveBtn} onPress={handleAddTask}>
                   <Text style={styles.saveBtnText}>{t('common.save', 'Save Task')}</Text>
                </TouchableOpacity>
             </ScrollView>
          </View>

          {searchMode && (
            <View style={styles.innerSearchOverlay}>
               <View style={styles.searchHeader}>
                 <Search size={20} color={Colors.outline} />
                 <TextInput style={styles.innerSearchPath} placeholder={t('search.placeholder')} autoFocus value={searchQuery} onChangeText={handleSearch} />
                 <TouchableOpacity onPress={() => setSearchMode(null)}><X size={24} color={Colors.text} /></TouchableOpacity>
               </View>
               <ScrollView style={{ flex: 1 }}>
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
        </View>
      </Modal>

      {/* Bottom Navigation */}
      <View style={styles.bottomNavContainer}>
        <View style={styles.glassNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Home')}>
            <Sun size={28} color={Colors.outline} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem}>
            <View style={styles.activeDot} />
            <CheckCircle2 size={28} color={Colors.primary} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Flow')}>
            <Compass size={28} color={Colors.outline} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: 'white', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingBottom: Spacing.xl, elevation: 4, zIndex: 10 },
  monthHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, marginBottom: 8 },
  monthSelectBtn: { flexDirection: 'row', alignItems: 'center' },
  monthText: { fontSize: 24, fontWeight: '800', color: '#1B254B' },
  viewToggleBtn: { padding: 8, backgroundColor: '#F4F7FE', borderRadius: 12 },
  viewToggleText: { fontSize: 12, fontWeight: '700', color: Colors.primary },
  taskCountText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
  calendarArea: { paddingHorizontal: Spacing.lg },
  weekdayLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  weekdayText: { width: (width - Spacing.lg * 2) / 7, textAlign: 'center', fontSize: 11, fontWeight: '700', color: Colors.outlineVariant, textTransform: 'uppercase' },
  weekStrip: { flexDirection: 'row', justifyContent: 'space-between' },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  dayCell: { width: (width - Spacing.lg * 2 - 20) / 7, height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  dayCellMonth: { width: (width - Spacing.lg * 2) / 7, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12, marginBottom: 2 },
  activeCell: { backgroundColor: '#1B254B', elevation: 2 },
  dayNum: { fontSize: 16, fontWeight: '700', color: Colors.text },
  activeText: { color: 'white' },
  taskDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.primary, position: 'absolute', bottom: 6 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 120 },
  sectionHeader: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.textSecondary, textTransform: 'uppercase' },
  sectionSubtitle: { fontSize: 22, fontWeight: '800', color: Colors.text, marginTop: 2 },
  taskList: { gap: Spacing.md },
  taskCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: Spacing.md, borderRadius: 24, elevation: 2, shadowColor: Colors.shadow, shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
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
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyText: { fontSize: 15, fontWeight: '600', color: Colors.textSecondary },
  fab: { position: 'absolute', bottom: 110, right: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#111827', justifyContent: 'center', alignItems: 'center', elevation: 8 },
  
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
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: height * 0.85, padding: Spacing.xl },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: 22, fontWeight: '800', color: Colors.text },
  modalForm: { flex: 1 },
  inputLabel: { fontSize: 13, fontWeight: '800', color: Colors.textSecondary, marginBottom: 8, marginTop: 16 },
  textInput: { backgroundColor: '#F4F7FE', borderRadius: 16, paddingHorizontal: 16, height: 52, fontSize: 15, fontWeight: '600', color: Colors.text, justifyContent: 'center' },
  disabledInput: { opacity: 0.6 },
  inputGrid: { flexDirection: 'row' },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F7FE', borderRadius: 16, paddingHorizontal: 16, height: 52 },
  searchField: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  saveBtn: { backgroundColor: '#111827', height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginTop: 40, marginBottom: 40 },
  saveBtnText: { color: 'white', fontSize: 17, fontWeight: '800' },
  innerSearchOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'white', zIndex: 100, padding: 20, paddingTop: Constants.statusBarHeight + 10 },
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
});

export default TasksScreen;
