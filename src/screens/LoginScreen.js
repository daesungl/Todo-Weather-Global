import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import appleAuth from '@invertase/react-native-apple-authentication';
import ConfirmModal from '../components/ConfirmModal';

const GoogleIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 48 48" pointerEvents="none">
    <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    <Path fill="none" d="M0 0h48v48H0z" />
  </Svg>
);

const AppleIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 814 1000" pointerEvents="none">
    <Path
      fill="#FFFFFF"
      d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 405.5 3.6 269.7 3.6 145.5c0-72.2 23.2-145.5 65.6-204.5 37.7-52.2 97.8-87.4 163.4-87.4 63.2 0 113.3 43.9 167.4 43.9 51.7 0 111.7-47.5 175.1-47.5 24.9 0 108.2 2.6 168.3 80.9zm-202.8-99.1c-25.2-31.3-65-54.2-107.8-54.2-8.3 0-16.7 1.3-24.4 2.6 2.6-29 17.3-55.7 35.1-75.9 21.8-24.4 59.4-43.2 92.9-43.2 3.2 0 6.4 0 8.9 1.3-2.5 29-16 57-28.3 74.4-13.1 18.6-32.1 35-76.4 95z"
    />
  </Svg>
);

const LoginScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { signInWithGoogle, signInWithApple, continueAsGuest } = useAuth();
  const insets = useSafeAreaInsets();
  const [socialLoading, setSocialLoading] = useState(null);
  const [confirmConfig, setConfirmConfig] = useState(null);

  const showAlert = (title, message, options) => {
    setConfirmConfig({ title, message: message || '', options: options || [{ text: t('common.confirm'), style: 'default' }] });
  };

  const navigateAfterAuth = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
  };

  const handleGoogleSignIn = async () => {
    setSocialLoading('google');
    try {
      const result = await signInWithGoogle();
      if (result) navigateAfterAuth();
    } catch (error) {
      showAlert(t('common.error'), error.message);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    setSocialLoading('apple');
    try {
      await signInWithApple();
      navigateAfterAuth();
    } catch (error) {
      if (error.code !== '1001') showAlert(t('common.error'), error.message);
    } finally {
      setSocialLoading(null);
    }
  };

  const handleGuest = () => {
    continueAsGuest();
    navigateAfterAuth();
  };

  const isAppleSupported = Platform.OS === 'ios' && appleAuth.isSupported;
  const anyLoading = socialLoading !== null;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {navigation.canGoBack() && (
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 12 }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" pointerEvents="none">
            <Path d="M15 18l-6-6 6-6" stroke="#333" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </TouchableOpacity>
      )}
      <View style={styles.card}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.appName}>Todo Weather</Text>
          <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>
        </View>

        {/* Social Buttons */}
        <View style={styles.socialButtons}>
          <TouchableOpacity
            style={[styles.socialBtn, styles.googleBtn]}
            onPress={handleGoogleSignIn}
            disabled={anyLoading}
            activeOpacity={0.8}
          >
            {socialLoading === 'google' ? (
              <ActivityIndicator color="#333" size="small" />
            ) : (
              <GoogleIcon />
            )}
            <Text style={styles.googleBtnText}>{t('auth.continueWithGoogle')}</Text>
          </TouchableOpacity>

          {isAppleSupported && (
            <TouchableOpacity
              style={[styles.socialBtn, styles.appleBtn]}
              onPress={handleAppleSignIn}
              disabled={anyLoading}
              activeOpacity={0.8}
            >
              {socialLoading === 'apple' ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <AppleIcon />
              )}
              <Text style={styles.appleBtnText}>{t('auth.continueWithApple')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{t('auth.orContinueWith')}</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Guest */}
        <TouchableOpacity style={styles.guestBtn} onPress={handleGuest} disabled={anyLoading} activeOpacity={0.7}>
          <Text style={styles.guestBtnText}>{t('auth.continueAsGuest')}</Text>
        </TouchableOpacity>
      </View>

      <ConfirmModal
        visible={!!confirmConfig}
        title={confirmConfig?.title}
        message={confirmConfig?.message}
        options={confirmConfig?.options || []}
        onDismiss={() => setConfirmConfig(null)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#b2ebf2', justifyContent: 'center', padding: 20 },
  backBtn: {
    position: 'absolute',
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 28,
    padding: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  header: { alignItems: 'center', marginBottom: 32 },
  appName: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#888', marginTop: 6, textAlign: 'center' },
  socialButtons: { gap: 12, marginBottom: 24 },
  socialBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    gap: 10,
  },
  googleBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e0e0e0' },
  googleBtnText: { fontSize: 15, fontWeight: '600', color: '#333' },
  appleBtn: { backgroundColor: '#000' },
  appleBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e8e8e8' },
  dividerText: { marginHorizontal: 12, fontSize: 12, color: '#aaa' },
  guestBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestBtnText: { fontSize: 15, fontWeight: '600', color: '#555' },
});

export default LoginScreen;
