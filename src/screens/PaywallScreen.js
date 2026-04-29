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
          <LinearGradient 
            colors={['#00BFFF', '#0095CC']} 
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Crown size={56} color="white" fill="white" />
            <Text style={[styles.heroTitle, { color: 'white' }]}>Todo Weather Premium</Text>
            <Text style={[styles.heroSub, { color: 'rgba(255,255,255,0.8)' }]}>광고 없이, 더 많은 지역과 플로우를</Text>
          </LinearGradient>

          {/* Benefits */}
          <View style={styles.benefitBox}>
            {BENEFITS.map((b, i) => (
              <View key={i} style={styles.benefitRow}>
                <View style={[styles.checkCircle, { backgroundColor: '#E1F5FE' }]}>
                  <Check size={16} color="#00BFFF" strokeWidth={4} />
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
              style={[styles.ctaBtnContainer, (loading || packages.length === 0) && { opacity: 0.8 }]}
              onPress={handlePurchase}
              disabled={loading || packages.length === 0}
            >
              <LinearGradient
                colors={['#00BFFF', '#0077AA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.ctaBtn}
              >
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.ctaBtnText}>구독 시작하기</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Restore */}
          <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={loading}>
            <RotateCcw size={14} color={Colors.textSecondary} />
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    backgroundColor: '#FFFFFF',
  },
  iconBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: Colors.text, letterSpacing: -0.3 },

  content: { paddingBottom: 60 },

  hero: {
    marginHorizontal: Spacing.md,
    borderRadius: 32,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#81d4fa',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  heroTitle: { fontSize: 26, fontWeight: '900', color: Colors.text, marginTop: 16, letterSpacing: -0.5 },
  heroSub: { fontSize: 15, color: Colors.textSecondary, fontWeight: '600', marginTop: 4 },

  benefitBox: {
    marginHorizontal: Spacing.xl,
    backgroundColor: '#F8F9FA',
    borderRadius: 24,
    padding: 24,
    gap: 16,
    marginBottom: 32,
  },
  benefitRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  checkCircle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#E1F5FE',
    justifyContent: 'center', alignItems: 'center',
  },
  benefitText: { fontSize: 15, fontWeight: '700', color: Colors.text, letterSpacing: -0.2 },

  packageList: { marginHorizontal: Spacing.md, gap: 12, marginBottom: 32 },
  packageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    borderColor: '#F1F3F5',
  },
  packageCardSelected: { borderColor: '#00BFFF', backgroundColor: '#F0F9FF' },
  packageTitle: { fontSize: 16, fontWeight: '800', color: Colors.text },
  packageDesc: { fontSize: 13, color: Colors.textSecondary, marginTop: 4, lineHeight: 18 },
  packagePrice: { fontSize: 18, fontWeight: '900', color: Colors.text, marginLeft: 16 },

  alreadyPremium: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginHorizontal: Spacing.md, marginBottom: 16,
    backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#FEF3C7',
  },
  alreadyPremiumText: { fontSize: 15, fontWeight: '700', color: '#B45309' },

  ctaBtn: {
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00BFFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaBtnContainer: {
    marginHorizontal: Spacing.md,
    marginBottom: 16,
  },
  ctaBtnText: { fontSize: 17, fontWeight: '800', color: 'white' },

  restoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, marginBottom: 8,
  },
  restoreText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '600', textDecorationLine: 'underline' },

  legal: {
    fontSize: 11, color: Colors.textSecondary, textAlign: 'center',
    marginHorizontal: Spacing.xl, lineHeight: 17, opacity: 0.7,
  },
});

export default PaywallScreen;
