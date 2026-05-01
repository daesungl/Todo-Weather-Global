import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Constants from 'expo-constants';
import { ChevronLeft, Crown, Check, RotateCcw, Shield, ExternalLink } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription } from '../contexts/SubscriptionContext';
import { Colors, Spacing } from '../theme';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';

const BENEFITS = [
  { label: '광고 완전 제거' },
  { label: '날씨 관심 지역 최대 15개' },
  { label: '플로우 최대 30개' },
  { label: '플로우 스텝 최대 30개' },
];

const PaywallScreen = ({ navigation }) => {
  const { t } = useTranslation();
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
      Alert.alert(t('common.info'), t('paywall.success_msg', 'Premium activated!'), [
        { text: t('common.confirm'), onPress: () => navigation.goBack() },
      ]);
    } else if (!result.userCancelled) {
      Alert.alert(t('common.error', 'Error'), t('paywall.error_msg', 'An error occurred during payment.'));
    }
  };

  const handleRestore = async () => {
    setLoading(true);
    const restored = await restorePurchases();
    setLoading(false);
    if (restored) {
      Alert.alert(t('common.info'), t('paywall.restore_success', 'Subscription restored.'), [
        { text: t('common.confirm'), onPress: () => navigation.goBack() },
      ]);
    } else {
      Alert.alert(t('common.info'), t('paywall.restore_fail', 'No subscription found to restore.'));
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: Constants.statusBarHeight }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('common.premium')}</Text>
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
            <Text style={[styles.heroSub, { color: 'rgba(255,255,255,0.8)' }]}>{t('menu.premium_cta')}</Text>
          </LinearGradient>

          {/* Benefits */}
          <View style={styles.benefitBox}>
            {[
              t('menu.benefit_ads', 'No Ads'),
              t('menu.benefit_regions', 'Up to 15 regions'),
              t('menu.benefit_flows', 'Up to 30 journeys'),
              t('menu.benefit_steps', 'Up to 30 steps per journey'),
            ].map((label, i) => (
              <View key={i} style={styles.benefitRow}>
                <View style={[styles.checkCircle, { backgroundColor: '#E1F5FE' }]}>
                  <Check size={16} color="#00BFFF" strokeWidth={4} />
                </View>
                <Text style={styles.benefitText}>{label}</Text>
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
                  <Text style={styles.ctaBtnText}>{t('paywall.start_subscription', 'Start Subscription')}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Restore */}
          <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore} disabled={loading}>
            <RotateCcw size={14} color={Colors.textSecondary} />
            <Text style={styles.restoreText}>{t('paywall.restore', 'Restore Purchase')}</Text>
          </TouchableOpacity>

          <View style={styles.legalContainer}>
            <Text style={styles.legal}>
              {t('paywall.legal_notice')}
            </Text>
            
            <View style={styles.legalLinks}>
              <TouchableOpacity onPress={() => Linking.openURL('https://pellongsoft.tistory.com/4')} style={styles.legalLink}>
                <Text style={styles.legalLinkText}>{t('paywall.privacy_policy')}</Text>
              </TouchableOpacity>
              <Text style={styles.legalDot}> • </Text>
              <TouchableOpacity onPress={() => Linking.openURL('https://pellongsoft.tistory.com/4')} style={styles.legalLink}>
                <Text style={styles.legalLinkText}>{t('paywall.terms_of_use')}</Text>
              </TouchableOpacity>
            </View>
          </View>
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

  legalContainer: {
    marginTop: 16,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  legal: {
    fontSize: 11, color: Colors.textSecondary, textAlign: 'center',
    lineHeight: 17, opacity: 0.7,
    marginBottom: 12,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  legalLink: {
    paddingVertical: 4,
  },
  legalLinkText: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  legalDot: {
    fontSize: 11,
    color: Colors.textSecondary,
  }
});

export default PaywallScreen;
