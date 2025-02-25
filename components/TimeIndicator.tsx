import { StyleSheet, View, Dimensions } from 'react-native';
import { useCallback } from 'react';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

interface TimeIndicatorProps {
  startTime: string;
  endTime: string;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

export function TimeIndicator({ startTime, endTime }: TimeIndicatorProps) {
  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentSeconds = now.getSeconds();
    const currentTimeInMinutes = currentHours * 60 + currentMinutes + (currentSeconds / 60);
  
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    const startTimeInMinutes = startHours * 60 + startMinutes;
    const endTimeInMinutes = endHours * 60 + endMinutes;
    const timeSlotDuration = endTimeInMinutes - startTimeInMinutes;
  
    if (currentTimeInMinutes < startTimeInMinutes) return { top: '0%' };
    if (currentTimeInMinutes > endTimeInMinutes) return { top: '100%' };
  
    const progress = (currentTimeInMinutes - startTimeInMinutes) / timeSlotDuration;
    return {
      top: `${progress * 100}%`,
    };
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      <View style={styles.container}>
        <View style={styles.arrow} />
        <Animated.View style={[styles.line, animatedStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: -500,
    right: -500,
    width: 2000,
    top: 0,
    bottom: 0,
    zIndex: 1,
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
  arrow: {
    position: 'absolute',
    left: 500, // Adjusted to account for container offset
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FF3B30',
    transform: [{ rotate: '90deg' }],
    marginTop: -3,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 5,
  },
});