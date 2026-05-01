import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Platform } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { Colors, Spacing } from '../theme';
import { useTranslation } from 'react-i18next';
import { X, Check } from 'lucide-react-native';

// 기본 달력 현지화 설정 (필요시 i18n 상태에 따라 변경 가능)
LocaleConfig.locales['kr'] = {
  monthNames: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
  monthNamesShort: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
  dayNames: ['일요일','월요일','화요일','수요일','목요일','금요일','토요일'],
  dayNamesShort: ['일','월','화','수','목','금','토'],
  today: '오늘'
};
LocaleConfig.defaultLocale = 'kr';

const RangeCalendarModal = ({ visible, onClose, onApply, initialStartDate, initialEndDate }) => {
  const { t } = useTranslation();
  
  // 상태 관리: 시작일과 종료일 (YYYY-MM-DD 문자열)
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  useEffect(() => {
    if (visible) {
      setStartDate(initialStartDate ? formatDate(initialStartDate) : null);
      setEndDate(initialEndDate ? formatDate(initialEndDate) : null);
    }
  }, [visible, initialStartDate, initialEndDate]);

  const formatDate = (date) => {
    if (!date) return null;
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleDayPress = (day) => {
    const selected = day.dateString;

    // 1. 이미 시작일과 종료일이 모두 있는 상태에서 터치하면 -> 다시 시작일로 초기화
    if (startDate && endDate) {
      setStartDate(selected);
      setEndDate(null);
      return;
    }

    // 2. 시작일은 있는데 종료일이 없는 상태에서 터치하면
    if (startDate && !endDate) {
      // 만약 선택한 날짜가 시작일보다 이전이라면, 시작일을 변경
      if (selected < startDate) {
        setStartDate(selected);
      } else {
        // 정상적인 종료일 지정
        setEndDate(selected);
      }
      return;
    }

    // 3. 아무것도 선택 안 된 상태에서 터치하면 -> 시작일 지정
    if (!startDate) {
      setStartDate(selected);
      return;
    }
  };

  const getMarkedDates = () => {
    let marked = {};
    const primaryColor = Colors.primary;
    const lightColor = `${Colors.primary}20`; // 20% opacity for between dates

    if (startDate) {
      marked[startDate] = { startingDay: true, color: primaryColor, textColor: 'white' };
    }
    
    if (startDate && endDate) {
      // 시작일과 종료일 사이의 날짜 채우기
      let current = new Date(startDate);
      current.setDate(current.getDate() + 1);
      const end = new Date(endDate);

      while (current < end) {
        const dateStr = formatDate(current);
        marked[dateStr] = { color: lightColor, textColor: Colors.text };
        current.setDate(current.getDate() + 1);
      }

      marked[endDate] = { endingDay: true, color: primaryColor, textColor: 'white' };
      
      // 만약 시작일과 종료일이 같은 날이라면
      if (startDate === endDate) {
        marked[startDate] = { startingDay: true, endingDay: true, color: primaryColor, textColor: 'white' };
      }
    }

    return marked;
  };

  const handleApply = () => {
    onApply(startDate, endDate || startDate);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}>
              <View pointerEvents="none">
                <X size={24} color={Colors.text} />
              </View>
            </TouchableOpacity>
            <Text style={styles.title}>{t('tasks.select_period', 'Select Period')}</Text>
            <TouchableOpacity onPress={handleApply} hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}>
              <View pointerEvents="none">
                <Check size={24} color={Colors.primary} />
              </View>
            </TouchableOpacity>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoText}>
              {!startDate ? t('tasks.select_start_date', '시작일을 선택하세요')
              : !endDate ? t('tasks.select_end_date', '종료일을 선택하세요')
              : `${startDate} ~ ${endDate}`}
            </Text>
          </View>

          <Calendar
            current={initialStartDate ? formatDate(initialStartDate) : (startDate || undefined)}
            markingType={'period'}
            markedDates={getMarkedDates()}
            onDayPress={handleDayPress}
            style={{ height: 370 }}
            theme={{
              backgroundColor: '#ffffff',
              calendarBackground: '#ffffff',
              textSectionTitleColor: '#b6c1cd',
              selectedDayBackgroundColor: Colors.primary,
              selectedDayTextColor: '#ffffff',
              todayTextColor: Colors.primary,
              dayTextColor: '#2d4150',
              textDisabledColor: '#d9e1e8',
              arrowColor: Colors.primary,
              monthTextColor: Colors.text,
              indicatorColor: Colors.primary,
              textDayFontWeight: '500',
              textMonthFontWeight: 'bold',
              textDayHeaderFontWeight: '600',
              textDayFontSize: 16,
              textMonthFontSize: 18,
              textDayHeaderFontSize: 14
            }}
          />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  infoRow: {
    padding: 15,
    alignItems: 'center',
    backgroundColor: '#F9F9F9',
  },
  infoText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '500',
  }
});

export default RangeCalendarModal;
