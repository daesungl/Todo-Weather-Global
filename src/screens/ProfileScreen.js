import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  SafeAreaView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
} from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { LucideLogOut, LucideUser, LucideArrowLeft, LucideX, LucideCheck, LucideChevronRight, LucideLock, LucideMail } from 'lucide-react-native';
import firestore from '@react-native-firebase/firestore';
import { Colors, Spacing, Typography } from '../theme';

const ProfileScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { user, logout, resetPassword } = useAuth();
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [newName, setNewName] = useState(user?.displayName || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const isLoggingOutRef = React.useRef(false);

  if (!user) return null;

  const handleLogout = async () => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    setIsLoggingOut(true);
    try {
      await logout();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (_) {
      isLoggingOutRef.current = false;
      setIsLoggingOut(false);
    }
  };

  const handleUpdateProfile = async () => {
    if (!newName.trim()) {
      Alert.alert(t('common.error'), t('auth.nameRequired', { defaultValue: 'Name is required' }));
      return;
    }

    setIsSaving(true);
    try {
      // update 대신 set과 merge옵션을 사용하여, 문서가 없으면 자동 생성되도록 처리 (not-found 에러 방지)
      await firestore().collection('users').doc(user.uid).set({
        displayName: newName.trim(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      setEditModalVisible(false);
      Alert.alert(t('common.success'), t('auth.profileUpdated'));
    } catch (error) {
      console.error('[ProfileScreen] Update error details:', error);
      Alert.alert(t('common.error'), t('auth.updateFailed', { defaultValue: 'Failed to update profile' }));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!user.email) return;

    Alert.alert(
      t('auth.changePassword'),
      t('auth.changePasswordConfirm'),
      [
        { text: t('common.cancel', '취소'), style: 'cancel' },
        { 
          text: t('common.confirm', '발송'), 
          onPress: async () => {
            try {
              await resetPassword(user.email);
              Alert.alert(t('common.success'), t('auth.resetEmailSent'));
            } catch (error) {
              Alert.alert(t('common.error'), error.message);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Header */}
      <View style={styles.navBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <LucideArrowLeft size={24} color={Colors.text} />
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
          <Text style={styles.name}>{user.displayName || 'User'}</Text>
          <View style={styles.emailContainer}>
            <LucideMail size={14} color={Colors.textSecondary} style={{ marginRight: 4 }} />
            <Text style={styles.emailText}>{user.email}</Text>
          </View>
        </View>

        {/* Account Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('auth.accountSettings')}</Text>
          
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
        </View>

        {/* Informative Stats or Info can go here in future */}
      </ScrollView>

      {/* Fixed Bottom Footer for Actions */}
      <View style={styles.footer}>
        <TouchableOpacity 
          style={styles.editButton} 
          onPress={() => {
            setNewName(user.displayName || '');
            setEditModalVisible(true);
          }}
        >
          <LucideUser size={20} color="white" />
          <Text style={styles.editButtonText}>{t('auth.editProfile', { defaultValue: 'Edit Profile' })}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.logoutButton, isLoggingOut && { opacity: 0.5 }]}
          onPress={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut
            ? <ActivityIndicator size="small" color={Colors.error} />
            : <LucideLogOut size={20} color={Colors.error} />
          }
          <Text style={styles.logoutText}>{t('auth.logout', { defaultValue: 'Logout' })}</Text>
        </TouchableOpacity>
      </View>

      {/* Edit Profile Modal */}
      <Modal
        visible={isEditModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.modalCloseBtn}>
                <LucideX size={24} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>{t('auth.editProfile', { defaultValue: 'Edit Profile' })}</Text>
              <TouchableOpacity 
                style={[styles.modalSaveBtn, !newName.trim() && { opacity: 0.5 }]} 
                onPress={handleUpdateProfile} 
                disabled={isSaving || !newName.trim()}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <LucideCheck size={24} color={Colors.primary} />
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
              />
            </View>
          </View>
        </View>
      </Modal>
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
    padding: 4,
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text,
  },
  modalSaveBtn: {
    padding: 4,
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
});

export default ProfileScreen;
