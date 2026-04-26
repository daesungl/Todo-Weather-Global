import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Animated, Dimensions, Pressable, Alert, Linking } from 'react-native';
import { TouchableOpacity, GestureHandlerRootView } from 'react-native-gesture-handler';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { X, Shield, Settings, Info, CreditCard, RefreshCw, Globe, ChevronRight, Languages, ArrowLeft, CheckCircle2, Thermometer, Wind } from 'lucide-react-native';
import { Colors, Spacing, Typography } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUnits } from '../contexts/UnitContext';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.82;

const MenuModal = ({ visible, onClose, onReset, navigation }) => {
  const { t, i18n } = useTranslation();
  const { tempUnit, windUnit, setTempUnit, setWindUnit } = useUnits();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  // Use internal state to keep modal alive during closing animation
  const [isShowing, setIsShowing] = useState(visible);
  const [activeSubMenu, setActiveSubMenu] = useState(null);

  const currentLang = i18n.language;

  const handleMenuItemPress = async (id) => {
    if (id === 'privacy') {
      Linking.openURL('https://pellongsoft.tistory.com/4');
      return;
    }
    if (id === 'source') {
      setActiveSubMenu('source');
      return;
    }
    if (id === 'settings') {
      setActiveSubMenu('settings');
      return;
    }
    if (id === 'reset') {
      // Show multiple reset options
      Alert.alert(
        t('menu.reset') || 'Data Management',
        t('menu.reset_sub') || 'Select the data you want to reset',
        [
          { text: t('common.cancel'), style: 'cancel' },
          { 
            text: t('menu.reset_weather') || 'Weather Reset', 
            onPress: async () => {
              const keys = await AsyncStorage.getAllKeys();
              const weatherCacheKeys = keys.filter(k => k.startsWith('@weather_cache_'));
              if (weatherCacheKeys.length > 0) await AsyncStorage.multiRemove(weatherCacheKeys);
              Alert.alert(t('common.info'), t('menu.reset_success_msg'));
              onClose();
              onReset?.();
            } 
          },
          { 
            text: t('menu.reset_todo') || 'Todo Reset', 
            onPress: async () => {
              const todoKeys = ['@tasks_v1', '@user_holiday_countries'];
              await AsyncStorage.multiRemove(todoKeys);
              Alert.alert(t('common.info'), t('menu.reset_success_msg'));
              onClose();
              onReset?.();
            } 
          },
          { 
            text: t('menu.reset_flow') || 'Flow Reset', 
            onPress: async () => {
              await AsyncStorage.removeItem('@todo_weather_flows');
              Alert.alert(t('common.info'), t('menu.reset_success_msg'));
              onClose();
              onReset?.();
            } 
          },
          { 
            text: t('menu.reset_all') || 'Reset All', 
            style: 'destructive',
            onPress: async () => {
              Alert.alert(
                t('menu.reset_all'),
                t('menu.reset_all_msg'),
                [
                  { text: t('common.cancel'), style: 'cancel' },
                  { 
                    text: t('common.confirm'), 
                    style: 'destructive',
                    onPress: async () => {
                      const keys = await AsyncStorage.getAllKeys();
                      const appKeys = keys.filter(k => 
                        k.startsWith('@weather_cache_') || 
                        k === '@tasks_v1' || 
                        k === '@todo_weather_flows' ||
                        k === '@save_wBookmark' ||
                        k === '@user_holiday_countries'
                      );
                      if (appKeys.length > 0) await AsyncStorage.multiRemove(appKeys);
                      Alert.alert(t('common.info'), t('menu.reset_success_msg'));
                      onClose();
                      onReset?.();
                    }
                  }
                ]
              );
            } 
          }
        ]
      );
    } else {
      onClose();
    }
  };

  useEffect(() => {
    // ... animation logic ...
    if (visible) {
      setIsShowing(true);
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0.4,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsShowing(false);
      });
    }
  }, [visible]);

  const toggleLanguage = () => {
    const nextLang = currentLang.startsWith('ko') ? 'en' : 'ko';
    i18n.changeLanguage(nextLang);
  };

  const menuItems = [
    { id: 'source', icon: <Globe size={20} color={Colors.primary} />, label: t('menu.source'), sub: t('menu.source_sub') },
    { id: 'settings', icon: <Settings size={20} color={Colors.primary} />, label: t('menu.preferences'), sub: t('menu.preferences_sub') },
    { id: 'privacy', icon: <Shield size={20} color={Colors.primary} />, label: t('menu.privacy', 'Privacy Policy'), sub: t('menu.privacy_sub', 'Check our privacy policy') },
    { id: 'reset', icon: <RefreshCw size={20} color={Colors.error} />, label: t('menu.reset'), sub: t('menu.reset_sub') },
  ];

  if (!isShowing && !visible) return null;

  return (
    <Modal
      transparent={true}
      visible={isShowing}
      onRequestClose={() => {
        if (activeSubMenu) {
          setActiveSubMenu(null);
        } else {
          onClose();
        }
      }}
      animationType="none"
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdropPressable}
          onPress={() => {
            setActiveSubMenu(null);
            onClose();
          }}
        >
          <Animated.View style={[
            styles.backdrop,
            { opacity: opacityAnim }
          ]} />
        </Pressable>

        <Animated.View style={[
          styles.drawer,
          { transform: [{ translateX: slideAnim }] }
        ]}>
          <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={[styles.container, { paddingTop: Constants.statusBarHeight }]}>
            {activeSubMenu === 'settings' ? (
              <>
                <View style={styles.header}>
                  <TouchableOpacity onPress={() => setActiveSubMenu(null)} style={{ padding: 8, marginLeft: -8 }}>
                    <ArrowLeft size={24} color={Colors.text} />
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                  <Text style={[Typography.h2, { marginBottom: 8 }]}>{t('menu.pref_title')}</Text>
                  <Text style={[Typography.body, { color: Colors.textSecondary, marginBottom: 24 }]}>{t('menu.pref_desc')}</Text>

                  <View style={styles.prefSection}>
                    <View style={styles.prefSectionHeader}>
                      <Thermometer size={16} color={Colors.primary} />
                      <Text style={styles.prefSectionTitle}>{t('menu.pref_temp')}</Text>
                    </View>
                    <View style={styles.menuList}>
                      {[
                        { key: 'C', label: t('menu.pref_celsius'), desc: t('menu.pref_celsius_desc') },
                        { key: 'F', label: t('menu.pref_fahrenheit'), desc: t('menu.pref_fahrenheit_desc') },
                      ].map(opt => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.menuItem, tempUnit === opt.key && { borderColor: Colors.primary, borderWidth: 1 }]}
                          onPress={() => setTempUnit(opt.key)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[Typography.body, { fontWeight: '700', color: tempUnit === opt.key ? Colors.primary : Colors.text }]}>{opt.label}</Text>
                            <Text style={styles.subText}>{opt.desc}</Text>
                          </View>
                          {tempUnit === opt.key && <CheckCircle2 size={20} color={Colors.primary} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.prefSection, { marginTop: 24 }]}>
                    <View style={styles.prefSectionHeader}>
                      <Wind size={16} color={Colors.primary} />
                      <Text style={styles.prefSectionTitle}>{t('menu.pref_wind')}</Text>
                    </View>
                    <View style={styles.menuList}>
                      {[
                        { key: 'ms', label: t('menu.pref_wind_ms'), desc: t('menu.pref_wind_ms_desc') },
                        { key: 'kmh', label: t('menu.pref_wind_kmh'), desc: t('menu.pref_wind_kmh_desc') },
                        { key: 'mph', label: t('menu.pref_wind_mph'), desc: t('menu.pref_wind_mph_desc') },
                      ].map(opt => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[styles.menuItem, windUnit === opt.key && { borderColor: Colors.primary, borderWidth: 1 }]}
                          onPress={() => setWindUnit(opt.key)}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[Typography.body, { fontWeight: '700', color: windUnit === opt.key ? Colors.primary : Colors.text }]}>{opt.label}</Text>
                            <Text style={styles.subText}>{opt.desc}</Text>
                          </View>
                          {windUnit === opt.key && <CheckCircle2 size={20} color={Colors.primary} />}
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </ScrollView>
              </>
            ) : activeSubMenu === 'source' ? (
              <>
                <View style={styles.header}>
                  <TouchableOpacity onPress={() => setActiveSubMenu(null)} style={{ padding: 8, marginLeft: -8 }}>
                    <ArrowLeft size={24} color={Colors.text} />
                  </TouchableOpacity>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                  <Text style={[Typography.h2, { marginBottom: 8 }]}>{t('menu.source_title', 'Weather Source Settings')}</Text>
                  <Text style={[Typography.body, { color: Colors.textSecondary, marginBottom: 24 }]}>
                    {t('menu.source_desc')}
                  </Text>

                  <View style={styles.menuList}>
                    <TouchableOpacity style={[styles.menuItem, { borderColor: Colors.primary, borderWidth: 1 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[Typography.body, { fontWeight: '700', color: Colors.primary }]}>{t('menu.source_auto')}</Text>
                        <Text style={styles.subText}>{t('menu.source_auto_desc')}</Text>
                      </View>
                      <CheckCircle2 size={20} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.menuItem, { opacity: 0.5 }]} disabled>
                      <View style={{ flex: 1 }}>
                        <Text style={[Typography.body, { fontWeight: '700' }]}>{t('menu.source_kma')}</Text>
                        <Text style={styles.subText}>{t('menu.source_kma_desc')}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.menuItem, { opacity: 0.5 }]} disabled>
                      <View style={{ flex: 1 }}>
                        <Text style={[Typography.body, { fontWeight: '700' }]}>{t('menu.source_global')}</Text>
                        <Text style={styles.subText}>{t('menu.source_global_desc')}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </>
            ) : (
              <>
                {/* Header - Minimalist Editorial Style */}
                <View style={styles.header}>
                  <View>
                    <Text style={Typography.h1}>{t('common.appName')}</Text>
                    <Text style={[Typography.bodySmall, { color: Colors.textSecondary, marginTop: 4, letterSpacing: 0.8 }]}>{t('menu.companion_tag', 'YOUR ATMOSPHERIC COMPANION')}</Text>
                  </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                  <View style={styles.menuList}>
                    {menuItems.map((item, index) => (
                      <TouchableOpacity 
                        key={item.id} 
                        style={styles.menuItem}
                        onPress={() => handleMenuItemPress(item.id)}
                      >
                        <View style={styles.iconWrap}>{item.icon}</View>
                        <View style={{ flex: 1 }}>
                          <Text style={[Typography.body, { fontWeight: '700' }]}>{item.label}</Text>
                          {item.sub && <Text style={styles.subText}>{item.sub}</Text>}
                        </View>
                        <ChevronRight size={18} color={Colors.outlineVariant} />
                      </TouchableOpacity>
                    ))}

                    {/* Inline Language Selector - Same size as other items */}
                    <TouchableOpacity style={styles.menuItem} onPress={toggleLanguage}>
                      <View style={styles.iconWrap}>
                        <Languages size={20} color={Colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[Typography.body, { fontWeight: '700' }]}>{t('menu.language')}</Text>
                        <Text style={styles.subText}>{currentLang.startsWith('ko') ? '한국어 (KR)' : 'English (EN)'}</Text>
                      </View>
                      <View style={styles.toggleTrack}>
                        <View style={[styles.toggleChip, currentLang.startsWith('ko') && styles.activeChip]}>
                          <Text style={[styles.toggleText, currentLang.startsWith('ko') && styles.activeToggleText]}>KR</Text>
                        </View>
                        <View style={[styles.toggleChip, !currentLang.startsWith('ko') && styles.activeChip]}>
                          <Text style={[styles.toggleText, !currentLang.startsWith('ko') && styles.activeToggleText]}>EN</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {/* Identity Section */}
                  <View style={styles.footer}>
                    <View style={styles.profileBox}>
                        <View style={styles.avatar} />
                        <View style={{ flex: 1 }}>
                            <Text style={[Typography.bodySmall, { fontWeight: '700' }]}>{t('menu.curator_beta', 'Curator Beta')}</Text>
                            <Text style={styles.statusText}>{t('menu.active_global', 'Active Now • Global')}</Text>
                        </View>
                    </View>
                    <Text style={styles.versionText}>{t('menu.version')}</Text>
                  </View>
                </ScrollView>
              </>
            )}
          </View>
          </GestureHandlerRootView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
  },
  drawer: {
    width: DRAWER_WIDTH,
    height: '100%',
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 10, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 16,
    borderTopRightRadius: 32,
    borderBottomRightRadius: 32,
    zIndex: 2,
  },
  container: {
    flex: 1,
  },
  header: {
    padding: Spacing.xl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  closeBtn: {
    padding: 8,
    backgroundColor: Colors.surfaceContainer,
    borderRadius: 20,
  },
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
  },
  menuList: {
    gap: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    backgroundColor: Colors.surfaceContainerLowest,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surfaceContainer,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  subText: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  footer: {
    marginTop: Spacing.huge,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  profileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    padding: 16,
    borderRadius: 24,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primaryContainer,
  },
  statusText: {
    fontSize: 10,
    color: Colors.primary,
    fontWeight: '700',
  },
  versionText: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 10,
    color: Colors.outline,
    letterSpacing: 1,
    fontWeight: '600',
  },
  toggleTrack: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainerHighest,
    padding: 4,
    borderRadius: 12,
    gap: 4,
  },
  toggleChip: {
    width: 32,
    height: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeChip: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.outline,
  },
  activeToggleText: {
    color: Colors.primary,
  },
  prefSection: {
    gap: 8,
  },
  prefSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  prefSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default MenuModal;
