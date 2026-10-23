import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';

import React, { useCallback, useEffect, useId, useMemo, useRef } from 'react';

import { BackHandler, Platform, StyleProp, StyleSheet, ViewStyle } from 'react-native';

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

interface BottomModalPortalProps {
  isVisible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: string | number;
  snapPoints?: (string | number)[];
  borderRadius?: number;
  showDragIndicator?: boolean;
  enablePanDownToClose?: boolean;
  enableDynamicSizing?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

/**
 * Standardized bottom-sheet wrapper for app modals.
 * Powered by @gorhom/bottom-sheet.
 */
export function BottomModalPortal({
  isVisible,
  onClose,
  children,
  maxHeight,
  snapPoints,
  borderRadius = 20,
  showDragIndicator = true,
  enablePanDownToClose = true,
  enableDynamicSizing = true,
  contentContainerStyle,
}: BottomModalPortalProps) {
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);
  const isPresentedRef = useRef(false);
  const modalId = useId();
  const colorScheme = useColorScheme();
  const theme = Colors[colorScheme];
  const { availableWidth, availableHeight, insets } = useResponsiveLayout();
  const horizontalMargin = Math.max(0, (availableWidth - 640) / 2);
  const resolvedSnapPoints = useMemo(
    () => (snapPoints && snapPoints.length > 0 ? snapPoints : undefined),
    [snapPoints],
  );

  const sheetContentStyle = useMemo<ViewStyle>(() => {
    const resolvedStyle: ViewStyle = {
      backgroundColor: theme.backgroundApp,
      borderTopLeftRadius: borderRadius,
      borderTopRightRadius: borderRadius,
      ...(maxHeight != null ? { maxHeight: maxHeight as ViewStyle['maxHeight'] } : {}),
    };
    return resolvedStyle;
  }, [maxHeight, borderRadius, theme.backgroundApp]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
        opacity={0.45}
      />
    ),
    [],
  );

  const handleDismiss = useCallback(() => {
    isPresentedRef.current = false;
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (isVisible) {
      if (!isPresentedRef.current) {
        const frame = requestAnimationFrame(() => {
          if (bottomSheetModalRef.current) {
            bottomSheetModalRef.current.present();
            isPresentedRef.current = true;
          }
        });
        return () => cancelAnimationFrame(frame);
      }
      return;
    }

    if (isPresentedRef.current) {
      bottomSheetModalRef.current?.dismiss();
    }
  }, [isVisible]);

  useEffect(() => {
    if (Platform.OS !== 'android' || !isVisible) {
      return;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (isPresentedRef.current) {
        bottomSheetModalRef.current?.dismiss();
      } else {
        onClose();
      }
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [isVisible, onClose]);

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      name={`bottom-modal-${modalId.replace(/:/g, '')}`}
      index={0}
      onDismiss={handleDismiss}
      enablePanDownToClose={enablePanDownToClose}
      enableDynamicSizing={enableDynamicSizing}
      snapPoints={resolvedSnapPoints}
      topInset={insets.top + 12}
      maxDynamicContentSize={Math.max(0, availableHeight - 24)}
      style={{
        marginLeft: insets.left + horizontalMargin,
        marginRight: insets.right + horizontalMargin,
      }}
      handleComponent={showDragIndicator ? undefined : null}
      backgroundStyle={[
        styles.sheetBackground,
        {
          backgroundColor: theme.backgroundApp,
          borderTopLeftRadius: borderRadius,
          borderTopRightRadius: borderRadius,
        },
      ]}
      handleIndicatorStyle={[styles.handleIndicator, { backgroundColor: theme.borderMuted }]}
      backdropComponent={renderBackdrop}
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetView
        style={[
          styles.sheetContent,
          sheetContentStyle,
          { paddingBottom: Math.max(16, insets.bottom) },
          contentContainerStyle,
        ]}
      >
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheetBackground: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleIndicator: {
    width: 40,
    height: 4,
  },
  sheetContent: {
    paddingTop: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    width: '100%',
  },
});
