import React, { useEffect } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    Easing,
} from 'react-native-reanimated';
import { Colors } from '@/constants/Colors';

interface FloatingActionButtonProps {
    onPress: () => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

export default function FloatingActionButton({
    onPress,
}: FloatingActionButtonProps) {
    // Animated values
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);
    const rotation = useSharedValue(0);

    // Rotate effect when component mounts
    useEffect(() => {
        rotation.value = withTiming(1, {
            duration: 800,
            easing: Easing.elastic(1.2),
        });
    }, [rotation]);

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
                colors={[Colors.dark.primary, Colors.dark.primaryStrong]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradient}
            >
                <Ionicons name="add" size={32} color={Colors.dark.white} />
            </AnimatedGradient>
        </AnimatedTouchable>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        elevation: 8,
        shadowColor: Colors.dark.shadow,
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
    },
});
