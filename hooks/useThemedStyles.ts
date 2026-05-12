import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

type ThemeColors = typeof Colors.light;

export const useThemedStyles = (create: (colors: ThemeColors) => any) => {
  const scheme = useColorScheme() ?? 'light';
  const colors = Colors[scheme as keyof typeof Colors] as ThemeColors;
  const styles = useMemo(() => StyleSheet.create(create(colors) as any) as any, [colors, create]);

  return { colors, styles };
};
