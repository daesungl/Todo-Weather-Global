import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, ScrollView, Animated, Dimensions, Pressable, Linking, Switch, Platform } from 'react-native';
import { TouchableOpacity, GestureHandlerRootView } from 'react-native-gesture-handler';
import Constants from 'expo-constants';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { X, Shield, Settings, Info, CreditCard, RefreshCw, Globe, ChevronRight, Languages, ArrowLeft, CheckCircle2, Thermometer, Wind, Crown, User as UserIcon, Ticket } from 'lucide-react-native';
import { Colors, Spacing, Typography } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUnits } from '../contexts/UnitContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAuth } from '../contexts/AuthContext';
import { Image } from 'react-native';
import { clearBookmarkedRegions } from '../services/weather/RegionSyncService';
import { clearTasks } from '../services/task/TaskSyncService';
import { clearFlows } from '../services/FlowSyncService';
import ToastStack, { useToastStack } from './ToastStack';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.82;

const MenuModal = ({ visible, onClose, onReset, navigation }) => {
  const { t, i18n } = useTranslation();
  const { tempUnit, windUnit, setTempUnit, setWindUnit } = useUnits();
  const { isPremium, devTogglePremium } = useSubscription();
  const { user, isGuest, logout } = useAuth();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [isShowing, setIsShowing] = useState(visible);
  const [activeSubMenu, setActiveSubMenu] = useState(null);
  const [resetModalMode, setResetModalMode] = useState(null);
  const [isResetting, setIsResetting] = useState(false);
  const pendingNavRef = useRef(null);
  const { toasts, showToast, handleToastDone } = useToastStack();

  const currentLang = i18n.language;

  const resetActionLabels = {
    weather: t('menu.reset_weather') || 'Weather Reset',
    todo: t('menu.reset_todo') || 'Todo Reset',
    flow: t('menu.reset_flow') || 'Plan Reset',
    all: t('menu.reset_all') || 'Reset All',
  };

  const finishReset = (type) => {
    setResetModalMode(null);
    onReset?.();
    showToast(t(`menu.reset_${type}_success_msg`, t('menu.reset_success_msg')));
    setTimeout(() => onClose(), 950);
  };

  const handleResetAction = async (type) => {
    if (isResetting) return;
    if (['weather', 'todo', 'flow', 'all'].includes(type)) {
      setResetModalMode(`confirm:${type}`);
      return;
    }
  };

  const executeResetAction = async (type) => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      if (type === 'weather') {
        const keys = await AsyncStorage.getAllKeys();
        const weatherCacheKeys = keys.filter(k => k.startsWith('@weather_cache_'));
        if (weatherCacheKeys.length > 0) await AsyncStorage.multiRemove(weatherCacheKeys);
        finishReset(type);
        return;
      }

      if (type === 'todo') {
        await clearTasks();
        await AsyncStorage.removeItem('@user_holiday_countries');
        finishReset(type);
        return;
      }

      if (type === 'flow') {
        await clearFlows();
        finishReset(type);
      }
    } catch (error) {
      console.warn('[MenuModal] reset failed:', error);
      setResetModalMode(null);
      showToast(t('menu.reset_failed_msg', 'Failed to reset data.'));
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetAll = async () => {
    if (isResetting) return;
    setIsResetting(true);
    try {
      await Promise.all([
        clearBookmarkedRegions(),
        clearTasks(),
        clearFlows(),
      ]);
      const keys = await AsyncStorage.getAllKeys();
      const appKeys = keys.filter(k =>
        k.startsWith('@weather_cache_') ||
        k === '@tasks_v1' ||
        k === '@todo_weather_flows' ||
        k.startsWith('@todo_weather_flows_') ||
        k.startsWith('@todo_weather_shared_flows_') ||
        k.startsWith('@flows_global_schema_migrated_') ||
        k.startsWith('@tasks_migrated_') ||
        k.startsWith('@regions_migrated_') ||
        k === '@save_wBookmark' ||
        k === '@user_holiday_countries'
      );
      if (appKeys.length > 0) await AsyncStorage.multiRemove(appKeys);
      finishReset('all');
    } catch (error) {
      console.warn('[MenuModal] reset all failed:', error);
      setResetModalMode(null);
      showToast(t('menu.reset_failed_msg', 'Failed to reset data.'));
    } finally {
      setIsResetting(false);
    }
  };

  const handleMenuItemPress = async (id) => {
    if (id === 'profile') {
      pendingNavRef.current = () => navigation.navigate('Profile');
      onClose();
      return;
    }
    if (id === 'joinInvite') {
      pendingNavRef.current = () => navigation.navigate('Flow', { openJoinModal: Date.now() });
      onClose();
      return;
    }
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
      setResetModalMode('options');
    } else {
      onClose();
    }
  };

  useEffect(() => {
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
        if (pendingNavRef.current) {
          pendingNavRef.current();
          pendingNavRef.current = null;
        }
      });
    }
  }, [visible]);

  const LANGUAGES = [
    { code: 'en', label: 'English', flag: '🇺🇸' },
    { code: 'ko', label: '한국어', flag: '🇰🇷' },
    { code: 'ja', label: '日本語', flag: '🇯🇵' },
    { code: 'zh-TW', label: '繁體中文', flag: '🇹🇼' },
    { code: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
    { code: 'es', label: 'Español', flag: '🇪🇸' },
    { code: 'pt-BR', label: 'Português (BR)', flag: '🇧🇷' },
  ];

  const selectLanguage = async (lang) => {
    try {
      await AsyncStorage.setItem('@user_language', lang);
    } catch (_) {}
    i18n.changeLanguage(lang);
    setActiveSubMenu(null);
  };

  const renderResetDialog = () => {
    if (!resetModalMode) return null;
    const confirmType = resetModalMode.startsWith('confirm:')
      ? resetModalMode.split(':')[1]
      : null;
    const isConfirm = !!confirmType;

    return (
      <Modal transparent visible={!!resetModalMode} animationType="fade" onRequestClose={() => setResetModalMode(null)}>
        <View style={styles.resetDialogLayer}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setResetModalMode(null)}
          />
          <Pressable style={styles.resetDialog} onPress={() => {}}>
            <Text style={styles.resetDialogTitle}>
              {isConfirm ? resetActionLabels[confirmType] : t('menu.reset')}
            </Text>
            <Text style={styles.resetDialogMessage}>
              {isConfirm
                ? t(`menu.reset_${confirmType}_msg`, `${resetActionLabels[confirmType]}을(를) 정말 초기화하시겠습니까? 이 작업은 취소할 수 없습니다.`)
                : t('menu.reset_sub')}
            </Text>

            {isConfirm ? (
              <>
                <Pressable
                  style={({ pressed }) => [styles.resetDialogButton, styles.resetDialogDangerButton, (pressed || isResetting) && styles.resetDialogButtonPressed]}
                  onPress={() => (
                    confirmType === 'all'
                      ? handleResetAll()
                      : executeResetAction(confirmType)
                  )}
                  disabled={isResetting}
                >
                  <Text style={styles.resetDialogDangerText}>{t('common.confirm')}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.resetDialogButton, (pressed || isResetting) && styles.resetDialogButtonPressed]}
                  onPress={() => setResetModalMode('options')}
                  disabled={isResetting}
                >
                  <Text style={styles.resetDialogButtonText}>{t('common.cancel')}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  style={({ pressed }) => [styles.resetDialogButton, pressed && styles.resetDialogButtonPressed]}
                  onPress={() => handleResetAction('weather')}
                >
                  <Text style={styles.resetDialogButtonText}>{t('menu.reset_weather') || 'Weather Reset'}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.resetDialogButton, pressed && styles.resetDialogButtonPressed]}
                  onPress={() => handleResetAction('todo')}
                >
                  <Text style={styles.resetDialogButtonText}>{t('menu.reset_todo') || 'Todo Reset'}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.resetDialogButton, pressed && styles.resetDialogButtonPressed]}
                  onPress={() => handleResetAction('flow')}
                >
                  <Text style={styles.resetDialogButtonText}>{t('menu.reset_flow') || 'Plan Reset'}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.resetDialogButton, styles.resetDialogDangerButton, pressed && styles.resetDialogButtonPressed]}
                  onPress={() => handleResetAction('all')}
                >
                  <Text style={styles.resetDialogDangerText}>{t('menu.reset_all') || 'Reset All'}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.resetDialogButton, pressed && styles.resetDialogButtonPressed]}
                  onPress={() => setResetModalMode(null)}
                >
                  <Text style={styles.resetDialogButtonText}>{t('common.cancel')}</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </View>
      </Modal>
    );
  };

  const menuItems = [
    { id: 'joinInvite', icon: <Ticket size={20} color={Colors.primary} />, label: t('menu.enter_invite_code'), sub: t('menu.enter_invite_code_sub') },
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
                <View style={[styles.header, { paddingHorizontal: Spacing.lg, justifyContent: 'flex-start', gap: 8 }]}>
                  <TouchableOpacity onPress={() => setActiveSubMenu(null)} style={{ padding: 8 }}>
                    <ArrowLeft size={24} color={Colors.text} />
                  </TouchableOpacity>
                  <Text style={Typography.h2}>{t('menu.pref_title')}</Text>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                  <Text style={[Typography.body, { color: Colors.textSecondary, marginBottom: 24, lineHeight: 22 }]}>{t('menu.pref_desc')}</Text>

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
                            <Text style={[styles.subText, { lineHeight: 18 }]}>{opt.desc}</Text>
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
                            <Text style={[styles.subText, { lineHeight: 18 }]}>{opt.desc}</Text>
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
                <View style={[styles.header, { paddingHorizontal: Spacing.lg, justifyContent: 'flex-start', gap: 8 }]}>
                  <TouchableOpacity onPress={() => setActiveSubMenu(null)} style={{ padding: 8 }}>
                    <ArrowLeft size={24} color={Colors.text} />
                  </TouchableOpacity>
                  <Text style={Typography.h2}>{t('menu.source_title', 'Weather Source Settings')}</Text>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                  <Text style={[Typography.body, { color: Colors.textSecondary, marginBottom: 24, lineHeight: 22 }]}>
                    {t('menu.source_desc')}
                  </Text>

                  <View style={styles.menuList}>
                    <TouchableOpacity style={[styles.menuItem, { borderColor: Colors.primary, borderWidth: 1 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[Typography.body, { fontWeight: '700', color: Colors.primary }]}>{t('menu.source_auto')}</Text>
                        <Text style={[styles.subText, { lineHeight: 18 }]}>{t('menu.source_auto_desc')}</Text>
                      </View>
                      <CheckCircle2 size={20} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.menuItem, { opacity: 0.5 }]} disabled>
                      <View style={{ flex: 1 }}>
                        <Text style={[Typography.body, { fontWeight: '700' }]}>{t('menu.source_kma')}</Text>
                        <Text style={[styles.subText, { lineHeight: 18 }]}>{t('menu.source_kma_desc')}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.menuItem, { opacity: 0.5 }]} disabled>
                      <View style={{ flex: 1 }}>
                        <Text style={[Typography.body, { fontWeight: '700' }]}>{t('menu.source_global')}</Text>
                        <Text style={[styles.subText, { lineHeight: 18 }]}>{t('menu.source_global_desc')}</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </>
            ) : activeSubMenu === 'language' ? (
              <>
                <View style={[styles.header, { paddingHorizontal: Spacing.lg, justifyContent: 'flex-start', gap: 8 }]}>
                  <TouchableOpacity onPress={() => setActiveSubMenu(null)} style={{ padding: 8 }}>
                    <ArrowLeft size={24} color={Colors.text} />
                  </TouchableOpacity>
                  <Text style={Typography.h2}>{t('menu.language')}</Text>
                </View>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                  <View style={styles.menuList}>
                    {LANGUAGES.map(lang => (
                      <TouchableOpacity
                        key={lang.code}
                        style={[styles.menuItem, currentLang === lang.code && { borderColor: Colors.primary, borderWidth: 1 }]}
                        onPress={() => selectLanguage(lang.code)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[Typography.body, { fontWeight: '700', color: currentLang === lang.code ? Colors.primary : Colors.text }]}>
                            {lang.flag}{'  '}{lang.label}
                          </Text>
                        </View>
                        {currentLang === lang.code && <CheckCircle2 size={20} color={Colors.primary} />}
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </>
            ) : (
              <>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
                  {/* Header - Now part of ScrollView */}
                  <View style={styles.header}>
                    <Text style={Typography.h1}>{t('common.appName')}</Text>
                  </View>
 
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

                    {/* Inline Language Selector */}
                    <TouchableOpacity style={styles.menuItem} onPress={() => setActiveSubMenu('language')}>
                      <View style={styles.iconWrap}>
                        <Languages size={20} color={Colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[Typography.body, { fontWeight: '700' }]}>{t('menu.language')}</Text>
                        <Text style={styles.subText}>{LANGUAGES.find(l => l.code === currentLang)?.label ?? 'English'}</Text>
                      </View>
                      <ChevronRight size={18} color={Colors.outlineVariant} />
                    </TouchableOpacity>
                  </View>

                  {/* Dev: Premium Toggle - Only visible in development mode */}
                  {__DEV__ && (
                    <View style={styles.devSection}>
                      <View style={styles.devRow}>
                        <Crown size={14} color={isPremium ? '#f59e0b' : Colors.outline} />
                        <Text style={[styles.devLabel, isPremium && { color: '#f59e0b' }]}>
                          {isPremium ? 'Premium Dev Mode ON' : 'Premium Dev Mode OFF'}
                        </Text>
                        <Switch
                          value={isPremium}
                          onValueChange={(val) => devTogglePremium(val)}
                          trackColor={{ false: Colors.outlineVariant, true: '#fde68a' }}
                          thumbColor={isPremium ? '#f59e0b' : Colors.outline}
                          style={{ transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] }}
                        />
                      </View>
                    </View>
                  )}
                </ScrollView>

                {/* Fixed Bottom Profile & Footer */}
                <View style={styles.fixedFooter}>
                  <TouchableOpacity
                    style={styles.profileSummary}
                    onPress={() => handleMenuItemPress('profile')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.profileAvatarContainer}>
                      {(!isGuest && user?.photoURL) ? (
                        <Image source={{ uri: user.photoURL }} style={styles.profileAvatar} />
                      ) : (
                        <View style={[styles.profileAvatarPlaceholder, isGuest && { backgroundColor: Colors.surfaceContainer }]}>
                          <UserIcon size={20} color={isGuest ? Colors.outline : Colors.primary} />
                        </View>
                      )}
                    </View>
                    <View style={styles.profileInfo}>
                      <Text style={styles.profileName} numberOfLines={1}>
                        {isGuest ? (user?.displayName || t('auth.guest')) : (user?.displayName || 'User')}
                      </Text>
                      <Text style={styles.profileEmail} numberOfLines={1}>
                        {isGuest ? t('auth.guestSyncMsg', 'Safely sync & backup data') : user?.email}
                      </Text>
                    </View>
                    <View style={styles.profileAction}>
                      <Text style={styles.profileActionText}>
                        {isGuest ? t('common.select') : ''}
                      </Text>
                      <ChevronRight size={16} color={Colors.outlineVariant} />
                    </View>
                  </TouchableOpacity>

                  {/* 사업자 등록 전까지 프리미엄 전환 버튼 숨김 */}
                  {false && (
                    <TouchableOpacity
                      style={isPremium ? [styles.premiumCta, styles.premiumCtaActive] : { width: '100%' }}
                      onPress={() => { if (!isPremium) { onClose(); navigation.navigate('Paywall'); } }}
                      activeOpacity={isPremium ? 1 : 0.8}
                    >
                      {!isPremium ? (
                        <LinearGradient
                          colors={['#00BFFF', '#0095CC']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.premiumCta}
                        >
                          <Crown size={18} color="white" fill="white" />
                          <Text style={styles.premiumCtaText}>
                            {t('menu.premium_cta')}
                          </Text>
                        </LinearGradient>
                      ) : (
                        <>
                          <Crown size={18} color="#B45309" fill="#B45309" />
                          <Text style={[styles.premiumCtaText, { color: '#B45309' }]}>
                            {t('menu.premium_active')}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                  <Text style={styles.copyrightText}>© 2026 PellongSoft. All rights reserved.</Text>
                </View>
              </>
            )}
          </View>
          </GestureHandlerRootView>
        </Animated.View>
        {renderResetDialog()}
        <ToastStack toasts={toasts} onDone={handleToastDone} />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  resetDialogLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    paddingHorizontal: 24,
  },
  resetDialog: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 28,
    backgroundColor: 'rgba(250, 253, 255, 0.96)',
    padding: 18,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.22,
        shadowRadius: 28,
      },
      android: { elevation: 18 },
    }),
  },
  resetDialogTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  resetDialogMessage: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  resetDialogButton: {
    minHeight: 54,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.09)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginTop: 8,
  },
  resetDialogDangerButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.08)',
  },
  resetDialogButtonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.99 }],
  },
  resetDialogButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  resetDialogDangerText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.error,
    textAlign: 'center',
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
    paddingVertical: Spacing.xl,
    paddingHorizontal: 0,
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
  toggleTrack: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceContainer,
    borderRadius: 12,
    padding: 2,
    width: 68,
  },
  toggleChip: {
    flex: 1,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  activeChip: {
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  activeToggleText: {
    color: Colors.primary,
  },
  footer: {
    marginTop: Spacing.huge,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  copyrightText: {
    marginTop: 8,
    textAlign: 'center',
    fontSize: 9,
    color: Colors.outline,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
    opacity: 0.8,
  },
  fixedFooter: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainer,
    backgroundColor: 'white',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24, // Consider safe area
  },
  premiumCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#00BFFF',
    borderRadius: 18,
    paddingVertical: 16,
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  premiumCtaActive: {
    backgroundColor: '#FFF8E1',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    shadowOpacity: 0,
    elevation: 0,
  },
  premiumCtaText: {
    fontSize: 15,
    fontWeight: '800',
    color: 'white',
    letterSpacing: -0.3,
  },
  devSection: {
    marginTop: 24,
    paddingHorizontal: 4,
  },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    borderStyle: 'dashed',
  },
  devLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.outline,
    letterSpacing: 0.5,
  },
  profileSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    padding: 16,
    borderRadius: 24,
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  profileAvatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  profileAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#e3f2fd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  profileEmail: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  profileAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profileActionText: {
    fontSize: 12,
    color: Colors.outline,
    fontWeight: '500',
  },
  prefSection: {
    marginBottom: 8,
  },
  prefSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  prefSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
});

export default MenuModal;
