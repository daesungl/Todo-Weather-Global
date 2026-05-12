import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Dimensions, Platform } from 'react-native';
import { Colors, Typography } from '../theme';

const { width } = Dimensions.get('window');

// options: [{ text, onPress, style: 'default'|'cancel'|'destructive' }]
// When options has 2 items → side-by-side buttons
// When options has 3+ items → stacked buttons (action sheet style)
export default function ConfirmModal({ visible, title, message, options = [], onDismiss }) {
  const cancelOption = options.find(o => o.style === 'cancel');
  const actionOptions = options.filter(o => o.style !== 'cancel');
  const stacked = actionOptions.length >= 2;

  const handlePress = (option) => {
    if (onDismiss) onDismiss();
    if (option.onPress) setTimeout(option.onPress, 80);
  };

  const handleCancel = () => {
    if (onDismiss) onDismiss();
    if (cancelOption?.onPress) cancelOption.onPress();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {!!title && <Text style={styles.title}>{title}</Text>}
          {!!message && <Text style={styles.message}>{message}</Text>}

          {stacked ? (
            <View style={styles.stackedActions}>
              {actionOptions.map((opt, i) => (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.stackedBtn,
                    opt.style === 'destructive' && styles.destructiveBtn,
                    { opacity: pressed ? 0.75 : 1 },
                  ]}
                  onPress={() => handlePress(opt)}
                >
                  <Text style={opt.style === 'destructive' ? styles.destructiveBtnText : styles.stackedBtnText}>
                    {opt.text}
                  </Text>
                </Pressable>
              ))}
              {cancelOption && (
                <Pressable
                  style={({ pressed }) => [styles.stackedBtn, styles.cancelStackedBtn, { opacity: pressed ? 0.75 : 1 }]}
                  onPress={handleCancel}
                >
                  <Text style={styles.cancelStackedText}>{cancelOption.text}</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.rowActions}>
              {cancelOption && (
                <Pressable
                  style={({ pressed }) => [styles.rowBtn, { opacity: pressed ? 0.6 : 1 }]}
                  onPress={handleCancel}
                >
                  <Text style={styles.cancelText}>{cancelOption.text}</Text>
                </Pressable>
              )}
              {actionOptions.map((opt, i) => (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.rowBtn,
                    opt.style === 'destructive' && styles.destructiveBtn,
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={() => handlePress(opt)}
                >
                  <Text style={opt.style === 'destructive' ? styles.destructiveBtnText : styles.confirmText}>
                    {opt.text}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: width * 0.82,
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20 },
      android: { elevation: 12 },
    }),
  },
  title: {
    ...Typography.h2,
    fontSize: 19,
    color: Colors.onBackground,
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    ...Typography.body,
    fontSize: 15,
    color: Colors.onSurfaceVariant,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  // ── row layout (2 buttons side by side) ──────────────────────────
  rowActions: {
    flexDirection: 'row',
    gap: 10,
  },
  rowBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLow,
  },
  cancelText: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.onSurfaceVariant,
  },
  confirmText: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.primary,
  },
  // ── stacked layout (3+ options) ──────────────────────────────────
  stackedActions: {
    gap: 8,
  },
  stackedBtn: {
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceContainerLow,
  },
  stackedBtnText: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.primary,
  },
  cancelStackedBtn: {
    marginTop: 4,
    backgroundColor: Colors.surfaceContainerLow,
  },
  cancelStackedText: {
    ...Typography.body,
    fontWeight: '600',
    color: Colors.onSurfaceVariant,
  },
  // ── destructive ──────────────────────────────────────────────────
  destructiveBtn: {
    backgroundColor: Colors.error,
  },
  destructiveBtnText: {
    ...Typography.body,
    fontWeight: '700',
    color: 'white',
  },
});
