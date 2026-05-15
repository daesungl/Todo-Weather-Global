import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');
const TOAST_SPACING = 42;
const TOAST_FADE_MS = 220;
const TOAST_VISIBLE_MS = 2600;
const DEFAULT_TOP = Constants.statusBarHeight + 72;

const ToastItem = React.memo(({ toast, top, onDone }) => {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: TOAST_FADE_MS, useNativeDriver: true }),
      Animated.delay(TOAST_VISIBLE_MS),
      Animated.timing(opacity, { toValue: 0, duration: TOAST_FADE_MS, useNativeDriver: true }),
    ]);
    anim.start(() => onDone(toast.id));
    return () => anim.stop();
  }, [onDone, opacity, toast.id]);

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: toast.targetY,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [toast.targetY, translateY]);

  return (
    <Animated.View style={[styles.toastContainer, { opacity, transform: [{ translateY }], top }]}>
      <Text style={styles.toastText}>{toast.message}</Text>
    </Animated.View>
  );
});

export const useToastStack = () => {
  const [toasts, setToasts] = useState([]);
  const toastIdCounter = useRef(0);

  const showToast = useCallback((message) => {
    if (!message) return;
    const id = toastIdCounter.current++;
    setToasts(prev => {
      const shifted = prev.map(toast => ({ ...toast, targetY: toast.targetY + TOAST_SPACING }));
      return [...shifted, { id, message, targetY: 0 }];
    });
  }, []);

  const handleToastDone = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return { toasts, showToast, clearToasts, handleToastDone };
};

const ToastStack = ({ toasts, onDone, top = DEFAULT_TOP }) => {
  if (!toasts?.length) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          top={top}
          onDone={onDone}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
  toastContainer: {
    position: 'absolute',
    alignSelf: 'center',
    maxWidth: width - 48,
    backgroundColor: 'rgba(30,30,30,0.88)',
    borderRadius: 22,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default ToastStack;
