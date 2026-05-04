import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { LucideMail, LucideLock } from 'lucide-react-native';
import appleAuth from '@invertase/react-native-apple-authentication';
import auth from '@react-native-firebase/auth';

const GoogleIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 48 48">
    <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    <Path fill="none" d="M0 0h48v48H0z" />
  </Svg>
);

const AppleIcon = () => (
  <Svg width={20} height={20} viewBox="0 0 814 1000">
    <Path
      fill="#FFFFFF"
      d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 405.5 3.6 269.7 3.6 145.5c0-72.2 23.2-145.5 65.6-204.5 37.7-52.2 97.8-87.4 163.4-87.4 63.2 0 113.3 43.9 167.4 43.9 51.7 0 111.7-47.5 175.1-47.5 24.9 0 108.2 2.6 168.3 80.9zm-202.8-99.1c-25.2-31.3-65-54.2-107.8-54.2-8.3 0-16.7 1.3-24.4 2.6 2.6-29 17.3-55.7 35.1-75.9 21.8-24.4 59.4-43.2 92.9-43.2 3.2 0 6.4 0 8.9 1.3-2.5 29-16 57-28.3 74.4-13.1 18.6-32.1 35-76.4 95z"
    />
  </Svg>
);

const LoginScreen = ({ navigation }) => {
  const { t } = useTranslation();
  const { login, signup, resetPassword, resendVerificationEmail, signInWithGoogle, signInWithApple, continueAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(null); // 'google' | 'apple' | null

  const handleSubmit = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('auth.emptyFields', { defaultValue: 'Please fill in all fields' }));
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      Alert.alert(t('common.error'), t('auth.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        try {
          await login(email, password);
          navigation.goBack();
        } catch (error) {
          // 이메일 미인증 에러인 경우 재발송 옵션 제공
          if (error.message.includes('이메일 인증이 필요합니다')) {
            Alert.alert(
              t('auth.verificationRequired'),
              t('auth.resendVerificationMsg'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                { 
                  text: t('auth.resendEmail'), 
                  onPress: async () => {
                    try {
                      // 개선된 재발송 함수 사용
                      await resendVerificationEmail(email, password);
                      Alert.alert(t('common.success'), t('auth.verificationSent'));
                    } catch (resendError) {
                      Alert.alert(t('common.error'), resendError.message);
                    }
                  }
                }
              ]
            );
            return;
          }
          throw error;
        }
      } else {
        await signup(email, password);
        Alert.alert(
          t('common.success'), 
          t('auth.verificationSent')
        );
        setIsLogin(true); // 가입 성공 후 로그인 모드로 전환
        setConfirmPassword(''); // 필드 초기화
      }
    } catch (error) {
      Alert.alert(t('common.error'), error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert(t('common.error'), t('auth.enterEmailReset'));
      return;
    }
    try {
      await resetPassword(email);
      Alert.alert(t('common.success'), t('auth.resetEmailSent'));
    } catch (error) {
      Alert.alert(t('common.error'), error.message);
    }
  };

  const handleGoogleSignIn = async () => {
    setSocialLoading('google');
    try {
      await signInWithGoogle();
      navigation.goBack();
    } catch (error) {
      if (error.message !== 'Google Sign-In cancelled') {
        Alert.alert(t('common.error'), error.message);
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const handleAppleSignIn = async () => {
    setSocialLoading('apple');
    try {
      await signInWithApple();
      navigation.goBack();
    } catch (error) {
      if (error.code !== '1001') { // 1001 = user cancelled
        Alert.alert(t('common.error'), error.message);
      }
    } finally {
      setSocialLoading(null);
    }
  };

  const isAppleSupported = Platform.OS === 'ios' && appleAuth.isSupported;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <View style={styles.card}>
            <Text style={styles.title}>
              {isLogin ? t('auth.loginTitle') : t('auth.signupTitle')}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin ? t('auth.loginSubtitle') : t('auth.signupSubtitle')}
            </Text>

            <View style={styles.inputContainer}>
              <LucideMail size={20} color="#666" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.email')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <View style={styles.inputContainer}>
              <LucideLock size={20} color="#666" style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder={t('auth.password')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {isLogin && (
              <TouchableOpacity 
                style={styles.forgotButton}
                onPress={handleResetPassword}
              >
                <Text style={styles.forgotText}>{t('auth.forgotPassword')}</Text>
              </TouchableOpacity>
            )}

            {!isLogin && (
              <View style={styles.inputContainer}>
                <LucideLock size={20} color="#666" style={styles.icon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.confirmPassword')}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>
            )}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading || socialLoading !== null}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>
                  {isLogin ? t('auth.loginButton') : t('auth.signupButton')}
                </Text>
              )}
            </TouchableOpacity>

            {/* 소셜 로그인 구분선 */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('auth.orContinueWith')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              {/* Google 로그인 */}
              <TouchableOpacity
                style={[styles.socialIconButton, styles.googleIconButton]}
                onPress={handleGoogleSignIn}
                disabled={loading || socialLoading !== null}
              >
                {socialLoading === 'google' ? (
                  <ActivityIndicator color="#333" size="small" />
                ) : (
                  <GoogleIcon />
                )}
              </TouchableOpacity>

              {/* Apple 로그인 */}
              {isAppleSupported && (
                <TouchableOpacity
                  style={[styles.socialIconButton, styles.appleIconButton]}
                  onPress={handleAppleSignIn}
                  disabled={loading || socialLoading !== null}
                >
                  {socialLoading === 'apple' ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <AppleIcon />
                  )}
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => setIsLogin(!isLogin)}
            >
              <Text style={styles.switchText}>
                {isLogin ? t('auth.noAccount') : t('auth.hasAccount')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.guestButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.guestText}>{t('common.cancel', { defaultValue: '취소' })}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#b2ebf2',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 24,
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  icon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    marginBottom: 20,
    marginTop: -8,
  },
  forgotText: {
    color: '#469dd3',
    fontSize: 13,
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#469dd3',
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#469dd3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e0e0e0',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: '#999',
  },
  socialRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 10,
  },
  socialIconButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  googleIconButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  appleIconButton: {
    backgroundColor: '#000',
  },
  switchButton: {
    marginTop: 15,
    alignItems: 'center',
  },
  switchText: {
    color: '#469dd3',
    fontSize: 14,
    fontWeight: '500',
  },
  guestButton: {
    marginTop: 25,
    alignItems: 'center',
    paddingVertical: 10,
  },
  guestText: {
    color: '#888',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});

export default LoginScreen;
