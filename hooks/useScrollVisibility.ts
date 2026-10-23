import {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useCallback } from 'react';

/** Follow scroll direction on the UI thread, including a smooth reveal when scrolling back. */
export function useScrollVisibility(distance = 64) {
  const previousOffset = useSharedValue(0);
  const hiddenDistance = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      const offset = Math.max(0, event.contentOffset.y);
      hiddenDistance.value = Math.max(
        0,
        Math.min(distance, hiddenDistance.value + offset - previousOffset.value),
      );
      previousOffset.value = offset;
    },
  });
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -hiddenDistance.value }],
    opacity: 1 - hiddenDistance.value / distance,
    pointerEvents: hiddenDistance.value >= distance - 4 ? 'none' : 'auto',
  }));
  const reset = useCallback(() => {
    previousOffset.value = 0;
    hiddenDistance.value = withTiming(0, { duration: 160 });
  }, [hiddenDistance, previousOffset]);

  return { onScroll, animatedStyle, reset };
}
