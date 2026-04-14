import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Circle, Plus, Sun, MapPin, MoreHorizontal, Compass } from 'lucide-react-native';
import { Colors, Spacing, Typography } from '../theme';

const { width } = Dimensions.get('window');

const TasksScreen = ({ navigation }) => {
  const { t } = useTranslation();

  const activeTasks = [
    { id: '1', title: 'Global UI Review', time: '10:00 AM', category: 'Work' },
    { id: '2', title: 'Prepare Travel Docs', time: '02:00 PM', category: 'Personal' },
  ];

  return (
    <View style={[styles.container, { paddingTop: Constants.statusBarHeight }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Editorial Header */}
        <View style={styles.header}>
          <Text style={Typography.label}>Your Schedule</Text>
          <Text style={Typography.h1}>Daily Tasks</Text>
        </View>

        {/* Tonal Section - Active Tasks */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={Typography.h3}>In Progress</Text>
            <TouchableOpacity style={styles.addButton}>
              <Plus size={24} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.listContainer}>
            {activeTasks.map((task) => (
              <TouchableOpacity key={task.id} style={styles.taskCard}>
                <Circle size={22} color={Colors.outline} strokeWidth={1} />
                <View style={styles.taskData}>
                  <Text style={Typography.body}>{task.title}</Text>
                  <Text style={Typography.bodySmall}>{task.time} • {task.category}</Text>
                </View>
                <MoreHorizontal size={20} color={Colors.outline} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Completed Section (Subtle Style) */}
        <View style={[styles.section, { marginTop: Spacing.xl }]}>
          <Text style={[Typography.h3, { marginBottom: Spacing.md }]}>Completed</Text>
          <View style={styles.completedCard}>
            <CheckCircle2 size={22} color={Colors.primary} strokeWidth={1.5} />
            <View style={styles.taskData}>
              <Text style={styles.completedText}>Updated weather settings</Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Glass Floating Navigation (Bottom Tab UI Match) */}
      <View style={styles.bottomNavContainer}>
        <View style={styles.glassNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Weather')}>
            <Sun size={24} color={Colors.outline} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Tasks')}>
            <View style={styles.activeDot} />
            <CheckCircle2 size={24} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('Flow')}>
            <Compass size={24} color={Colors.outline} />
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
  scrollContent: {
    padding: Spacing.lg,
    paddingBottom: 120,
  },
  header: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xl,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceContainerLowest,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
  },
  listContainer: {
    gap: Spacing.md,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.surfaceContainerLowest,
    borderRadius: 24,
    gap: Spacing.md,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 15,
  },
  completedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: 24,
    gap: Spacing.md,
    opacity: 0.6,
  },
  taskData: {
    flex: 1,
  },
  completedText: {
    ...Typography.body,
    textDecorationLine: 'line-through',
    color: Colors.textSecondary,
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

export default TasksScreen;
