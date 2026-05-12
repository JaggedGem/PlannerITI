import React, { useEffect } from 'react';
import {
    StyleSheet,
    View,
    Dimensions,
    BackHandler,
    Platform,
    StatusBar,
} from 'react-native';
import { ModernDropdown, ModernDropdownProps } from './modernDropdown';
import { Colors } from '@/constants/Colors';

/**
 * A wrapper around ModernDropdown that ensures it always renders on top
 * of other content regardless of parent layout or content changes
 */
export function ModernDropdownPortal(props: ModernDropdownProps) {
    const { isVisible, onClose, ...dropdownProps } = props;

    // Handle back button on Android
    useEffect(() => {
        if (!isVisible) return;

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                if (isVisible) {
                    onClose();
                    return true;
                }
                return false;
            },
        );

        return () => backHandler.remove();
    }, [isVisible, onClose]);

    // Ensure props pass through correctly to ModernDropdown
    if (!isVisible) {
        return null;
    }

    // Use the window dimensions to ensure full screen coverage
    const window = Dimensions.get('window');
    const statusBarHeight = StatusBar.currentHeight || 0;
    const fullHeight =
        window.height + (Platform.OS === 'android' ? statusBarHeight : 0);

    return (
        <View
            style={[
                styles.portalContainer,
                { width: window.width, height: fullHeight },
            ]}
            pointerEvents="box-none"
        >
            <View style={styles.modalWrapper} pointerEvents="box-none">
                <ModernDropdown
                    {...dropdownProps}
                    isVisible={isVisible}
                    onClose={onClose}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    portalContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 10000,
        elevation: 10000,
        backgroundColor: Colors.dark.transparent,
    },
    modalWrapper: {
        flex: 1,
        backgroundColor: Colors.dark.transparent,
        ...Platform.select({
            ios: {
                zIndex: 10000,
            },
            android: {
                elevation: 10000,
            },
        }),
    },
});
