import { useRef } from 'react';
import { PanResponder, Dimensions } from 'react-native';

export function useHorizontalSwipe(
  onSwipeLeft: () => void,
  onSwipeRight: () => void,
  threshold = 50
) {
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > Math.abs(dy * 2);
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx } = gestureState;
        const screenWidth = Dimensions.get('window').width;

        if (Math.abs(dx) > threshold) {
          if (dx > 0) {
            // Swipe right
            onSwipeRight();
          } else {
            // Swipe left
            onSwipeLeft();
          }
        }
      },
    })
  ).current;

  return panResponder;
}