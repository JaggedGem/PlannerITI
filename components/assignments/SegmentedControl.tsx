import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Colors } from '@/constants/Colors';
import { useThemedStyles } from '@/hooks/useThemedStyles';

type SegmentedControlProps = {
  segments: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
};

export default function SegmentedControl({
  segments,
  selectedIndex,
  onChange,
}: SegmentedControlProps) {
  const { styles } = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      {segments.map((segment, index) => (
        <React.Fragment key={index}>
          {index > 0 && (
            <View style={styles.separator} />
          )}
          <TouchableOpacity
            style={[
              styles.segment,
              index === selectedIndex && styles.selectedSegment,
            ]}
            onPress={() => onChange(index)}
          >
            <Text
              style={[
                styles.segmentText,
                index === selectedIndex ? styles.selectedSegmentText : null,
              ]}
            >
              {segment}
            </Text>
          </TouchableOpacity>
        </React.Fragment>
      ))}
    </View>
  );
}

type ThemeColors = typeof Colors.light;

const createStyles = (colors: ThemeColors) => ({
  container: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surfaceSecondary,
    marginTop: 4,
    position: 'relative',
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  selectedSegment: {
    backgroundColor: colors.primaryStrong,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.mutedText,
  },
  selectedSegmentText: {
    color: colors.white,
    fontWeight: '700',
  },
  separator: {
    width: 1,
    backgroundColor: colors.separatorBackground,
    alignSelf: 'stretch',
    marginVertical: 8,
  },
});