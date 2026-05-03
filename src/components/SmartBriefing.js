import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sparkles, Umbrella, Sun, Cloud, Thermometer, CheckCircle2, ListTodo, CloudSnow, Wind } from 'lucide-react-native';
import { Colors, Spacing, Typography } from '../theme';

const SmartBriefing = ({ weather, tasksCount, completedCount }) => {
  const { t } = useTranslation();

  const briefingData = useMemo(() => {
    if (!weather) return null;

    const hour = new Date().getHours();
    let greeting = t('briefing.greeting_morning');
    if (hour >= 12 && hour < 18) greeting = t('briefing.greeting_afternoon');
    if (hour >= 18 || hour < 6) greeting = t('briefing.greeting_evening');

    const cond = weather.condKey || 'clear';
    const isRainy = cond.includes('rain') || (weather.hourlyForecast?.[0]?.pop && parseInt(weather.hourlyForecast[0].pop) > 50);
    const isSnowy = cond.includes('snow');
    const isHot = weather.temp > 30;
    const isCold = weather.temp < 5;
    
    let alertText = '';
    let SuggestIcon = Sparkles;
    let iconColor = Colors.primary;

    if (isRainy) {
      alertText = t('briefing.rain_alert');
      SuggestIcon = Umbrella;
      iconColor = '#007AFF';
    } else if (isSnowy) {
      alertText = t('briefing.snow_alert');
      SuggestIcon = CloudSnow;
      iconColor = '#4FC3F7';
    } else if (isHot) {
      alertText = t('briefing.hot_alert');
      SuggestIcon = Sun;
      iconColor = '#FF8C00';
    } else if (isCold) {
      alertText = t('briefing.cold_alert');
      SuggestIcon = Thermometer;
      iconColor = '#1E90FF';
    } else if (tasksCount > 0 && tasksCount === completedCount) {
        alertText = t('briefing.all_done');
        SuggestIcon = CheckCircle2;
        iconColor = '#4CAF50';
    } else if (cond === 'sunny' || cond === 'clear') {
      alertText = t('briefing.perfect_day');
      SuggestIcon = Sun;
      iconColor = '#FFD600';
    }

    const remainingTasks = tasksCount - completedCount;
    const weatherSummary = t('briefing.weather_tasks', { 
        location: weather.addressName || weather.locationName || 'Current Location', 
        weather: t(`weather.${cond}`),
        count: remainingTasks
    });

    return { greeting, alertText, weatherSummary, SuggestIcon, iconColor, remainingTasks };
  }, [weather, tasksCount, completedCount, t]);

  if (!briefingData) return null;

  const { greeting, alertText, weatherSummary, SuggestIcon, iconColor, remainingTasks } = briefingData;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Sparkles size={16} color={Colors.primary} fill={Colors.primary} />
      </View>
      
      <View style={styles.content}>
        <View style={[styles.iconWrapper, { backgroundColor: iconColor + '15' }]}>
          <SuggestIcon size={24} color={iconColor} />
        </View>
        <View style={styles.textWrapper}>
          <Text style={styles.summaryText}>
            {remainingTasks > 0 ? weatherSummary : (tasksCount > 0 && tasksCount === completedCount ? t('briefing.all_done') : t('briefing.no_tasks'))}
          </Text>
          {alertText ? (
            <Text style={[styles.alertText, { color: iconColor }]}>{alertText}</Text>
          ) : null}
        </View>
      </View>
      
      {remainingTasks > 0 && (
          <View style={styles.footer}>
              <ListTodo size={14} color={Colors.textSecondary} />
              <Text style={styles.footerText}>{t('briefing.task_summary', { count: remainingTasks })}</Text>
          </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 28,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.surfaceContainer,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  greeting: {
    ...Typography.h3,
    fontSize: 16,
    color: Colors.text,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconWrapper: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textWrapper: {
    flex: 1,
  },
  summaryText: {
    ...Typography.bodySmall,
    color: Colors.text,
    lineHeight: 20,
    fontWeight: '500',
  },
  alertText: {
    ...Typography.bodySmall,
    fontWeight: '700',
    marginTop: 4,
  },
  footer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 12,
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: Colors.surfaceContainerHigh,
  },
  footerText: {
      ...Typography.label,
      fontSize: 11,
      color: Colors.textSecondary,
  }
});

export default SmartBriefing;
