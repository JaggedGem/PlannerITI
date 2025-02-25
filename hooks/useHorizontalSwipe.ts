import { useRef, useCallback } from 'react';
import { PanResponder, Dimensions } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring,
  withTiming,
  runOnJS
} from 'react-native-reanimated';

export function useHorizontalSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold = 50
) {
  const translateX = useSharedValue(0);
  const isSwipingRef = useRef(false);
  const lastSwipeTime = useRef(0);
  const screenWidth = Dimensions.get('window').width;

  const resetPosition = useCallback(() => {
    translateX.value = withTiming(0, { duration: 200 });
  }, []);

  const handleSwipe = useCallback((direction: number) => {
    if (direction > 0) {
      onSwipeRight();
    } else {
      onSwipeLeft();
    }
  }, [onSwipeLeft, onSwipeRight]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > Math.abs(dy * 2) && Math.abs(dx) > 10;
      },
      onPanResponderGrant: () => {
        isSwipingRef.current = true;
      },
      onPanResponderMove: (_, gestureState) => {
        if (!isSwipingRef.current) return;
        const { dx } = gestureState;
        // Limit the drag to a percentage of the screen width
        const maxDrag = screenWidth * 0.3;
        const limitedDx = Math.max(Math.min(dx, maxDrag), -maxDrag);
        translateX.value = limitedDx;
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx, vx } = gestureState;
        const now = Date.now();
        
        // Prevent rapid swipes by enforcing a minimum time between swipes
        if (now - lastSwipeTime.current < 250) {
          translateX.value = withSpring(0);
          isSwipingRef.current = false;
          return;
        }

        if (Math.abs(dx) > threshold || Math.abs(vx) > 0.5) {
          const direction = dx > 0 ? 1 : -1;
          lastSwipeTime.current = now;

          translateX.value = withSpring(direction * (screenWidth * 0.3), {
            velocity: vx,
            damping: 15,
            stiffness: 150,
          }, (finished) => {
            if (finished) {
              runOnJS(resetPosition)();
              runOnJS(handleSwipe)(direction);
            }
          });
        } else {
          translateX.value = withSpring(0, {
            velocity: vx,
            damping: 15,
            stiffness: 400,
          });
        }
        isSwipingRef.current = false;
      },
      onPanResponderTerminate: () => {
        translateX.value = withSpring(0);
        isSwipingRef.current = false;
      },
    })
  ).current;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
    };
  });

  return { panResponder, animatedStyle };
}