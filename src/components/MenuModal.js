import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView, Animated, Dimensions, Pressable, Alert } from 'react-native';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { X, Shield, Settings, Info, CreditCard, RefreshCw, Globe, ChevronRight, Languages } from 'lucide-react-native';
import { Colors, Spacing, Typography } from '../theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const DRAWER_WIDTH = width * 0.82;

const MenuModal = ({ visible, onClose }) => {
  const { t, i18n } = useTranslation();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  // Use internal state to keep modal alive during closing animation
  const [isShowing, setIsShowing] = useState(visible);

  const currentLang = i18n.language;

  const handleMenuItemPress = async (id) => {
    if (id === 'reset') {
      Alert.alert(
        t('menu.reset') || '초기화',
        t('menu.reset_confirm_msg') || '모든 권역의 날씨 캐시 데이터를 초기화하시겠습니까?',
        [
          { text: t('common.cancel') || '취소', style: 'cancel' },
          { 
            text: t('common.confirm') || '확인', 
            onPress: async () => {
              try {
                const keys = await AsyncStorage.getAllKeys();
                const weatherKeys = keys.filter(k => k.startsWith('@weather_cache_'));
                if (weatherKeys.length > 0) {
                  await AsyncStorage.multiRemove(weatherKeys);
                }
                Alert.alert(t('common.info') || '알림', t('menu.reset_success_msg') || '초기화가 완료되었습니다. 앱을 다시 로드하면 새 데이터를 불러옵니다.');
                onClose();
              } catch (e) {
                console.error('Reset Error:', e);
              }
            } 
          }
        ]
      );
    } else {
      // Other menu items can be handled here later
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
    { id: 'premium', icon: <CreditCard size={20} color={Colors.primary} />, label: t('menu.premium'), sub: t('menu.premium_sub') },
    { id: 'source', icon: <Globe size={20} color={Colors.primary} />, label: t('menu.source'), sub: t('menu.source_sub') },
    { id: 'settings', icon: <Settings size={20} color={Colors.primary} />, label: t('menu.preferences'), sub: t('menu.preferences_sub') },
    { id: 'reset', icon: <RefreshCw size={20} color={Colors.error} />, label: t('menu.reset'), sub: t('menu.reset_sub') },
    { id: 'privacy', icon: <Shield size={20} color={Colors.outline} />, label: t('menu.privacy') },
    { id: 'help', icon: <Info size={20} color={Colors.outline} />, label: t('menu.help') },
  ];

  if (!isShowing && !visible) return null;

  return (
    <Modal
      transparent={true}
      visible={isShowing}
      onRequestClose={onClose}
      animationType="none"
    >
      <View style={styles.overlay}>
        <TouchableOpacity 
          style={styles.backdropPressable} 
          activeOpacity={1} 
          onPress={onClose}
        >
          <Animated.View style={[
            styles.backdrop,
            { opacity: opacityAnim }
          ]} />
        </TouchableOpacity>
        
        <Animated.View style={[
          styles.drawer, 
          { transform: [{ translateX: slideAnim }] }
        ]}>
          <View style={[styles.container, { paddingTop: Constants.statusBarHeight }]}>
            {/* Header - Minimalist Editorial Style */}
            <View style={styles.header}>
              <View>
                <Text style={Typography.h1}>{t('common.appName')}</Text>
                <Text style={[Typography.bodySmall, { color: Colors.textSecondary, marginTop: 4, letterSpacing: 0.8 }]}>YOUR ATMOSPHERIC COMPANION</Text>
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
                        <Text style={[Typography.bodySmall, { fontWeight: '700' }]}>Curator Beta</Text>
                        <Text style={styles.statusText}>Active Now • Global</Text>
                    </View>
                </View>
                <Text style={styles.versionText}>{t('menu.version')}</Text>
              </View>
            </ScrollView>
          </View>
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
  }
});

export default MenuModal;
