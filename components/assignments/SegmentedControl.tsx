import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from 'react-native';

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
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

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

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
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
    backgroundColor: '#2C3DCD',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8A8A8D',
  },
  selectedSegmentText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  separator: {
    width: 1,
    backgroundColor: '#333333',
    alignSelf: 'stretch',
    marginVertical: 8,
  },
}); 