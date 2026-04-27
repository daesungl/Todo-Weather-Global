import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';
import { Sun, CheckCircle2, Compass } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '../theme';

const { width } = Dimensions.get('window');

const TABS = [
  { name: 'Weather', Icon: Sun },
  { name: 'Tasks', Icon: CheckCircle2 },
  { name: 'Flow', Icon: Compass },
];

export default function CustomTabBar({ state, descriptors, navigation }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.bottomNavContainer, { bottom: Math.max(insets.bottom, 20) + 10 }]}
      pointerEvents="box-none"
    >
      <View style={styles.glassNav}>
        {TABS.map((tab, index) => {
          const isActive = state.index === index;
          const { Icon } = tab;
          const route = state.routes[index];
          return (
            <TouchableOpacity
              key={tab.name}
              style={[styles.navItem, isActive && styles.activeNavItem]}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isActive && !event.defaultPrevented) {
                  navigation.navigate({ name: route.name, merge: true });
                }
              }}
              activeOpacity={0.7}
            >
              <Icon
                size={28}
                color={isActive ? Colors.primary : Colors.outline}
                strokeWidth={isActive ? 2.5 : 2}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNavContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    // 탭바가 화면 위에 떠 있도록 pointerEvents 무시하지 않음
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
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  navItem: {
    padding: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  activeNavItem: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
  },
});
