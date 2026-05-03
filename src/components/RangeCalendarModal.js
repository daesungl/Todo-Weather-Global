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

// singleDate=true → 날짜 하나만 선택 후 즉시 onApply(date) 호출
const RangeCalendarModal = ({ visible, onClose, onApply, initialStartDate, initialEndDate, singleDate = false }) => {
  const { t } = useTranslation();

  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  useEffect(() => {
    if (visible) {
      setStartDate(initialStartDate ? formatDate(initialStartDate) : null);
      setEndDate(singleDate ? null : (initialEndDate ? formatDate(initialEndDate) : null));
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

    if (singleDate) {
      onApply(selected);
      onClose();
      return;
    }

    if (startDate && endDate) {
      setStartDate(selected);
      setEndDate(null);
      return;
    }

    if (startDate && !endDate) {
      if (selected < startDate) {
        setStartDate(selected);
      } else {
        setEndDate(selected);
      }
      return;
    }

    if (!startDate) {
      setStartDate(selected);
    }
  };

  const getMarkedDates = () => {
    let marked = {};
    const primaryColor = Colors.primary;
    const lightColor = `${Colors.primary}20`;

    if (singleDate && startDate) {
      marked[startDate] = { selected: true, selectedColor: primaryColor };
      return marked;
    }

    if (startDate) {
      marked[startDate] = { startingDay: true, color: primaryColor, textColor: 'white' };
    }
    if (startDate && endDate) {
      let current = new Date(startDate);
      current.setDate(current.getDate() + 1);
      const end = new Date(endDate);
      while (current < end) {
        const dateStr = formatDate(current);
        marked[dateStr] = { color: lightColor, textColor: Colors.text };
        current.setDate(current.getDate() + 1);
      }
      marked[endDate] = { endingDay: true, color: primaryColor, textColor: 'white' };
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
            <Text style={styles.title}>
              {singleDate ? t('common.select_date', '날짜 선택') : t('tasks.select_period', 'Select Period')}
            </Text>
            {singleDate ? (
              <View style={{ width: 24 }} />
            ) : (
              <TouchableOpacity onPress={handleApply} hitSlop={{ top: 25, bottom: 25, left: 25, right: 25 }}>
                <View pointerEvents="none">
                  <Check size={24} color={Colors.primary} />
                </View>
              </TouchableOpacity>
            )}
          </View>

          {!singleDate && (
            <View style={styles.infoRow}>
              <Text style={styles.infoText}>
                {!startDate ? t('tasks.select_start_date', '시작일을 선택하세요')
                  : !endDate ? t('tasks.select_end_date', '종료일을 선택하세요')
                  : `${startDate} ~ ${endDate}`}
              </Text>
            </View>
          )}

          <Calendar
            current={initialStartDate ? formatDate(initialStartDate) : (startDate || undefined)}
            markingType={singleDate ? 'simple' : 'period'}
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
