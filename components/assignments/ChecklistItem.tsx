import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors } from '../../constants/Colors';
import { useColorScheme } from 'react-native';
import { Feather } from '@expo/vector-icons';

export type ChecklistItemType = {
  id: string;
  title: string;
  note: string;
  isCompleted: boolean;
};

type ChecklistItemProps = {
  item: ChecklistItemType;
  onToggle: (id: string) => void;
};

export default function ChecklistItem({ item, onToggle }: ChecklistItemProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.checkbox}
        onPress={() => onToggle(item.id)}
      >
        {item.isCompleted ? (
          <View style={[styles.checked, { backgroundColor: colors.tint }]}>
            <Feather name="check" size={14} color="white" />
          </View>
        ) : (
          <View style={[styles.unchecked, { borderColor: colors.text }]} />
        )}
      </TouchableOpacity>
      <View style={styles.content}>
        <Text 
          style={[
            styles.title, 
            { color: colors.text },
            item.isCompleted && styles.completedText
          ]}
        >
          {item.title}
        </Text>
        <Text style={[styles.note, { color: colors.icon }]}>
          {item.note}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  checkbox: {
    marginRight: 12,
    marginTop: 2,
  },
  unchecked: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
  },
  checked: {
    width: 20,
    height: 20,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  note: {
    fontSize: 14,
    marginTop: 2,
  },
}); 