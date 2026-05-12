import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import appleAuth from '@invertase/react-native-apple-authentication';
import i18n from '../i18n';
import { initFlowSync } from '../services/FlowSyncService';
import { initRegionSync } from '../services/weather/RegionSyncService';
import { initTaskSync } from '../services/task/TaskSyncService';
import { supabase } from '../config/supabaseConfig';
import { IS_SUPABASE_DEV } from '../constants/SupabaseEnv';

GoogleSignin.configure({
  webClientId: IS_SUPABASE_DEV
    ? '135255276638-cqps0rnc7kg3ka5lvfpml6v030rk20nr.apps.googleusercontent.com'
    : '156613478220-3jfcb8hp1mhbpvs1196gc0s6356u13fp.apps.googleusercontent.com',
  iosClientId: IS_SUPABASE_DEV
    ? '135255276638-cqps0rnc7kg3ka5lvfpml6v030rk20nr.apps.googleusercontent.com'
    : '156613478220-7k0jed2lfpt8g13khlcavkv77qgcjuhb.apps.googleusercontent.com',
  offlineAccess: false,
});

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncLoading, setSyncLoading] = useState(false);
  const activeAuthUidRef = useRef(null);

  useEffect(() => {
    let profileSubscription = null;
    let isCreatingAnon = false;

    const setupUser = async (session) => {
      if (!session?.user) {
        if (profileSubscription) {
          supabase?.removeChannel(profileSubscription);
          profileSubscription = null;
        }
        if (isCreatingAnon) return;
        isCreatingAnon = true;
        const { error } = await supabase.auth.signInAnonymously();
        isCreatingAnon = false;
        if (error) {
          // Network offline or Supabase unavailable — fall back to offline mode
          activeAuthUidRef.current = null;
          initFlowSync(null);
          initRegionSync(null);
          initTaskSync(null);
          setUser(null);
          setIsGuest(true);
          setSyncLoading(false);
          setLoading(false);
        }
        // On success, onAuthStateChange fires setupUser with the new anon session
        return;
      }

      const currentUser = session.user;
      activeAuthUidRef.current = currentUser.id;
      const isAnonymous = currentUser.is_anonymous === true;
      setIsGuest(isAnonymous);

      try {
        const { data: profileData, error: fetchError } = await supabase
          .from('profiles')
          .select('*')
          .eq('uid', currentUser.id)
          .single();

        let profile = profileData || {};

        if (fetchError && fetchError.code === 'PGRST116') { // not found
          const guestName = i18n.t('auth.guest', 'Guest');
          const randomId = Math.floor(1000 + Math.random() * 9000);
          const displayName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || currentUser.email?.split('@')[0] || (isAnonymous ? `${guestName} #${randomId}` : 'User');
          const profileImage = currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || '';

          profile = {
            uid: currentUser.id,
            email: currentUser.email || '',
            display_name: displayName,
            photo_url: profileImage,
          };
          
          await supabase.from('profiles').insert(profile);
        } else if (profileData) {
           const metaName = currentUser.user_metadata?.full_name || currentUser.user_metadata?.name;
           // Prioritize database display_name if it exists
           const displayName = profileData.display_name || metaName || (isAnonymous ? 'Guest' : 'User');
           const profileImage = currentUser.user_metadata?.avatar_url || currentUser.user_metadata?.picture || profileData.photo_url;
           
           // Only update DB if profile is missing photo or name and we have it from metadata
           if (!profileData.display_name && metaName) {
              await supabase.from('profiles').update({ display_name: metaName, photo_url: profileImage }).eq('uid', currentUser.id);
              profile.display_name = metaName;
           } else {
              profile.display_name = displayName;
           }
           profile.photo_url = profileImage;
        }

        setUser({
          uid: currentUser.id,
          email: currentUser.email,
          displayName: profile.display_name || currentUser.user_metadata?.full_name || currentUser.user_metadata?.name || '',
          emailVerified: !!currentUser.email_confirmed_at || currentUser.app_metadata?.provider !== 'email',
          photoURL: profile.photo_url || currentUser.user_metadata?.avatar_url || '',
          providerData: currentUser.app_metadata?.providers?.map(p => ({ providerId: p === 'email' ? 'password' : p })) || [],
          isAnonymous,
          ...profile,
        });

        setLoading(false);
        setSyncLoading(true);

        Promise.all([
          initFlowSync(currentUser.id),
          initRegionSync(currentUser.id),
          initTaskSync(currentUser.id),
        ]).catch(error => {
          console.warn('[AuthContext] Background sync init error:', error);
        }).finally(() => {
          setSyncLoading(false);
        });

        if (profileSubscription) {
          supabase.removeChannel(profileSubscription);
        }

        profileSubscription = supabase
          .channel('public:users:profile')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'profiles', filter: `uid=eq.${currentUser.id}` },
            (payload) => {
              if (payload.new) {
                setUser((prev) => ({
                  ...prev,
                  ...payload.new,
                }));
              }
            }
          )
          .subscribe();

      } catch (error) {
        console.error('[AuthContext] Error setting up user:', error);
        setLoading(false);
      }
    };

    supabase?.auth.getSession().then(({ data: { session } }) => {
      setupUser(session);
    });

    const { data: { subscription } } = supabase?.auth.onAuthStateChange((_event, session) => {
      setupUser(session);
    }) || { data: { subscription: { unsubscribe: () => {} } } };

    return () => {
      if (profileSubscription) supabase?.removeChannel(profileSubscription);
      subscription.unsubscribe();
    };
  }, []);

  const getAuthErrorMessage = (error) => {
    switch (error.message) {
      case 'User already registered':
        return i18n.t('auth.errors.emailInUse');
      case 'Invalid email':
        return i18n.t('auth.errors.invalidEmail');
      case 'Password should be at least 6 characters':
        return i18n.t('auth.errors.weakPassword');
      case 'Invalid login credentials':
        return i18n.t('auth.errors.invalidCredential');
      case 'Email not confirmed':
        return i18n.t('auth.errors.verificationRequired');
      default:
        return error.message || i18n.t('auth.errors.default');
    }
  };

  const throwAuthError = (error) => {
    const wrapped = new Error(getAuthErrorMessage(error));
    wrapped.code = error.code || error.status;
    throw wrapped;
  };

  const continueAsGuest = () => {
    // No-op: anonymous Supabase session is created automatically on app start.
    // Navigation back to the main screen is handled by the caller.
  };

  const logout = async () => {
    try {
      const isSignedIn = await GoogleSignin.isSignedIn();
      if (isSignedIn) await GoogleSignin.signOut();
    } catch (_) { }

    const { error } = await supabase.auth.signOut();
    if (error) console.warn('[AuthContext] signOut error:', error);
    // onAuthStateChange fires with null session → setupUser creates new anonymous session
  };

  const signInWithGoogle = async () => {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const response = await GoogleSignin.signIn();
      if (response.type !== 'success') return null;
      const { idToken } = response.data;

      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserIsAnon = sessionData?.session?.user?.is_anonymous === true;

      if (currentUserIsAnon) {
        const { data, error } = await supabase.auth.linkIdentityIdToken({
          provider: 'google',
          token: idToken,
        });
        if (!error) return data;
        // Identity already linked to another account — fall through to regular sign-in
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });
      if (error) throw error;
      return data;
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
    try {
      const rawNonce = Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 36).toString(36)
      ).join('');

      // Apple hashes the nonce internally before embedding in id_token.
      // Pass raw nonce to Apple and to Supabase — Supabase hashes it for comparison.
      const appleAuthResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.EMAIL, appleAuth.Scope.FULL_NAME],
        nonce: rawNonce,
      });
      const { identityToken } = appleAuthResponse;
      if (!identityToken) throw new Error('Apple Sign-In failed - no identity token');

      const { data: sessionData } = await supabase.auth.getSession();
      const currentUserIsAnon = sessionData?.session?.user?.is_anonymous === true;

      if (currentUserIsAnon) {
        const { data, error } = await supabase.auth.linkIdentityIdToken({
          provider: 'apple',
          token: identityToken,
          nonce: rawNonce,
        });
        if (!error) return data;
        // Identity already linked — fall through to regular sign-in
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
        nonce: rawNonce,
      });
      if (error) throw error;
      return data;
    } catch (error) {
      if (error.code !== '1001') {
        throw new Error(getAuthErrorMessage(error));
      }
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isGuest,
      loading,
      syncLoading,
      logout,
      continueAsGuest,
      signInWithGoogle,
      signInWithApple,
      updateUserProfile: (patch) => setUser(prev => prev ? { ...prev, ...patch } : prev),
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
