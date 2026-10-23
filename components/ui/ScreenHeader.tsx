import { SafeAreaView } from 'react-native-safe-area-context';

import React from 'react';

import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

import { Colors } from '@/constants/Colors';

import { contentLayout } from './ContentLayout';

/** Paint to the screen edges while keeping the controls inside system insets. */
export function ScreenHeader({
  children,
  style,
  contentStyle,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.surface, style]}>
      <SafeAreaView edges={['top', 'left', 'right']}>
        <View style={[contentLayout.page, contentStyle]}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    backgroundColor: Colors.dark.backgroundTertiary,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    zIndex: 10,
  },
});
