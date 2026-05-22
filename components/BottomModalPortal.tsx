import ExpoBottomSheet, {
  BottomSheetView,
} from "@expo/ui/community/bottom-sheet";
import React, { useMemo } from "react";
import { StyleSheet, ViewStyle, StyleProp } from "react-native";

interface BottomModalPortalProps {
  isVisible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxHeight?: string | number;
  snapPoints?: (string | number)[];
  borderRadius?: number;
  showDragIndicator?: boolean;
  enablePanDownToClose?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

/**
 * Standardized native bottom-sheet wrapper for app modals.
 * Uses Expo SDK 56 native sheet primitives via @expo/ui/community/bottom-sheet.
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
  contentContainerStyle,
}: BottomModalPortalProps) {
  const isOpenIndex = isVisible ? 0 : -1;
  const hasSnapPoints = Boolean(snapPoints && snapPoints.length > 0);

  const sheetContentStyle = useMemo<ViewStyle>(() => {
    const resolvedStyle: ViewStyle = {
      borderTopLeftRadius: borderRadius,
      borderTopRightRadius: borderRadius,
    };
    if (maxHeight != null) {
      resolvedStyle.maxHeight = maxHeight as any;
    }
    return resolvedStyle;
  }, [maxHeight, borderRadius]);

  return (
    <>
      <ExpoBottomSheet
        index={isOpenIndex}
        onClose={onClose}
        enablePanDownToClose={enablePanDownToClose}
        enableDynamicSizing={!hasSnapPoints}
        snapPoints={snapPoints}
        handleComponent={showDragIndicator ? undefined : null}
      >
        <BottomSheetView
          style={[
            styles.sheetContent,
            sheetContentStyle,
            hasSnapPoints && styles.sheetContentFill,
            contentContainerStyle,
          ]}
        >
          {children}
        </BottomSheetView>
      </ExpoBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  sheetContent: {
    paddingTop: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    width: "100%",
  },
  sheetContentFill: {
    flex: 1,
  },
});
