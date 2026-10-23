import { Ionicons } from '@react-native-vector-icons/ionicons';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';

import React from 'react';

import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Colors } from '@/constants/Colors';
import { useTranslation } from '@/hooks/useTranslation';
import { Subtask } from '@/types/assignment';

export function AssignmentSubtasksField({
  subtasks,
  newTitle,
  onTitleChange,
  onAdd,
  onRemove,
  onToggle,
}: {
  subtasks: Subtask[];
  newTitle: string;
  onTitleChange: (title: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Ionicons name="layers-outline" size={22} color={Colors.dark.primaryStrong} />
        <Text style={styles.headingText}>{t('assignments').subtasks.title}</Text>
      </View>
      {subtasks.map((task) => (
        <Animated.View
          key={task.id}
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(150)}
          layout={Layout.springify()}
          style={styles.task}
        >
          <TouchableOpacity
            onPress={() => onToggle(task.id)}
            style={styles.taskContent}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: task.isCompleted }}
            accessibilityLabel={task.title}
          >
            <View style={[styles.checkbox, task.isCompleted && styles.checked]}>
              {task.isCompleted && (
                <Ionicons name="checkmark" size={14} color={Colors.dark.white} />
              )}
            </View>
            <Text style={[styles.taskTitle, task.isCompleted && styles.completedTitle]}>
              {task.title}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => onRemove(task.id)}
            style={styles.remove}
            accessibilityRole="button"
            accessibilityLabel={`${t('common').delete}: ${task.title}`}
          >
            <Ionicons name="close-circle" size={22} color={Colors.dark.red} />
          </TouchableOpacity>
        </Animated.View>
      ))}
      <View style={styles.inputRow}>
        <Ionicons name="add-outline" size={22} color={Colors.dark.neutral500} />
        <TextInput
          style={styles.input}
          value={newTitle}
          onChangeText={onTitleChange}
          onSubmitEditing={onAdd}
          placeholder={
            subtasks.length ? t('assignments').subtasks.add : t('assignments').subtasks.addFirst
          }
          placeholderTextColor={Colors.dark.neutral500}
        />
        <TouchableOpacity
          onPress={onAdd}
          disabled={!newTitle.trim()}
          accessibilityRole="button"
          accessibilityLabel={t('assignments').subtasks.add}
          style={[styles.add, !newTitle.trim() && { opacity: 0.4 }]}
        >
          <Ionicons name="arrow-up" size={18} color={Colors.dark.white} />
        </TouchableOpacity>
      </View>
      {subtasks.length === 0 && <Text style={styles.hint}>{t('assignments').subtasks.hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
    padding: 16,
    borderRadius: 18,
    backgroundColor: Colors.dark.surfaceSecondary,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  headingText: { color: Colors.dark.white, fontSize: 18, fontWeight: '600' },
  task: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: Colors.dark.backgroundTertiary,
  },
  taskContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: Colors.dark.primaryStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { backgroundColor: Colors.dark.primaryStrong },
  taskTitle: { flex: 1, color: Colors.dark.white, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  completedTitle: { textDecorationLine: 'line-through', color: Colors.dark.neutral500 },
  remove: { padding: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 12,
    backgroundColor: Colors.dark.backgroundTertiary,
  },
  input: { flex: 1, minWidth: 0, color: Colors.dark.white, fontSize: 14, paddingVertical: 8 },
  add: { padding: 8, borderRadius: 10, backgroundColor: Colors.dark.primaryStrong },
  hint: { color: Colors.dark.neutral500, fontSize: 12, lineHeight: 18, marginTop: 12 },
});
