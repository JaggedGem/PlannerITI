import { type ComponentProps } from 'react';
import { PlatformPressable } from 'expo-router/react-navigation';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

type HapticTabProps = ComponentProps<typeof PlatformPressable>;

const TRANSPARENT_RIPPLE = 'transparent';

export function HapticTab({
    onPressIn,
    android_ripple,
    pressColor,
    ...props
}: HapticTabProps) {
    const isAndroid = Platform.OS === 'android';

    return (
        <PlatformPressable
            {...props}
            pressColor={isAndroid ? TRANSPARENT_RIPPLE : pressColor}
            android_ripple={
                isAndroid ?
                    {
                        ...(android_ripple ?? {}),
                        color: TRANSPARENT_RIPPLE,
                    }
                :   android_ripple
            }
            onPressIn={(ev) => {
                if (process.env.EXPO_OS === 'ios') {
                    // Add a soft haptic feedback when pressing down on the tabs.
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                onPressIn?.(ev);
            }}
        />
    );
}
