import { useRef, useCallback } from 'react';
import { PanResponder, Dimensions } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue,
  withSpring,
  cancelAnimation,
  runOnJS
} from 'react-native-reanimated';

// This hook is no longer used
export function useHorizontalSwipe() {
  return {};
}