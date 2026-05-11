import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions, BackHandler, Platform, StatusBar, Pressable, Modal, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
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
  // Handle back button on Android
  useEffect(() => {
    if (!isVisible) return;
    
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isVisible) {
        onClose();
        return true;
      }
      return false;
    });
    
    return () => backHandler.remove();
  }, [isVisible, onClose]);

  const modalContentStyle: ViewStyle = {
    maxHeight: maxHeight as any,
    backgroundColor,
    borderTopLeftRadius: borderRadius,
    borderTopRightRadius: borderRadius,
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Animated.View
          style={styles.overlayContainer}
          entering={FadeIn.duration(240)}
          exiting={FadeOut.duration(140)}
        >
          <Pressable 
            style={styles.overlay}
            onPress={onClose}
          />
        </Animated.View>
        <View style={styles.modalWrapper}>
          <Animated.View
            style={[
              styles.modalContent,
              modalContentStyle,
            ]}
            entering={SlideInDown.springify(50)}
            exiting={SlideOutDown.duration(140)}
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
  modalWrapper: {
    flex: 1,
    backgroundColor: Colors.dark.transparent,
    justifyContent: 'flex-end',
  },
  modalContent: {
    padding: 20,
    width: '100%',
  }
});
