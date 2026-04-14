import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, GripVertical, Trash2, Plus, Sun } from 'lucide-react-native';
import { Colors, Spacing, Typography } from '../theme';

const { width } = Dimensions.get('window');

const RegionManagementScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);

  const regions = [
    { id: '1', name: '서울', sub: '현재 위치', temp: '24°', icon: <Sun size={20} color="#00BFFF" />, widget: true },
    { id: '2', name: '강남역', sub: '서울특별시 강남구', temp: '22°', icon: <Sun size={20} color="#00BFFF" />, widget: false },
  ];

  return (
    <View style={[styles.container, { paddingTop: Constants.statusBarHeight }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <ArrowLeft size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('management.title')}</Text>
        <View style={styles.iconBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.guideText}>{t('management.guide_text')}</Text>

        <View style={styles.listContainer}>
          {regions.map(item => (
            <View key={item.id} style={styles.regionCard}>
              <View style={styles.dragHandle}>
                <GripVertical size={20} color={Colors.outlineVariant} />
              </View>
              <View style={styles.cardInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.regionName}>{item.name}</Text>
                  {item.widget && (
                    <View style={styles.widgetBadge}>
                      <Text style={styles.widgetText}>{t('home.widget_display')}</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.regionSub}>{item.sub}</Text>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.tempText}>{item.temp}</Text>
                {item.icon}
              </View>
              <TouchableOpacity style={styles.deleteBtn}>
                <Trash2 size={20} color="#E57373" />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity style={styles.addSlot}>
            <View style={styles.plusCircle}>
              <Plus size={20} color={Colors.outline} />
            </View>
            <Text style={styles.addText}>{t('management.add_region')}</Text>
          </TouchableOpacity>

          {[1, 2].map(i => (
            <View key={`empty-${i}`} style={styles.emptySlot}>
              <Plus size={20} color={Colors.outlineVariant} opacity={0.3} />
            </View>
          ))}
        </View>

        <View style={styles.pagination}>
           {[1, 2, 3].map(num => (
             <TouchableOpacity 
               key={num} 
               style={[styles.pageBtn, currentPage === num && styles.activePageBtn]}
               onPress={() => setCurrentPage(num)}
             >
               <Text style={[styles.pageText, currentPage === num && styles.activePageText]}>{num}</Text>
             </TouchableOpacity>
           ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    height: 60,
  },
  headerTitle: {
    ...Typography.h2,
    fontSize: 18,
  },
  iconBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 40,
  },
  guideText: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xxl,
    lineHeight: 22,
  },
  listContainer: {
    gap: 12,
  },
  regionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  dragHandle: {
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  regionName: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  widgetBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  widgetText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1976D2',
  },
  regionSub: {
    fontSize: 12,
    color: Colors.outline,
    marginTop: 2,
  },
  cardRight: {
    alignItems: 'center',
    marginRight: 16,
  },
  tempText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
  },
  deleteBtn: {
    padding: 8,
  },
  addSlot: {
    height: 100,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#CFD8DC',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginTop: 8,
    gap: 8,
  },
  plusCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECEFF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.outline,
  },
  emptySlot: {
    height: 80,
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#ECEFF1',
    justifyContent: 'center',
    alignItems: 'center',
    opacity: 0.6,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    marginTop: 32,
    marginBottom: 40,
  },
  pageBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ECEFF1',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activePageBtn: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  pageText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.outline,
  },
  activePageText: {
    color: 'white',
  }
});

export default RegionManagementScreen;
