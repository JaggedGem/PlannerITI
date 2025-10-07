import { StyleSheet, View, Text, TouchableOpacity, Dimensions, InteractionManager } from 'react-native';
import { useMemo, useEffect } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  withTiming,
  withSequence,
  withDelay,
  useSharedValue,
  Easing,
} from 'react-native-reanimated';
import { scheduleService, ScheduleView } from '@/services/scheduleService';
import { useTranslation } from '@/hooks/useTranslation';


interface ViewModeMenuProps {
  isOpen: boolean;
  onClose: () => void;
  isEvenWeek: boolean;
  weekText: string;
  currentView: ScheduleView;
}

export default function ViewModeMenu({ isOpen, onClose, isEvenWeek, weekText, currentView }: ViewModeMenuProps) {
  const { t } = useTranslation();
  const { width: SCREEN_WIDTH } = Dimensions.get('window');

  // Shared progress value (0 -> closed, 1 -> open)
  const progress = useSharedValue(isOpen ? 1 : 0);
  const wobble = useSharedValue(0); // 0 = rest, positive pushes downward

  useEffect(() => {
    progress.value = withTiming(isOpen ? 1 : 0, {
      duration: isOpen ? 170 : 110,
      easing: isOpen ? Easing.out(Easing.quad) : Easing.inOut(Easing.quad)
    });

    if (isOpen) {
      // Start a subtle downward wobble after the main appear begins
      wobble.value = 0;
      wobble.value = withDelay(60, withSequence(
        withTiming(1, { duration: 90, easing: Easing.out(Easing.quad) }),  // push down
        withTiming(-0.35, { duration: 120, easing: Easing.inOut(Easing.quad) }), // slight rebound up
        withTiming(0.15, { duration: 90, easing: Easing.inOut(Easing.quad) }),  // micro settle
        withTiming(0, { duration: 120, easing: Easing.out(Easing.quad) })       // rest
      ));
    } else {
      // Reset wobble when closing
      wobble.value = 0;
    }
  }, [isOpen, progress, wobble]);


  const animatedContainerStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const baseScale = 0.92 + p * (1 - 0.92);
    const overshoot = (p * (1 - p)) * 0.06;
    // Add very slight scale modulation during wobble (max ±0.01)
    const wobbleScale = 1 + (wobble.value * 0.01);
    const scale = (baseScale + overshoot) * wobbleScale;
    const baseTranslate = (-14) * (1 - p);
    // Wobble downward: positive wobble pushes downward up to ~6px (1 * 6)
    const wobbleOffset = wobble.value * 6;
    const translateY = baseTranslate + wobbleOffset;
    return {
      opacity: p,
      transform: [
        { scale },
        { translateY }
      ],
      pointerEvents: p > 0.05 ? 'auto' : 'none' as any,
    };
  });

  const overlayStyle = useAnimatedStyle(() => {
    return {
      opacity: progress.value,
      pointerEvents: progress.value > 0.05 ? 'auto' : 'none' as any,
    };
  });

  const handleViewChange = (view: ScheduleView) => {
    // If selecting the currently active view just close the menu quickly
    if (view === currentView) {
      onClose();
      return;
    }

    // Close menu first to let its animation run without heavy work
    onClose();

    // Defer the potentially heavy settings update (which triggers unmount/mount of large views)
    // This greatly reduces frame drops on low-end devices
    // Shorter defer so switch happens faster once menu begins closing
    setTimeout(() => {
      scheduleService.updateSettings({ scheduleView: view });
    }, 60);
  };

  const menuItems = useMemo(() => [
    {
      id: 'day',
      icon: 'today',
      label: t('schedule').dayView,
    },
    {
      id: 'week',
      icon: 'view-week',
      label: t('schedule').weekView,
    },
  ], [t]);

  return (
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1}>
        <Animated.View style={[styles.menuContainer, animatedContainerStyle]}>
          <View style={styles.weekPill}>
            <Text style={styles.weekText}>{weekText}</Text>
          </View>

          <View style={styles.menuContent}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.menuItem,
                  currentView === item.id && styles.menuItemActive,
                ]}
                onPress={() => handleViewChange(item.id as ScheduleView)}
              >
                <MaterialIcons 
                  name={item.icon as any} 
                  size={24} 
                  color={currentView === item.id ? '#FFFFFF' : '#8A8A8D'} 
                />
                <Text style={[
                  styles.menuItemText,
                  currentView === item.id && styles.menuItemTextActive,
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 60, // Add top padding to avoid status bar
    paddingHorizontal: 20,
  },
  menuContainer: {
    backgroundColor: '#1A1A1A', // Updated to match dates container color
    borderRadius: 16,
    padding: 12,
    width: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  weekPill: {
    backgroundColor: '#2C3DCD',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  weekText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  menuContent: {
    gap: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 12,
  },
  menuItemActive: {
    backgroundColor: '#2C3DCD',
  },
  menuItemText: {
    color: '#8A8A8D',
    fontSize: 16,
    fontWeight: '600',
  },
  menuItemTextActive: {
    color: '#FFFFFF',
  },
});