import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Constants from 'expo-constants';
import { ChevronLeft, Crown, Check, RotateCcw } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Colors, Spacing } from '../theme';

const BENEFITS = [
  { label: '광고 완전 제거' },
  { label: '날씨 관심 지역 최대 15개' },
  { label: '플로우 최대 30개' },
  { label: '플로우 스텝 최대 30개' },
];

const PaywallScreen = ({ navigation }) => {
  const { offerings, purchasePackage, restorePurchases, isPremium } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  const packages = offerings?.availablePackages || [];

  const handlePurchase = async () => {
    const pkg = selected || packages[0];
    if (!pkg) return;
    setLoading(true);
    const result = await purchasePackage(pkg);
    setLoading(false);
    if (result.success) {
      Alert.alert('구독 완료', '프리미엄 혜택이 활성화되었습니다!', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } else if (!result.userCancelled) {
      Alert.alert('오류', '결제 중 문제가 발생했습니다. 다시 시도해주세요.');
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    const restored = await restorePurchases();
    setLoading(false);
    if (restored) {
      Alert.alert('복원 완료', '구독이 복원되었습니다.', [
        { text: '확인', onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert('복원 실패', '복원할 구독 내역이 없습니다.');
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Constants.statusBarHeight }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>프리미엄</Text>
          <View style={styles.iconBtn} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <LinearGradient colors={['#00BFFF', '#0080CC']} style={styles.hero}>
            <Crown size={48} color="#FFD700" />
            <Text style={styles.heroTitle}>Todo Weather Premium</Text>
            <Text style={styles.heroSub}>광고 없이, 제한 없이</Text>
          </LinearGradient>

          {/* Benefits */}
          <View style={styles.benefitBox}>
            {BENEFITS.map((b, i) => (
              <View key={i} style={styles.benefitRow}>
                <View style={styles.checkCircle}>
                  <Check size={14} color="white" strokeWidth={3} />
                </View>
                <Text style={styles.benefitText}>{b.label}</Text>
              </View>
            ))}
          </View>

          {/* Packages */}
          {packages.length === 0 ? (
            <ActivityIndicator color={Colors.primary} style={{ marginVertical: 32 }} />
          ) : (
            <View style={styles.packageList}>
              {packages.map((pkg) => {
                const isSelected = (selected || packages[0])?.identifier === pkg.identifier;
                return (
                  <TouchableOpacity
                    key={pkg.identifier}
                    style={[styles.packageCard, isSelected && styles.packageCardSelected]}
                    onPress={() => setSelected(pkg)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.packageTitle, isSelected && { color: Colors.primary }]}>
                        {pkg.product.title || pkg.packageType}
                      </Text>
                      <Text style={styles.packageDesc}>{pkg.product.description}</Text>
                    </View>
                    <Text style={[styles.packagePrice, isSelected && { color: Colors.primary }]}>
                      {pkg.product.priceString}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* CTA */}
          {isPremium ? (
            <View style={styles.alreadyPremium}>
              <Crown size={18} color="#f59e0b" />
              <Text style={styles.alreadyPremiumText}>현재 프리미엄 구독 중입니다</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.ctaBtn, (loading || packages.length === 0) && { opacity: 0.5 }]}
              onPress={handlePurchase}
              disabled={loading || packages.length === 0}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.ctaBtnText}>구독 시작하기</Text>
              )}
            </TouchableOpacity>
          )}

          {/* Restore */}
          <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={loading}>
            <RotateCcw size={14} color={Colors.outline} />
            <Text style={styles.restoreText}>구독 복원</Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            구독은 각 기간 종료 24시간 전에 자동 갱신됩니다. 언제든지 스토어 설정에서 취소할 수 있습니다.
          </Text>
        </ScrollView>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    backgroundColor: '#F8F9FA',
  },
  iconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: Colors.text },

  content: { paddingBottom: 40 },

  hero: {
    marginHorizontal: Spacing.md,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: 'white' },
  heroSub: { fontSize: 14, color: 'rgba(255,255,255,0.85)' },

  benefitBox: {
    marginHorizontal: Spacing.md,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    gap: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkCircle: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  benefitText: { fontSize: 15, fontWeight: '600', color: Colors.text },

  packageList: { marginHorizontal: Spacing.md, gap: 10, marginBottom: 20 },
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E0E0E0',
  },
  packageCardSelected: { borderColor: Colors.primary, backgroundColor: '#E8F7FF' },
  packageTitle: { fontSize: 15, fontWeight: '700', color: Colors.text },
  packageDesc: { fontSize: 12, color: Colors.outline, marginTop: 2 },
  packagePrice: { fontSize: 17, fontWeight: '800', color: Colors.text },

  alreadyPremium: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: Spacing.md, marginBottom: 12,
    backgroundColor: '#FFF8E1', borderRadius: 12, padding: 14,
  },
  alreadyPremiumText: { fontSize: 14, fontWeight: '700', color: '#f59e0b' },

  ctaBtn: {
    marginHorizontal: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  ctaBtnText: { fontSize: 16, fontWeight: '800', color: 'white' },

  restoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12,
  },
  restoreText: { fontSize: 13, color: Colors.outline },

  legal: {
    fontSize: 11, color: Colors.outline, textAlign: 'center',
    marginHorizontal: Spacing.xl, lineHeight: 16,
  },
});

export default PaywallScreen;
