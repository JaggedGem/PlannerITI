import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useWindowDimensions } from 'react-native';

import { getResponsiveLayout } from '@/utils/responsiveLayout';

export function useResponsiveLayout() {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const availableWidth = width - insets.left - insets.right;
  const availableHeight = height - insets.top - insets.bottom;

  return {
    ...getResponsiveLayout(availableWidth, availableHeight, fontScale),
    availableWidth,
    availableHeight,
    fontScale,
    insets,
  };
}
