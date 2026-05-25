import {
  BottomSheetModal,
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import React, {
  useCallback,
  useEffect,
  useRef,
  useMemo,
  useId,
} from "react";
import {
  StyleSheet,
  ViewStyle,
  StyleProp,
  BackHandler,
  Platform,
} from "react-native";
import { Colors } from "@/constants/Colors";
import { useColorScheme } from "@/hooks/useColorScheme";

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
  const resolvedSnapPoints = useMemo(
    () => (snapPoints && snapPoints.length > 0 ? snapPoints : undefined),
    [snapPoints],
  );

  const sheetContentStyle = useMemo<ViewStyle>(() => {
    const resolvedStyle: ViewStyle = {
      backgroundColor: theme.backgroundApp,
      borderTopLeftRadius: borderRadius,
      borderTopRightRadius: borderRadius,
    };
    if (maxHeight != null) {
      resolvedStyle.maxHeight = maxHeight as ViewStyle["maxHeight"];
    }
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
        requestAnimationFrame(() => {
          bottomSheetModalRef.current?.present();
          isPresentedRef.current = true;
        });
      }
      return;
    }

    if (isPresentedRef.current) {
      bottomSheetModalRef.current?.dismiss();
    }
  }, [isVisible]);

  useEffect(() => {
    if (Platform.OS !== "android" || !isVisible) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (isPresentedRef.current) {
          bottomSheetModalRef.current?.dismiss();
        } else {
          onClose();
        }
        return true;
      },
    );

    return () => {
      subscription.remove();
    };
  }, [isVisible, onClose]);

  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      name={`bottom-modal-${modalId.replace(/:/g, "")}`}
      index={0}
      onDismiss={handleDismiss}
      enablePanDownToClose={enablePanDownToClose}
      enableDynamicSizing={enableDynamicSizing}
      snapPoints={resolvedSnapPoints}
      handleComponent={showDragIndicator ? undefined : null}
      backgroundStyle={[
        styles.sheetBackground,
        {
          backgroundColor: theme.backgroundApp,
          borderTopLeftRadius: borderRadius,
          borderTopRightRadius: borderRadius,
        },
      ]}
      handleIndicatorStyle={[
        styles.handleIndicator,
        { backgroundColor: theme.borderMuted },
      ]}
      backdropComponent={renderBackdrop}
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetView
        style={[
          styles.sheetContent,
          sheetContentStyle,
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
    width: "100%",
  },
});
