import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import appleAuth from '@invertase/react-native-apple-authentication';
import i18n from '../i18n';
import { initFlowSync } from '../services/FlowSyncService';
import { initRegionSync } from '../services/weather/RegionSyncService';
import { initTaskSync } from '../services/task/TaskSyncService';

// Firebase Console > Authentication > Sign-in method > Google > Web SDK configuration > Web client ID
// Google 로그인 활성화 후 Firebase Console에서 확인 가능
GoogleSignin.configure({
  webClientId: '156613478220-3jfcb8hp1mhbpvs1196gc0s6356u13fp.apps.googleusercontent.com',
  offlineAccess: true,
});

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const unsubscribeSnapshot = useRef(null);
  const isLoggingOutRef = useRef(false);
  const activeAuthUidRef = useRef(null);

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged(async (currentUser) => {
      // 새로운 상태가 오면 기존 감시자부터 종료
      if (unsubscribeSnapshot.current) {
        unsubscribeSnapshot.current();
        unsubscribeSnapshot.current = null;
      }

      if (currentUser && isLoggingOutRef.current) {
        // 로그아웃 진행 중 토큰 갱신 등으로 재발화된 경우 무시
        return;
      }

      if (currentUser) {
        activeAuthUidRef.current = currentUser.uid;
        const isCurrentAuthUser = () =>
          !isLoggingOutRef.current
          && activeAuthUidRef.current === currentUser.uid
          && auth().currentUser?.uid === currentUser.uid;

        // 이메일 비밀번호 가입자 중 인증을 안 한 사용자는 데이터 로드 및 UI 진입을 완벽히 차단
        const isPasswordAuth = currentUser.providerData.some(p => p.providerId === 'password');
        if (isPasswordAuth && !currentUser.emailVerified) {
          activeAuthUidRef.current = null;
          setUser(null);
          setIsGuest(false);
          initFlowSync(null);
          initRegionSync(null);
          initTaskSync(null);
          auth().signOut().catch(() => {});
          setLoading(false);
          return;
        }

        setIsGuest(false); // 실제 사용자가 생기면 게스트 모드 해제
        try {
          const userRef = firestore().collection('users').doc(currentUser.uid);
          
          const doc = await userRef.get();
          if (!isCurrentAuthUser()) return;

          const displayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
          const profileImage = currentUser.photoURL || '';

          const userData = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName,
            profileImage,
            updatedAt: firestore.FieldValue.serverTimestamp(),
          };

          if (!doc.exists) {
            userData.createdAt = firestore.FieldValue.serverTimestamp();
            await userRef.set(userData);
          } else {
            // 정보가 바뀌었을 때만 업데이트
            const existing = doc.data();
            if (existing.displayName !== displayName || existing.profileImage !== profileImage) {
              await userRef.update({ displayName, profileImage, updatedAt: firestore.FieldValue.serverTimestamp() });
            }
          }
          if (!isCurrentAuthUser()) return;

          await Promise.all([
            initFlowSync(currentUser.uid),
            initRegionSync(currentUser.uid),
            initTaskSync(currentUser.uid),
          ]);

          // 비동기 작업 대기 중 로그아웃이 완료됐으면 snapshot 등록 자체를 건너뜀
          if (!isCurrentAuthUser()) return;

          unsubscribeSnapshot.current = userRef.onSnapshot((snapshot) => {
            if (!isCurrentAuthUser()) return;
            if (snapshot.exists) {
              const data = snapshot.data();
              // 클래스 인스턴스 대신 명시적으로 필드를 병합하여 데이터 유실 방지
              setUser({
                uid: currentUser.uid,
                email: currentUser.email,
                emailVerified: currentUser.emailVerified,
                providerData: currentUser.providerData,
                photoURL: currentUser.photoURL,
                ...data
              });
            } else {
              setUser({
                uid: currentUser.uid,
                email: currentUser.email,
                emailVerified: currentUser.emailVerified,
                providerData: currentUser.providerData,
              });
            }
          }, (error) => {
            if (!isCurrentAuthUser()) return;
            if (error.code === 'firestore/permission-denied') {
              // 권한 에러 시에도 기본 정보는 유지
              setUser({
                uid: currentUser.uid,
                email: currentUser.email,
                emailVerified: currentUser.emailVerified,
                providerData: currentUser.providerData,
              });
              return;
            }
            console.error('[AuthContext] Snapshot error:', error);
          });
        } catch (error) {
          if (!isCurrentAuthUser()) return;
          console.error('[AuthContext] Error in onAuthStateChanged:', error);
          setUser({
            uid: currentUser.uid,
            email: currentUser.email,
            emailVerified: currentUser.emailVerified,
            providerData: currentUser.providerData,
          });
        } finally {
          setLoading(false);
        }
      } else {
        activeAuthUidRef.current = null;
        isLoggingOutRef.current = false;
        initFlowSync(null);
        initRegionSync(null);
        initTaskSync(null);
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribeSnapshot.current) unsubscribeSnapshot.current();
      subscriber();
    };
  }, []);

  const getAuthErrorMessage = (error) => {
    switch (error.code) {
      case 'auth/email-already-in-use':
        return i18n.t('auth.errors.emailInUse');
      case 'auth/invalid-email':
        return i18n.t('auth.errors.invalidEmail');
      case 'auth/operation-not-allowed':
        return i18n.t('auth.errors.default');
      case 'auth/weak-password':
        return i18n.t('auth.errors.weakPassword');
      case 'auth/user-disabled':
        return i18n.t('auth.errors.userDisabled');
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return i18n.t('auth.errors.invalidCredential');
      case 'auth/too-many-requests':
        return i18n.t('auth.errors.tooManyRequests');
      case 'auth/email-not-verified':
        return i18n.t('auth.errors.verificationRequired');
      default:
        return error.message || i18n.t('auth.errors.default');
    }
  };

  const login = async (email, password) => {
    isLoggingOutRef.current = false;
    try {
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      // 이메일 인증 여부 확인 (소셜 로그인은 이미 인증된 것으로 간주됨)
      if (userCredential.user && !userCredential.user.emailVerified && userCredential.user.providerData.some(p => p.providerId === 'password')) {
        // 인증되지 않은 이메일 계정인 경우, 세션을 종료하고 에러 발생
        await auth().signOut();
        throw { code: 'auth/email-not-verified' };
      }
      return userCredential;
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const signup = async (email, password) => {
    try {
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      // 가입 성공 후 인증 메일 발송
      if (userCredential.user) {
        await userCredential.user.sendEmailVerification();
        // 가입 직후 자동 로그인이 되므로, 인증 전 접근을 막기 위해 즉시 로그아웃 처리
        await auth().signOut();
      }
      return userCredential;
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const resetPassword = async (email) => {
    try {
      await auth().sendPasswordResetEmail(email);
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const resendVerificationEmail = async (email, password) => {
    try {
      // 재발송을 위해 임시로 로그인
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      if (userCredential.user) {
        await userCredential.user.sendEmailVerification();
        await auth().signOut(); // 즉시 로그아웃
      }
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const continueAsGuest = () => {
    activeAuthUidRef.current = null;
    setIsGuest(true);
    setUser(null);
    initFlowSync(null);
    initRegionSync(null);
    initTaskSync(null);
  };

  const logout = async () => {
    isLoggingOutRef.current = true;
    activeAuthUidRef.current = null;

    if (unsubscribeSnapshot.current) {
      unsubscribeSnapshot.current();
      unsubscribeSnapshot.current = null;
    }

    setUser(null);
    setIsGuest(true);
    initFlowSync(null);
    initRegionSync(null);
    initTaskSync(null);

    try {
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (isSignedIn) await GoogleSignin.signOut();
    } catch (_) { }

    try {
      if (auth().currentUser) {
        await auth().signOut();
      }
    } catch (e) {
      if (e.code !== 'auth/no-current-user') {
        console.warn('[AuthContext] signOut error:', e);
        isLoggingOutRef.current = false;
        throw e;
      }
    }
  };

  const signInWithGoogle = async () => {
    isLoggingOutRef.current = false;
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (response.type !== 'success') {
        return null; // 취소됨
      }
      const { idToken } = response.data;
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      return auth().signInWithCredential(googleCredential);
    } catch (error) {
      const isCancelled =
        error.code === 'SIGN_IN_CANCELLED' ||
        error.code === 'sign_in_cancelled' ||
        error.statusCode === 12;
      if (isCancelled) return null;
      throw new Error(getAuthErrorMessage(error));
    }
  };

  const signInWithApple = async () => {
    isLoggingOutRef.current = false;
    try {
      const appleAuthResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
      });
      const { identityToken, nonce } = appleAuthResponse;
      if (!identityToken) throw new Error('Apple Sign-In failed - no identity token');
      const appleCredential = auth.AppleAuthProvider.credential(identityToken, nonce);
      return auth().signInWithCredential(appleCredential);
    } catch (error) {
      throw new Error(getAuthErrorMessage(error));
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isGuest, 
      loading, 
      login, 
      signup, 
      resetPassword,
      resendVerificationEmail,
      logout, 
      continueAsGuest,
      signInWithGoogle, 
      signInWithApple 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
