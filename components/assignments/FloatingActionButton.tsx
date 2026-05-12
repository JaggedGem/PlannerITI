import React, { useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  useAnimatedReaction, 
  Easing 
} from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface FloatingActionButtonProps {
  onPress: () => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

export default function FloatingActionButton({ onPress }: FloatingActionButtonProps) {
  const { colors, styles } = useThemedStyles(createStyles);

  // Animated values
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  const rotation = useSharedValue(0);
  
  // Rotate effect when component mounts
  useEffect(() => {
    rotation.value = withTiming(1, { duration: 800, easing: Easing.elastic(1.2) });
  }, []);
  
  // Animation styles
  const buttonStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: scale.value },
        { rotate: `${rotation.value * 360}deg` },
      ],
      opacity: opacity.value,
    };
  });
  
  // Button press handlers
  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 10, stiffness: 300 });
    opacity.value = withTiming(0.9, { duration: 150 });
  };
  
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
    opacity.value = withTiming(1, { duration: 150 });
  };

  return (
    <AnimatedTouchable
      style={[styles.container, buttonStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <AnimatedGradient
        colors={[colors.primary, colors.primaryStrong]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <Ionicons name="add" size={32} color={colors.white} />
      </AnimatedGradient>
    </AnimatedTouchable>
  );
}

type ThemeColors = typeof Colors.light;

const createStyles = (colors: ThemeColors) => ({
  container: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    elevation: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    borderRadius: 28,
  },
  gradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  }
});