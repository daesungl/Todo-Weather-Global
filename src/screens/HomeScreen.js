import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { Sun, CheckCircle2, Circle, Plus, MapPin, Calendar, MoreVertical, Wind, Droplets, Compass, Menu, Lock, Pencil } from 'lucide-react-native';
import { Colors, Spacing, Typography } from '../theme';
import MenuModal from '../components/MenuModal';

const { width } = Dimensions.get('window');

const HomeScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const [menuVisible, setMenuVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Mock data for paginated regions (Page 1: 3 regions, Page 2: Empty, Page 3: Locked)
  const paginatedData = {
    1: [
      { id: '1', name: '강남역', condKey: 'partly_cloudy', temp: '22°', widget: true, icon: <Sun size={22} color="#00BFFF" strokeWidth={2} /> },
      { id: '2', name: '제주도', condKey: 'light_rain', temp: '19°', widget: false, icon: <Wind size={22} color={Colors.outline} strokeWidth={2} /> },
      { id: '3', name: '부산항', condKey: 'strong_wind', temp: '20°', widget: false, icon: <Wind size={22} color={Colors.outline} strokeWidth={2} /> },
    ],
    2: [],
    3: [],
  };

  const isPremium = false; // Business logic flag

  return (
    <View style={[styles.container, { paddingTop: Constants.statusBarHeight }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* One-Line Premium Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.headerIcon}>
            <Menu size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('common.appName')}</Text>
          <View style={styles.headerIcon} />
        </View>

        {/* Hero Weather Section - Immersive Glassmorphism */}
        <View style={styles.heroSection}>
          <View style={styles.weatherCard}>
            <View style={styles.glassBackground} />
            <View style={styles.cardContent}>
                <View style={styles.weatherTop}>
                  <View>
                    <View style={styles.locationChip}>
                      <MapPin size={14} color="white" style={{ marginRight: 4 }} />
                      <Text style={styles.locationText}>서울</Text>
                    </View>
                    <View style={styles.tempRow}>
                       <Text style={styles.heroTemp}>24°</Text>
                       <View style={styles.weatherMeta}>
                          <Text style={styles.conditionText}>{t('weather.sunny')}</Text>
                          <Text style={styles.humidityText}>{t('common.humidity')} 45%</Text>
                       </View>
                    </View>
                  </View>
                  <View style={styles.heroIconWrap}>
                    <Sun size={120} color="rgba(255, 255, 255, 0.9)" strokeWidth={0.8} />
                  </View>
                </View>
            </View>
          </View>
        </View>

        {/* Interest Regions Section */}
        <View style={styles.sectionHeader}>
          <View>
             <Text style={Typography.h3}>{t('home.interest_regions')}</Text>
          </View>
          <TouchableOpacity 
            style={styles.editIconBtn}
            onPress={() => navigation.navigate('RegionManagement')}
          >
            <Pencil size={18} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Paginated Content Area */}
        <View style={styles.paginationArea}>
            {/* Filtered regions for current page, only showing real data */}
            <View style={styles.regionsList}>
              {(paginatedData[currentPage] || []).map(region => (
                <TouchableOpacity key={region.id} style={styles.regionCard}>
                   <View style={styles.dragHandleWrap}>
                      <View style={styles.dotGrid} />
                      <View style={styles.dotGrid} />
                   </View>
                   <View style={{ flex: 1 }}>
                     <View style={styles.regionMain}>
                       <Text style={styles.regionName}>{region.name}</Text>
                       {region.widget && (
                         <View style={styles.widgetBadge}>
                           <Text style={styles.widgetText}>{t('home.widget_display')}</Text>
                         </View>
                       )}
                     </View>
                     <Text style={styles.regionCond}>{t(`weather.${region.condKey}`)}</Text>
                   </View>
                   <View style={styles.regionWeather}>
                     {region.icon}
                     <Text style={styles.regionTemp}>{region.temp}</Text>
                   </View>
                </TouchableOpacity>
              ))}
              
              {/* If empty and not locked, show a subtle guide instead of a button */}
              {currentPage > 1 && !isPremium && (
                <View style={styles.lockedContainer}>
                   <Lock size={32} color={Colors.outlineVariant} />
                   <Text style={styles.lockedText}>{t('home.locked_slot_guide')}</Text>
                   <TouchableOpacity style={styles.premiumBadge}>
                      <Text style={styles.premiumBadgeText}>{t('home.upgrade')}</Text>
                   </TouchableOpacity>
                </View>
              )}
            </View>
        </View>

        {/* Action Pages Indicator (1 2 3) - Stitch Circle Style */}
        <View style={styles.pageIndicator}>
           {[1, 2, 3].map(num => (
             <TouchableOpacity 
               key={num} 
               onPress={() => setCurrentPage(num)}
               style={[styles.indicatorCircle, currentPage === num && styles.activeIndicator]}
             >
                <Text style={[styles.indicatorText, currentPage === num && styles.activeIndicatorText]}>{num}</Text>
             </TouchableOpacity>
           ))}
        </View>

        {/* Quick Task Briefing */}
        <TouchableOpacity 
          style={styles.briefingCard}
          onPress={() => navigation.navigate('Tasks')}
        >
          <View style={styles.briefIconWrap}>
            <CheckCircle2 size={24} color={Colors.primary} strokeWidth={2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={Typography.body}>You have 3 tasks today</Text>
            <Text style={Typography.bodySmall}>Next: Global UI Review at 10:00 AM</Text>
          </View>
        </TouchableOpacity>

      </ScrollView>

      {/* Glass Floating Navigation - 3 Tab Icon+Dot Version */}
      <View style={styles.bottomNavContainer}>
        <View style={styles.glassNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Weather')}>
            <View style={styles.activeDot} />
            <Sun size={28} color={Colors.primary} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Tasks')}>
            <CheckCircle2 size={28} color={Colors.outline} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Flow')}>
            <Compass size={28} color={Colors.outline} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      </View>

      <MenuModal 
        visible={menuVisible} 
        onClose={() => setMenuVisible(false)} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 130,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  headerTitle: {
    ...Typography.h2,
    fontSize: 20,
    color: Colors.text,
  },
  headerIcon: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroSection: {
    marginBottom: Spacing.xl,
  },
  weatherCard: {
    backgroundColor: '#00668a',
    borderRadius: 36,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 30,
    elevation: 8,
  },
  glassBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 150, 255, 0.35)',
    borderRadius: 36,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  cardContent: {
    padding: Spacing.xl,
  },
  weatherTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: Spacing.xs,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '800',
    color: 'white',
    textTransform: 'uppercase',
  },
  tempRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroTemp: {
    fontSize: 72,
    fontWeight: '800',
    color: 'white',
    letterSpacing: -2,
  },
  weatherMeta: {
    justifyContent: 'center',
  },
  conditionText: {
    fontSize: 22,
    fontWeight: '700',
    color: 'white',
  },
  humidityText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  heroIconWrap: {
    position: 'absolute',
    right: -20,
    top: -10,
    opacity: 0.9,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.lg, // Match with regionCard's internal padding
  },
  slotGuide: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  editIconBtn: {
    padding: 8,
    marginRight: 2, // Precisely align with weather icons in cards below
    marginTop: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationArea: {
    minHeight: 100, // Reduced significantly after removing slots
    marginBottom: Spacing.lg,
  },
  regionsList: {
    gap: 10,
  },
  regionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLowest,
    padding: Spacing.lg,
    borderRadius: 24,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  dragHandleWrap: {
    gap: 3,
  },
  dotGrid: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.outlineVariant,
  },
  regionMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  regionName: {
    ...Typography.h3,
    fontSize: 18,
  },
  widgetBadge: {
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  widgetText: {
    fontSize: 9,
    fontWeight: '800',
    color: Colors.primary,
    textTransform: 'uppercase',
  },
  regionCond: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  regionWeather: {
    alignItems: 'center',
    gap: 4,
  },
  regionTemp: {
    ...Typography.h3,
    fontSize: 20,
  },
  addSlotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: 24,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.outlineVariant,
    gap: Spacing.md,
    backgroundColor: 'rgba(0, 191, 255, 0.02)',
  },
  addSlotText: {
    ...Typography.body,
    color: Colors.outline,
    fontWeight: '600',
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
  briefingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: 'white',
    borderRadius: 28,
    gap: Spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 20,
    marginBottom: Spacing.md,
  },
  briefIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
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

export default HomeScreen;
