import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Animated,
    StyleSheet,
    View,
    BackHandler,
    Pressable,
    Modal,
    ViewStyle,
    Easing,
} from 'react-native';
import { Colors } from '@/constants/Colors';

interface BottomModalPortalProps {
    isVisible: boolean;
    onClose: () => void;
    children: React.ReactNode;
    maxHeight?: string | number;
    backgroundColor?: string;
    borderRadius?: number;
}

/**
 * A generic portal component for bottom modals that ensures content always renders on top
 * of other content regardless of parent layout or content changes.
 * Provides the same portal pattern as ModernDropdownPortal but for any content.
 */
export function BottomModalPortal({
    isVisible,
    onClose,
    children,
    maxHeight = '80%',
    backgroundColor = Colors.dark.backgroundApp,
    borderRadius = 20,
}: BottomModalPortalProps) {
    const overlayOpacity = useRef(new Animated.Value(0)).current;
    const sheetOpacity = useRef(new Animated.Value(0)).current;
    const sheetTranslateY = useRef(new Animated.Value(28)).current;
    const closeRunIdRef = useRef(0);
    const [layoutTick, setLayoutTick] = useState(0);
    const [isRendered, setIsRendered] = useState(isVisible);
    const [isLayoutStable, setIsLayoutStable] = useState(false);

    const resetAnimationValues = useCallback(() => {
        overlayOpacity.stopAnimation();
        sheetOpacity.stopAnimation();
        sheetTranslateY.stopAnimation();

        overlayOpacity.setValue(0);
        sheetOpacity.setValue(0);
        sheetTranslateY.setValue(28);
    }, [overlayOpacity, sheetOpacity, sheetTranslateY]);

    const runEnterAnimation = useCallback(() => {
        Animated.parallel([
            Animated.timing(overlayOpacity, {
                toValue: 1,
                duration: 220,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(sheetOpacity, {
                toValue: 1,
                duration: 180,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
            Animated.timing(sheetTranslateY, {
                toValue: 0,
                duration: 260,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }),
        ]).start();
    }, [overlayOpacity, sheetOpacity, sheetTranslateY]);

    const runExitAnimation = useCallback(
        (onDone: () => void) => {
            Animated.parallel([
                Animated.timing(overlayOpacity, {
                    toValue: 0,
                    duration: 130,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(sheetOpacity, {
                    toValue: 0,
                    duration: 100,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true,
                }),
                Animated.timing(sheetTranslateY, {
                    toValue: 24,
                    duration: 140,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start(() => {
                onDone();
            });
        },
        [overlayOpacity, sheetOpacity, sheetTranslateY],
    );

    // Handle back button on Android
    useEffect(() => {
        if (!isRendered) return;

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                if (isRendered) {
                    onClose();
                    return true;
                }
                return false;
            },
        );

        return () => backHandler.remove();
    }, [isRendered, onClose]);

    useEffect(() => {
        if (isVisible) {
            closeRunIdRef.current += 1;
            setIsRendered(true);
            setIsLayoutStable(false);
            resetAnimationValues();
            return;
        }

        if (!isRendered) return;

        const closeRunId = closeRunIdRef.current + 1;
        closeRunIdRef.current = closeRunId;

        runExitAnimation(() => {
            if (closeRunIdRef.current !== closeRunId) return;
            setIsRendered(false);
            setIsLayoutStable(false);
            resetAnimationValues();
        });
    }, [isVisible, isRendered, runExitAnimation, resetAnimationValues]);

    useEffect(() => {
        if (!isVisible || !isRendered || !isLayoutStable) return;
        runEnterAnimation();
    }, [isVisible, isRendered, isLayoutStable, runEnterAnimation]);

    const modalContentStyle: ViewStyle = {
        maxHeight: maxHeight as any,
        backgroundColor,
        borderTopLeftRadius: borderRadius,
        borderTopRightRadius: borderRadius,
    };

    const handleModalShow = useCallback(() => {
        // Force one extra layout pass right after open.
        // This stabilizes Android Modal geometry on some devices.
        requestAnimationFrame(() => {
            setLayoutTick((prev) => prev + 1);
            requestAnimationFrame(() => {
                setIsLayoutStable(true);
            });
        });
    }, []);

    if (!isRendered) {
        return null;
    }

    return (
        <Modal
            visible={isRendered}
            transparent
            animationType="none"
            presentationStyle="overFullScreen"
            statusBarTranslucent
            navigationBarTranslucent
            hardwareAccelerated
            onShow={handleModalShow}
            onRequestClose={onClose}
        >
            <View key={layoutTick} style={styles.container}>
                <View style={styles.overlayContainer}>
                    <Animated.View
                        style={[
                            styles.overlay,
                            { opacity: overlayOpacity },
                        ]}
                    >
                        <Pressable
                            style={styles.overlayPressable}
                            onPress={onClose}
                        />
                    </Animated.View>
                </View>
                <View style={styles.modalWrapper} pointerEvents="box-none">
                    <Animated.View
                        style={[
                            styles.modalContent,
                            modalContentStyle,
                            {
                                opacity: sheetOpacity,
                                transform: [{ translateY: sheetTranslateY }],
                            },
                        ]}
                    >
                        {children}
                    </Animated.View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: Colors.dark.transparent,
    },
    overlayContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: Colors.dark.overlayBlack50,
    },
    overlayPressable: {
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
    },
    modalWrapper: {
        flex: 1,
        backgroundColor: Colors.dark.transparent,
        justifyContent: 'flex-end',
    },
    modalContent: {
        padding: 20,
        width: '100%',
    },
});
