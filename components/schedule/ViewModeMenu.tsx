import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { useMemo } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import Animated, { 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { scheduleService, ScheduleView } from '@/services/scheduleService';

interface ViewModeMenuProps {
  isOpen: boolean;
  onClose: () => void;
  isEvenWeek: boolean;
  weekText: string;
  currentView: ScheduleView;
}

export default function ViewModeMenu({ isOpen, onClose, isEvenWeek, weekText, currentView }: ViewModeMenuProps) {
  const { width: SCREEN_WIDTH } = Dimensions.get('window');

  const animatedContainerStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isOpen ? 1 : 0, { duration: 200 }),
      transform: [
        { 
          scale: withSpring(isOpen ? 1 : 0.8, {
            damping: 15,
            stiffness: 150,
          })
        },
        {
          translateY: withSpring(isOpen ? 0 : -40, {
            damping: 15,
            stiffness: 150,
          })
        }
      ],
      pointerEvents: isOpen ? 'auto' : 'none' as any,
    };
  }, [isOpen]);

  const overlayStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(isOpen ? 1 : 0, { duration: 200 }),
      pointerEvents: isOpen ? 'auto' : 'none' as any,
    };
  }, [isOpen]);

  const handleViewChange = (view: ScheduleView) => {
    scheduleService.updateSettings({ scheduleView: view });
    onClose();
  };

  const menuItems = useMemo(() => [
    {
      id: 'day',
      icon: 'today',
      label: 'Day View',
    },
    {
      id: 'week',
      icon: 'view-week',
      label: 'Week View',
    },
  ], []);

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