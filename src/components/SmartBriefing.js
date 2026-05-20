import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sparkles, Umbrella, Sun, Thermometer, CheckCircle2, ListTodo, CloudSnow, Shirt } from 'lucide-react-native';
import { Colors, Spacing, Typography } from '../theme';
import { getOutfitAdvice } from '../utils/outfitAdvice';

const SmartBriefing = ({
  weather,
  tasksCount = 0,
  completedCount = 0,
  directTasksCount = 0,
  completedDirectTasksCount = 0,
  flowStepsCount = 0,
  completedFlowStepsCount = 0,
}) => {
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

    const remainingTasks = Math.max(tasksCount - completedCount, 0);
    const remainingDirectTasks = Math.max(directTasksCount - completedDirectTasksCount, 0);
    const remainingFlowSteps = Math.max(flowStepsCount - completedFlowStepsCount, 0);
    let footerText = t('briefing.task_summary', { count: remainingTasks });
    if (remainingDirectTasks > 0 && remainingFlowSteps > 0) {
      footerText = t('briefing.task_summary_detail', {
        tasks: remainingDirectTasks,
        flows: remainingFlowSteps,
      });
    } else if (remainingDirectTasks > 0) {
      footerText = t('briefing.task_summary_tasks_only', { count: remainingDirectTasks });
    } else if (remainingFlowSteps > 0) {
      footerText = t('briefing.task_summary_flows_only', { count: remainingFlowSteps });
    }

    const weatherSummary = t('briefing.weather_tasks', { 
        location: weather.addressName || weather.locationName || 'Current Location', 
        weather: t(`weather.${cond}`),
        count: remainingTasks
    });

    const outfitAdvice = getOutfitAdvice({ weather });

    return { greeting, alertText, weatherSummary, SuggestIcon, iconColor, remainingTasks, footerText, outfitAdvice };
  }, [weather, tasksCount, completedCount, directTasksCount, completedDirectTasksCount, flowStepsCount, completedFlowStepsCount, t]);

  if (!briefingData) return null;

  const { greeting, alertText, weatherSummary, SuggestIcon, iconColor, remainingTasks, footerText, outfitAdvice } = briefingData;

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
              <Text style={styles.footerText}>{footerText}</Text>
          </View>
      )}

      {outfitAdvice && (
        <View style={styles.outfitBox}>
          <View style={styles.outfitHeader}>
            <View style={styles.outfitIcon}>
              <Shirt size={15} color={Colors.primary} />
            </View>
            <Text style={styles.outfitTitle}>{t('outfit.title', '오늘의 외출 준비')}</Text>
          </View>
          <Text style={styles.outfitSummary} numberOfLines={2}>
            {outfitAdvice.mode === 'next'
              ? t('outfit.summary_next', {
                time: t(outfitAdvice.timeLabelKey),
                outfit: t(outfitAdvice.outfitKey, '가벼운 레이어드'),
                defaultValue: '{{time}} 외출을 위해 {{outfit}}을 준비해두면 좋아요.',
              })
              : t('outfit.summary_default', {
                outfit: t(outfitAdvice.outfitKey, '가벼운 레이어드'),
                defaultValue: '오늘은 {{outfit}}이 좋아요.',
              })}
          </Text>
          <View style={styles.outfitChips}>
            {outfitAdvice.carryKeys.map(key => (
              <View key={key} style={styles.outfitChip}>
                <Text style={styles.outfitChipText}>{t(key)}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.outfitNote} numberOfLines={2}>{t(outfitAdvice.noteKey)}</Text>
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
  },
  outfitBox: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceContainerHigh,
  },
  outfitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  outfitIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EAF7FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outfitTitle: {
    ...Typography.bodySmall,
    fontSize: 14,
    color: Colors.text,
    fontWeight: '800',
  },
  outfitSummary: {
    ...Typography.bodySmall,
    fontSize: 14,
    color: Colors.text,
    fontWeight: '700',
    lineHeight: 21,
  },
  outfitChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  outfitChip: {
    borderRadius: 999,
    backgroundColor: Colors.surfaceContainerLow,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  outfitChipText: {
    ...Typography.label,
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '700',
  },
  outfitNote: {
    ...Typography.bodySmall,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.textSecondary,
    marginTop: 8,
  },
});

export default SmartBriefing;
