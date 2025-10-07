import { useState, useEffect, useRef } from 'react';
import { scheduleService } from '@/services/scheduleService';
import DayView from '@/components/schedule/DayView';
import WeekView from '@/components/schedule/WeekView';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { View, StyleSheet, InteractionManager } from 'react-native';

export default function Schedule() {
  const [settings, setSettings] = useState(scheduleService.getSettings());
  
  useEffect(() => {
    const unsubscribe = scheduleService.subscribe(() => {
      setSettings(scheduleService.getSettings());
    });
    return () => unsubscribe();
  }, []);

  // Keep both views mounted to avoid heavy remount cost
  const activeView = settings.scheduleView; // 'day' | 'week'
  const dayOpacity = useSharedValue(activeView === 'day' ? 1 : 0);
  const weekOpacity = useSharedValue(activeView === 'week' ? 1 : 0);
  const hasPreloadedWeek = useRef(activeView === 'week');
  const hasPreloadedDay = useRef(activeView === 'day');

  // Animate on scheduleView change
  useEffect(() => {
    if (activeView === 'day') {
      // Ensure week view is mounted (it always is) but fade it out
      weekOpacity.value = withTiming(0, { duration: 160 });
      dayOpacity.value = withTiming(1, { duration: 160 });
    } else {
      dayOpacity.value = withTiming(0, { duration: 160 });
      weekOpacity.value = withTiming(1, { duration: 160 });
    }
  }, [activeView, dayOpacity, weekOpacity]);

  // Background preload of the inactive view after interactions finish (first mount only)
  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      if (!hasPreloadedWeek.current) {
        hasPreloadedWeek.current = true; // WeekView already mounted but mark preloaded
      }
      if (!hasPreloadedDay.current) {
        hasPreloadedDay.current = true; // DayView already mounted but mark preloaded
      }
    });
  }, []);

  const dayStyle = useAnimatedStyle(() => ({
    opacity: dayOpacity.value,
    pointerEvents: dayOpacity.value > 0.5 ? 'auto' : 'none'
  }));
  const weekStyle = useAnimatedStyle(() => ({
    opacity: weekOpacity.value,
    pointerEvents: weekOpacity.value > 0.5 ? 'auto' : 'none'
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.layer, dayStyle]}>
        <DayView />
      </Animated.View>
      <Animated.View style={[styles.layer, weekStyle]}>
        <WeekView />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  layer: { ...StyleSheet.absoluteFillObject },
});