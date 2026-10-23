import React, { useEffect, useMemo, useRef, useState } from 'react';

import {
  Animated,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import * as Haptics from 'expo-haptics';

import { Colors } from '@/constants/Colors';
import { MODAL_ORIENTATIONS } from '@/constants/Layout';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { hourFromIndex, hourIndex } from '@/utils/time';

// Custom TimePicker component
export const TimePicker = ({
  value,
  onChange,
  label,
  onClose,
  onConfirm,
  use12HourFormat = false,
  translations,
}: {
  value: Date;
  onChange: (date: Date) => void;
  label: string;
  onClose: () => void;
  onConfirm?: (date: Date) => void;
  use12HourFormat?: boolean;
  translations?: { cancel: string; confirm: string };
}) => {
  const { t, formatTimeFromDate } = useTranslation();
  const { isCompactHeight, availableHeight, insets } = useResponsiveLayout();
  const labels = translations ?? { cancel: t('common').cancel, confirm: t('common').confirm };
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const [localValue, setLocalValue] = useState(value);
  const period = localValue.getHours() >= 12 ? 'PM' : 'AM';
  const localValueRef = useRef(localValue);
  localValueRef.current = localValue;
  const hoursRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const minutesRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const itemHeight = isCompactHeight ? 36 : 56;
  const visibleItems = isCompactHeight ? 3 : 5;
  const wheelPadding = (itemHeight * (visibleItems - 1)) / 2;

  const hours = useMemo(() => {
    if (use12HourFormat) {
      return Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i));
    }
    return Array.from({ length: 24 }, (_, i) => i);
  }, [use12HourFormat]);

  const minutes = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => i);
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();

    const timeout = setTimeout(() => {
      const hour = hourIndex(localValueRef.current.getHours(), use12HourFormat);
      const minute = localValueRef.current.getMinutes();

      hoursRef.current?.scrollTo({
        y: hour * itemHeight,
        animated: false,
      });

      minutesRef.current?.scrollTo({
        y: minute * itemHeight,
        animated: false,
      });
    }, 50);

    return () => clearTimeout(timeout);
  }, [use12HourFormat, fadeAnim, scaleAnim, itemHeight]);

  const formatNumber = (num: number, padLength = 2) => {
    return num.toString().padStart(padLength, '0');
  };

  const handleHourScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!event.nativeEvent) return;

    const offsetY = event.nativeEvent.contentOffset.y;
    const selectedHour = Math.round(offsetY / itemHeight);

    if (selectedHour >= 0 && selectedHour < (use12HourFormat ? 12 : 24)) {
      setLocalValue((previous) => {
        const hour = hourFromIndex(selectedHour, use12HourFormat, previous.getHours() >= 12);
        if (previous.getHours() === hour) return previous;
        const next = new Date(previous);
        next.setHours(hour);
        return next;
      });
    }
  };

  const handleMinuteScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!event.nativeEvent) return;

    const offsetY = event.nativeEvent.contentOffset.y;
    const selectedMinute = Math.round(offsetY / itemHeight);

    if (selectedMinute >= 0 && selectedMinute < 60) {
      setLocalValue((previous) => {
        if (previous.getMinutes() === selectedMinute) return previous;
        const next = new Date(previous);
        next.setMinutes(selectedMinute);
        return next;
      });
    }
  };

  const handleScrollBeginDrag = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleScrollEndDrag = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
    type: 'hours' | 'minutes',
  ) => {
    if (type === 'hours') {
      handleHourScroll(event);
    } else {
      handleMinuteScroll(event);
    }
  };

  const togglePeriod = () => {
    setLocalValue((previous) => {
      const next = new Date(previous);
      next.setHours((previous.getHours() + 12) % 24);
      return next;
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleConfirm = () => {
    onChange(localValue);
    if (onConfirm) {
      onConfirm(localValue);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onClose();
  };

  return (
    <Modal
      supportedOrientations={MODAL_ORIENTATIONS}
      transparent
      visible
      animationType="none"
      statusBarTranslucent={true}
      navigationBarTranslucent={true}
      onRequestClose={onClose}
    >
      <View
        style={[styles.timePickerOverlay, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      >
        <Animated.View
          style={[
            styles.timePickerContainer,
            isCompactHeight && { padding: 12, maxHeight: availableHeight },
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={[styles.timePickerHeader, isCompactHeight && { marginBottom: 8 }]}>
            <Text style={styles.timePickerTitle}>{label}</Text>
            <Text style={styles.timePickerValue}>{formatTimeFromDate(localValue)}</Text>
          </View>

          <View
            style={[
              styles.timePickerContent,
              isCompactHeight && { marginTop: 4, marginBottom: 12 },
            ]}
          >
            <View style={styles.timePickerColumn}>
              <ScrollView
                ref={hoursRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={itemHeight}
                decelerationRate={Platform.select({
                  ios: 0.992,
                  android: 0.985,
                })}
                onScroll={handleHourScroll}
                onScrollBeginDrag={handleScrollBeginDrag}
                onScrollEndDrag={(e) => handleScrollEndDrag(e, 'hours')}
                onMomentumScrollEnd={() => Haptics.selectionAsync()}
                scrollEventThrottle={16}
                style={{ height: itemHeight * visibleItems }}
                contentContainerStyle={{
                  paddingVertical: wheelPadding,
                }}
                nestedScrollEnabled={true}
              >
                {hours.map((hour) => (
                  <View
                    key={`hour-${hour}`}
                    style={[styles.timePickerItem, { height: itemHeight }]}
                  >
                    <Text
                      style={[
                        styles.timePickerItemText,
                        hour ===
                          (use12HourFormat
                            ? localValue.getHours() % 12 || 12
                            : localValue.getHours()) && styles.timePickerItemTextSelected,
                        isCompactHeight && { fontSize: 30 },
                      ]}
                    >
                      {formatNumber(hour, use12HourFormat ? 1 : 2)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            <Text
              style={[
                styles.timePickerSeparator,
                isCompactHeight && { fontSize: 36, marginHorizontal: 12 },
              ]}
            >
              :
            </Text>

            <View style={styles.timePickerColumn}>
              <ScrollView
                ref={minutesRef}
                showsVerticalScrollIndicator={false}
                snapToInterval={itemHeight}
                decelerationRate={Platform.select({
                  ios: 0.992,
                  android: 0.985,
                })}
                onScroll={handleMinuteScroll}
                onScrollBeginDrag={handleScrollBeginDrag}
                onScrollEndDrag={(e) => handleScrollEndDrag(e, 'minutes')}
                onMomentumScrollEnd={() => Haptics.selectionAsync()}
                scrollEventThrottle={16}
                style={{ height: itemHeight * visibleItems }}
                contentContainerStyle={{
                  paddingVertical: wheelPadding,
                }}
                nestedScrollEnabled={true}
              >
                {minutes.map((minute) => (
                  <View
                    key={`minute-${minute}`}
                    style={[styles.timePickerItem, { height: itemHeight }]}
                  >
                    <Text
                      style={[
                        styles.timePickerItemText,
                        minute === localValue.getMinutes() && styles.timePickerItemTextSelected,
                        isCompactHeight && { fontSize: 30 },
                      ]}
                    >
                      {formatNumber(minute)}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            {use12HourFormat && (
              <TouchableOpacity style={styles.timePickerPeriodButton} onPress={togglePeriod}>
                <Text
                  style={[
                    styles.timePickerPeriodText,
                    {
                      color: period === 'AM' ? Colors.dark.white : Colors.dark.mutedText,
                    },
                  ]}
                >
                  AM
                </Text>
                <Text
                  style={[
                    styles.timePickerPeriodText,
                    {
                      color: period === 'PM' ? Colors.dark.white : Colors.dark.mutedText,
                    },
                  ]}
                >
                  PM
                </Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.timePickerActions}>
            <TouchableOpacity
              style={[styles.timePickerButton, styles.timePickerCancelButton]}
              onPress={onClose}
            >
              <Text style={styles.timePickerButtonText}>{labels.cancel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.timePickerButton, styles.timePickerConfirmButton]}
              onPress={handleConfirm}
            >
              <Text style={[styles.timePickerButtonText, styles.timePickerConfirmText]}>
                {labels.confirm}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  timePickerOverlay: {
    flex: 1,
    backgroundColor: Colors.dark.overlayBlack70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerContainer: {
    backgroundColor: Colors.dark.backgroundTertiary,
    borderRadius: 20,
    padding: 24,
    width: '90%',
    maxWidth: 400,
    elevation: 5,
    shadowColor: Colors.dark.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  timePickerHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timePickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.dark.white,
    marginBottom: 8,
  },
  timePickerValue: {
    fontSize: 16,
    color: Colors.dark.mutedText,
  },
  timePickerContent: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 12,
  },
  timePickerColumn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.dark.surfaceSecondary,
    borderRadius: 12,
    overflow: 'hidden',
    minWidth: 100,
  },
  timePickerItem: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timePickerItemText: {
    fontSize: 38,
    color: Colors.dark.mutedText,
    opacity: 0.15,
    fontWeight: '400',
  },
  timePickerItemTextSelected: {
    fontSize: 44,
    color: Colors.dark.white,
    opacity: 1,
    fontWeight: '600',
  },
  timePickerSeparator: {
    fontSize: 52,
    color: Colors.dark.white,
    marginHorizontal: 20,
    opacity: 0.8,
    fontWeight: '300',
  },
  timePickerPeriodButton: {
    marginLeft: 20,
    backgroundColor: Colors.dark.surfaceSecondary,
    borderRadius: 12,
    padding: 12,
    width: 60,
    height: 80,
    justifyContent: 'space-evenly',
  },
  timePickerPeriodText: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  timePickerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  timePickerButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  timePickerCancelButton: {
    backgroundColor: Colors.dark.surfaceSecondary,
  },
  timePickerConfirmButton: {
    backgroundColor: Colors.dark.primaryStrong,
  },
  timePickerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.dark.white,
  },
  timePickerConfirmText: {
    color: Colors.dark.white,
    fontWeight: '600',
  },
});
