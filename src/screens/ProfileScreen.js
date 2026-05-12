import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { LucideLogOut, LucideUser, LucideArrowLeft, LucideX, LucideCheck, LucideChevronRight, LucideLock, LucideMail, Info } from 'lucide-react-native';
import { supabase } from '../config/supabaseConfig';
import { Colors, Spacing, Typography } from '../theme';
import { deleteCurrentUserAccount, isRecentLoginRequired } from '../services/AccountDeletionService';
import ConfirmModal from '../components/ConfirmModal';

const ProfileScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { user, logout, resetPassword, updateUserProfile, isGuest, generateTransferCode } = useAuth();
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const isLoggingOutRef = React.useRef(false);
  const [confirmConfig, setConfirmConfig] = useState(null);
  const [transferCodeData, setTransferCodeData] = useState(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  const showAlert = (title, message, options) => {
    setConfirmConfig({ title, message: message || '', options: options || [{ text: t('common.confirm'), style: 'default' }] });
  };

  const handleGenerateTransferCode = async () => {
    setIsGeneratingCode(true);
    try {
      const result = await generateTransferCode();
      setTransferCodeData(result);
    } catch (e) {
      showAlert(t('common.error'), e.message);
    } finally {
      setIsGeneratingCode(false);
    }
  };

  React.useEffect(() => {
    if (!user) {
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    }
  }, [navigation, user]);

  React.useEffect(() => {
    if (!isEditModalVisible) {
      setKeyboardHeight(0);
      return undefined;
    }

    const showSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates?.height || 0);
    });
    const hideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [isEditModalVisible]);

  if (!user) return null;

  const handleLogout = () => {
    if (isLoggingOutRef.current) return;
    const provider = user?.providerData?.find(p => p.providerId === 'google' || p.providerId === 'apple');
    const providerName = provider?.providerId === 'google' ? 'Google' : provider?.providerId === 'apple' ? 'Apple' : null;
    const message = providerName
      ? t('auth.logoutConfirmSocial', { provider: providerName })
      : t('auth.logoutConfirm', { defaultValue: '로그아웃 하시겠습니까?' });
    showAlert(
      t('auth.logout'),
      message,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth.logout'),
          style: 'destructive',
          onPress: async () => {
            isLoggingOutRef.current = true;
            setIsLoggingOut(true);
            try {
              await logout();
              navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
            } catch (_) {
              isLoggingOutRef.current = false;
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const handleUpdateProfile = async () => {
    if (!newName.trim()) {
      showAlert(t('common.error'), t('auth.nameRequired', { defaultValue: 'Name is required' }));
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.id !== user.uid) {
      setEditModalVisible(false);
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
      return;
    }

    setIsSaving(true);
    try {
      const trimmedName = newName.trim();
      
      // Use upsert instead of update to handle cases where the profile row doesn't exist yet (common for guests)
      const { error } = await supabase
        .from('profiles')
        .upsert({ 
          uid: user.uid, 
          display_name: trimmedName,
          updated_at: new Date().toISOString()
        }, { onConflict: 'uid' });

      if (error) {
        console.error('[ProfileScreen] Database update error:', error);
        // Even if DB fails, update local state for the current session to show the chosen name
      }
      
      updateUserProfile({ display_name: trimmedName, displayName: trimmedName });
      setEditModalVisible(false);
      showAlert(t('common.success'), t('auth.profileUpdated'));
    } catch (error) {
      console.error('[ProfileScreen] Update error:', error);
      showAlert(t('common.error'), t('auth.updateFailed', { defaultValue: 'Failed to update profile' }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user.email) return;

    showAlert(
      t('auth.changePassword'),
      t('auth.changePasswordConfirm'),
      [
        { text: t('common.cancel', '취소'), style: 'cancel' },
        {
          text: t('common.confirm', '발송'),
          onPress: async () => {
            try {
              await resetPassword(user.email);
              showAlert(t('common.success'), t('auth.resetEmailSent'));
            } catch (error) {
              showAlert(t('common.error'), error.message);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async () => {
    if (isDeletingAccount) return;

    showAlert(
      t('auth.deleteAccount'),
      t('auth.deleteAccountConfirmDetailed', {
        defaultValue: t('auth.deleteAccountConfirm'),
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('auth.deleteAccount'),
          style: 'destructive',
          onPress: async () => {
            setIsDeletingAccount(true);
            try {
              await deleteCurrentUserAccount();
              showAlert(t('common.success'), t('auth.deleteAccountSuccess'));
              navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
            } catch (error) {
              if (isRecentLoginRequired(error)) {
                console.warn('[ProfileScreen] Delete account requires recent login');
                showAlert(
                  t('auth.deleteAccount'),
                  t('auth.deleteAccountRecentLoginRequired', {
                    defaultValue: 'For security, please log in again and then delete your account.',
                  }),
                  [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                      text: t('auth.loginButton', { defaultValue: 'Login' }),
                      onPress: async () => {
                        try {
                          await logout();
                        } finally {
                          navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
                        }
                      },
                    },
                  ]
                );
              } else {
                console.error('[ProfileScreen] Delete account error:', error);
                showAlert(
                  t('common.error'),
                  t('auth.deleteAccountFailed', {
                    defaultValue: 'Failed to delete account. Please try again.',
                  })
                );
              }
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Custom Header */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <View pointerEvents="none">
            <LucideArrowLeft size={24} color={Colors.text} />
          </View>
        </TouchableOpacity>
        <Text style={styles.navTitle}>{t('auth.profile', { defaultValue: 'Profile' })}</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.avatarContainer}>
            {user.profileImage ? (
              <Image source={{ uri: user.profileImage }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <LucideUser size={48} color={Colors.primary} />
              </View>
            )}
          </View>
          <Text style={styles.name}>{user.displayName || (isGuest ? t('auth.guest') : 'User')}</Text>
          {user.email ? (
            <View style={styles.emailContainer}>
              <LucideMail size={14} color={Colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={styles.emailText}>{user.email}</Text>
            </View>
          ) : isGuest ? (
            <View style={styles.guestBadge}>
              <Text style={styles.guestBadgeText}>{t('auth.guest')}</Text>
            </View>
          ) : null}
        </View>

        {/* Account Settings Section */}
        <View style={styles.section}>
          {user.providerData?.some(p => p.providerId === 'password') && (
            <TouchableOpacity style={styles.menuItem} onPress={handleChangePassword}>
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIconContainer, { backgroundColor: '#E3F2FD' }]}>
                  <LucideLock size={20} color="#1976D2" />
                </View>
                <Text style={styles.menuItemText}>{t('auth.changePassword')}</Text>
              </View>
              <LucideChevronRight size={20} color={Colors.outline} />
            </TouchableOpacity>
          )}

          {isGuest && (
            <View style={styles.transferCard}>
              <Text style={styles.transferCardTitle}>{t('auth.transferCode')}</Text>
              <Text style={styles.transferCardDesc}>{t('auth.transferCodeInfo')}</Text>
              {transferCodeData ? (
                <View style={styles.transferCodeBox}>
                  <Text style={styles.transferCodeValue}>
                    {transferCodeData.code.slice(0, 4)}-{transferCodeData.code.slice(4)}
                  </Text>
                  <Text style={styles.transferCodeExpiry}>
                    {t('auth.transferCodeExpiry', {
                      days: Math.ceil((new Date(transferCodeData.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)),
                    })}
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.transferCodeBtn, isGeneratingCode && { opacity: 0.6 }]}
                  onPress={handleGenerateTransferCode}
                  disabled={isGeneratingCode}
                >
                  {isGeneratingCode
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.transferCodeBtnText}>{t('auth.generateTransferCode')}</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Informative Stats or Info can go here in future */}
      </ScrollView>

      {/* Fixed Bottom Footer for Actions */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.editButton, isDeletingAccount && { opacity: 0.5 }]}
          onPress={() => {
            setNewName(user.displayName || (isGuest ? t('auth.guest') : ''));
            setEditModalVisible(true);
          }}
          disabled={isDeletingAccount}
        >
          <LucideUser size={20} color="white" />
          <Text style={styles.editButtonText}>{t('auth.editProfile', { defaultValue: 'Edit Profile' })}</Text>
        </TouchableOpacity>

        {isGuest ? (
          <TouchableOpacity
            style={styles.primaryLoginButton}
            onPress={() => navigation.navigate('Login')}
          >
            <LucideLogOut size={20} color="white" />
            <Text style={styles.primaryLoginButtonText}>{t('auth.loginTitle')}</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.logoutButton, isLoggingOut && { opacity: 0.5 }]}
              onPress={handleLogout}
              disabled={isLoggingOut || isDeletingAccount}
            >
              {isLoggingOut
                ? <ActivityIndicator size="small" color={Colors.error} />
                : <LucideLogOut size={20} color={Colors.error} />
              }
              <Text style={styles.logoutText}>{t('auth.logout', { defaultValue: 'Logout' })}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.deleteAccountBtn, isDeletingAccount && { opacity: 0.6 }]}
              onPress={handleDeleteAccount}
              disabled={isDeletingAccount}
            >
              {isDeletingAccount ? (
                <ActivityIndicator size="small" color={Colors.error} />
              ) : (
                <Text style={styles.deleteAccountBtnText}>{t('auth.deleteAccount')}</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, keyboardHeight > 0 && { marginBottom: keyboardHeight }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={styles.modalCloseBtn}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                activeOpacity={0.7}
              >
                <View pointerEvents="none">
                  <LucideX size={26} color={Colors.text} />
                </View>
              </TouchableOpacity>

              <View style={{ flex: 1 }} />

              <TouchableOpacity
                style={[styles.modalSaveBtn, !newName.trim() && { opacity: 0.5 }]}
                onPress={handleUpdateProfile}
                disabled={isSaving || !newName.trim()}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
                activeOpacity={0.7}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <View pointerEvents="none">
                    <LucideCheck size={26} color={Colors.primary} />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>{t('auth.displayName', { defaultValue: 'Display Name' })}</Text>
              <TextInput
                style={styles.input}
                value={newName}
                onChangeText={setNewName}
                placeholder={t('auth.enterName', { defaultValue: 'Enter your name' })}
                autoFocus={true}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleUpdateProfile}
              />
            </View>
          </View>
        </View>
      </Modal>
      <ConfirmModal
        visible={!!confirmConfig}
        title={confirmConfig?.title}
        message={confirmConfig?.message}
        options={confirmConfig?.options || []}
        onDismiss={() => setConfirmConfig(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    height: 56,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
  },
  headerCard: {
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 32,
    padding: Spacing.xl,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 4,
    marginBottom: Spacing.xl,
  },
  avatarContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    borderWidth: 4,
    borderColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  avatar: {
    width: 102,
    height: 102,
    borderRadius: 51,
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.surfaceContainerLow,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: 4,
  },
  emailContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  emailText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    marginLeft: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 20,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuItemText: {
    ...Typography.body,
    color: Colors.text,
    fontWeight: '500',
  },
  footer: {
    padding: Spacing.lg,
    paddingBottom: Platform.OS === 'ios' ? Spacing.lg : Spacing.xl,
    gap: 12,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: 20,
    gap: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 6,
  },
  editButtonText: {
    ...Typography.body,
    color: 'white',
    fontWeight: '700',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  logoutText: {
    ...Typography.body,
    color: Colors.error,
    fontWeight: '600',
  },
  deleteAccountBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 8,
  },
  deleteAccountBtnText: {
    fontSize: 13,
    color: Colors.outline,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: Spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 60 : 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  modalCloseBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  modalSaveBtn: {
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
  },
  guestBadge: {
    backgroundColor: Colors.surfaceContainer,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  guestBadgeText: {
    ...Typography.label,
    color: Colors.outline,
    fontWeight: '600',
  },
  primaryLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: 18,
    borderRadius: 20,
    gap: 10,
    marginTop: 8,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  primaryLoginButtonText: {
    ...Typography.body,
    color: 'white',
    fontWeight: '700',
  },
  transferCard: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 20,
    padding: 20,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    gap: 8,
  },
  transferCardTitle: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.text,
  },
  transferCardDesc: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 4,
  },
  transferCodeBox: {
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.outlineVariant,
    gap: 4,
  },
  transferCodeValue: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary,
    letterSpacing: 4,
  },
  transferCodeExpiry: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  transferCodeBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  transferCodeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: 'white',
  },
});

export default ProfileScreen;
