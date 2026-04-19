import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Plus, Sun, Cloud, MapPin, CheckCircle2, Compass } from 'lucide-react-native';
import { Colors, Spacing, Typography } from '../theme';

const { width } = Dimensions.get('window');

const FlowScreen = ({ navigation }) => {
  const { t } = useTranslation();

  const flowSteps = [
    {
      id: '1',
      location: 'Gangnam Station',
      time: '10:00 AM',
      temp: '18°',
      condition: 'Sunny',
      icon: <Sun size={32} color={Colors.primaryContainer} strokeWidth={1.2} />,
      activity: 'Team Morning Meeting',
    },
    {
      id: '2',
      location: 'Seongsu-dong',
      time: '02:00 PM',
      temp: '21°',
      condition: 'Partly Cloudy',
      icon: <Cloud size={32} color={Colors.primary} strokeWidth={1.2} />,
      activity: 'Brand Pop-up Store Visit',
    },
  ];

  return (
    <View style={[styles.container, { paddingTop: Constants.statusBarHeight }]}>
      <View style={styles.headerBar}>
        <TouchableOpacity onPress={() => navigation.navigate('Weather')} style={styles.backButton}>
          <ChevronLeft size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={Typography.label}>Organic Flow</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.titleSection}>
          <Text style={Typography.h1}>Today's Flow</Text>
          <View style={styles.summaryBadge}>
             <Text style={styles.summaryText}>Smooth weather for your route</Text>
          </View>
        </View>

        <View style={styles.flowContainer}>
          {flowSteps.map((step, index) => (
            <View key={step.id} style={styles.timelineItem}>
              <View style={styles.indicatorContainer}>
                <View style={[styles.dot, index === 0 && styles.activeDot]} />
                {index !== flowSteps.length - 1 && <View style={styles.line} />}
              </View>

              <View style={styles.stepCard}>
                <View style={styles.stepMain}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.locationRow}>
                      <MapPin size={14} color={Colors.primary} style={{ marginRight: 4 }} />
                      <Text style={styles.locationName}>{step.location}</Text>
                    </View>
                    <Text style={Typography.bodySmall}>{step.time} • {step.activity}</Text>
                  </View>
                  {step.icon}
                </View>
                
                <View style={styles.weatherInfo}>
                  <Text style={styles.tempLarge}>{step.temp}</Text>
                  <View>
                    <Text style={Typography.body}>{step.condition}</Text>
                    <Text style={styles.detailsText}>Weather optimized for this stop</Text>
                  </View>
                </View>
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.addStep}>
          <Plus size={20} color={Colors.primary} />
          <Text style={styles.addText}>Add Stop to Flow</Text>
        </TouchableOpacity>

        {/* Dynamic Route Visualization Placeholder */}
        <View style={styles.flowPreview}>
           <Compass size={24} color={Colors.primary} style={{ marginBottom: 16 }} strokeWidth={1} />
           <Text style={Typography.h3}>Integrated Path</Text>
           <Text style={[Typography.bodySmall, { textAlign: 'center', marginTop: 8 }]}>
             Your todos are now geographically sequenced.
           </Text>
        </View>
      </ScrollView>

      {/* Glass Floating Navigation */}
      <View style={styles.bottomNavContainer}>
        <View style={styles.glassNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Weather')}>
            <Sun size={24} color={Colors.outline} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Tasks')}>
            <CheckCircle2 size={24} color={Colors.outline} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Flow')}>
            <View style={styles.activeDot} />
            <Compass size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    height: 60,
  },
  backButton: {
    padding: 4,
  },
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 130,
  },
  titleSection: {
    marginBottom: Spacing.xl,
  },
  summaryBadge: {
    marginTop: Spacing.md,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.surfaceContainerLow,
    alignSelf: 'flex-start',
  },
  summaryText: {
    ...Typography.bodySmall,
    color: Colors.primary,
    fontWeight: '700',
  },
  flowContainer: {
    marginTop: Spacing.md,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: Spacing.lg,
  },
  indicatorContainer: {
    alignItems: 'center',
    marginRight: Spacing.md,
    marginTop: 12,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.outlineVariant,
  },
  activeDot: {
    backgroundColor: Colors.primary,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 3,
    borderColor: Colors.surfaceContainer,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.surfaceContainerHigh,
    marginVertical: 4,
  },
  stepCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 32,
    padding: Spacing.lg,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 4,
  },
  stepMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationName: {
    ...Typography.h3,
    fontSize: 18,
  },
  weatherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  tempLarge: {
    ...Typography.h1,
    fontSize: 36,
  },
  detailsText: {
    ...Typography.bodySmall,
    fontSize: 12,
  },
  addStep: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    borderRadius: 32,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: Colors.outlineVariant,
    borderStyle: 'dashed',
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  addText: {
    ...Typography.body,
    fontWeight: '700',
    color: Colors.primary,
  },
  flowPreview: {
    marginTop: Spacing.huge,
    padding: Spacing.xxl,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 40,
    alignItems: 'center',
  },
  bottomNavContainer: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  glassNav: {
    width: width * 0.75,
    height: 64,
    backgroundColor: Colors.glass,
    borderRadius: 32,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  navItem: {
    padding: 10,
    alignItems: 'center',
  },
  activeDot: {
    position: 'absolute',
    top: -4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
  }
});

export default FlowScreen;
