import React from 'react';

import { View } from 'react-native';

import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';

import { contentLayout } from './ContentLayout';

/** Keep reading order and component identity when the window changes size. */
export function AdaptiveColumns({ children }: { children: React.ReactNode }) {
  const { hasTwoColumns } = useResponsiveLayout();

  return (
    <View style={hasTwoColumns && contentLayout.columns}>
      {React.Children.map(children, (child) =>
        child == null ? null : <View style={hasTwoColumns && contentLayout.column}>{child}</View>,
      )}
    </View>
  );
}
