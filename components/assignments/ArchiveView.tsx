import { Ionicons } from '@react-native-vector-icons/ionicons';

import React, { useMemo } from 'react';

import { SectionList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { contentLayout } from '@/components/ui/ContentLayout';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Colors } from '@/constants/Colors';
import type { Translation } from '@/constants/Translations';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import { useTranslation } from '@/hooks/useTranslation';
import { Assignment } from '@/types/assignment';

interface ArchiveViewProps {
  assignments: Assignment[];
  onToggleAssignment: (id: string) => void;
  onDeleteAssignment: (id: string) => void;
}

function ArchiveCard({
  assignment,
  onToggle,
  onDelete,
}: {
  assignment: Assignment;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { t, formatFullDate } = useTranslation();
  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <TouchableOpacity
          style={[styles.checkbox, assignment.isCompleted && styles.completedCheckbox]}
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: assignment.isCompleted }}
          accessibilityLabel={assignment.title}
        >
          {assignment.isCompleted && (
            <Ionicons name="checkmark" size={18} color={Colors.dark.white} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.copy}
          onPress={() =>
            router.push({ pathname: '/edit-assignment', params: { id: assignment.id } })
          }
          accessibilityRole="button"
          accessibilityLabel={`${t('assignments').edit}: ${assignment.title}`}
        >
          <Text
            style={[styles.title, assignment.isCompleted && styles.completedTitle]}
            numberOfLines={2}
          >
            {assignment.title}
          </Text>
          <Text style={styles.course} numberOfLines={1}>
            {assignment.courseName || t('assignments').common.uncategorized}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`${t('common').delete}: ${assignment.title}`}
        >
          <Ionicons name="trash-outline" size={18} color={Colors.dark.lightPink} />
        </TouchableOpacity>
      </View>
      <View style={styles.cardFooter}>
        <Ionicons name="calendar-outline" size={13} color={Colors.dark.neutral500} />
        <Text style={styles.date}>{formatFullDate(new Date(assignment.dueDate), false)}</Text>
        <View style={styles.typePill}>
          <Text style={styles.typeText}>
            {
              t('assignments').types[
                assignment.assignmentType.toLowerCase() as keyof Translation['assignments']['types']
              ]
            }
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function ArchiveView({
  assignments,
  onToggleAssignment,
  onDeleteAssignment,
}: ArchiveViewProps) {
  const { t } = useTranslation();
  const { hasTwoColumns, isCompactHeight, insets } = useResponsiveLayout();
  const sections = useMemo(() => {
    const grouped = new Map<string, { title: string; assignments: Assignment[] }>();
    const sorted = [...assignments].sort(
      (first, second) => new Date(second.dueDate).getTime() - new Date(first.dueDate).getTime(),
    );
    sorted.forEach((assignment) => {
      const date = new Date(assignment.dueDate);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const group = grouped.get(key) ?? {
        title: `${t('months')[date.getMonth()]} ${date.getFullYear()}`,
        assignments: [],
      };
      group.assignments.push(assignment);
      grouped.set(key, group);
    });
    const columnCount = hasTwoColumns ? 2 : 1;
    return [...grouped.entries()].map(([key, group]) => ({
      key,
      title: group.title,
      data: Array.from({ length: Math.ceil(group.assignments.length / columnCount) }, (_, index) =>
        group.assignments.slice(index * columnCount, (index + 1) * columnCount),
      ),
    }));
  }, [assignments, hasTwoColumns, t]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ScreenHeader contentStyle={[styles.header, isCompactHeight && { paddingVertical: 10 }]}>
        <TouchableOpacity
          style={styles.back}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel={t('common').back}
        >
          <Ionicons name="arrow-back" size={22} color={Colors.dark.white} />
        </TouchableOpacity>
        <View style={styles.copy}>
          <Text style={styles.pageTitle}>{t('assignments').archive.title}</Text>
          {!isCompactHeight && (
            <Text style={styles.course}>{t('assignments').archive.pastDue}</Text>
          )}
        </View>
        <View style={styles.countPill}>
          <Text style={styles.count}>{assignments.length}</Text>
        </View>
      </ScreenHeader>
      <View
        style={[
          styles.list,
          { paddingLeft: insets.left, paddingRight: insets.right, paddingBottom: insets.bottom },
        ]}
      >
        <SectionList
          sections={sections}
          keyExtractor={(row) => row.map((assignment) => assignment.id).join(':')}
          contentContainerStyle={[
            contentLayout.page,
            styles.listContent,
            assignments.length === 0 && { flexGrow: 1 },
          ]}
          stickySectionHeadersEnabled={false}
          initialNumToRender={8}
          windowSize={7}
          showsVerticalScrollIndicator={false}
          renderSectionHeader={({ section }) => (
            <View style={styles.monthHeader}>
              <Text style={styles.monthTitle}>{section.title}</Text>
              <View style={styles.monthRule} />
            </View>
          )}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.map((assignment) => (
                <View style={styles.column} key={assignment.id}>
                  <ArchiveCard
                    assignment={assignment}
                    onToggle={() => onToggleAssignment(assignment.id)}
                    onDelete={() => onDeleteAssignment(assignment.id)}
                  />
                </View>
              ))}
              {hasTwoColumns && item.length === 1 && <View style={styles.column} />}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="archive-outline" size={32} color={Colors.dark.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t('assignments').archive.noItems}</Text>
              <Text style={styles.course}>{t('assignments').archive.pastDue}</Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.dark.backgroundSecondary },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 20 },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: Colors.dark.surfaceSecondary,
  },
  pageTitle: { color: Colors.dark.white, fontSize: 24, fontWeight: '700' },
  copy: { flex: 1, minWidth: 0 },
  countPill: {
    minWidth: 38,
    padding: 10,
    borderRadius: 14,
    backgroundColor: Colors.dark.primaryStrong10,
    alignItems: 'center',
  },
  count: { color: Colors.dark.primary, fontSize: 16, fontWeight: '700' },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, paddingBottom: 24 },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 22,
    paddingBottom: 12,
  },
  monthTitle: { color: Colors.dark.neutral500, fontSize: 14, fontWeight: '600' },
  monthRule: { height: 1, flex: 1, backgroundColor: Colors.dark.border },
  row: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  column: { flex: 1, minWidth: 0 },
  card: { backgroundColor: Colors.dark.surfaceSecondary, borderRadius: 18, padding: 14 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  checkbox: {
    width: 28,
    height: 28,
    borderWidth: 2,
    borderRadius: 9,
    borderColor: Colors.dark.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedCheckbox: {
    backgroundColor: Colors.dark.primaryStrong,
    borderColor: Colors.dark.primaryStrong,
  },
  title: { color: Colors.dark.white, fontSize: 16, lineHeight: 22, fontWeight: '600' },
  completedTitle: { textDecorationLine: 'line-through', color: Colors.dark.neutral500 },
  course: { color: Colors.dark.neutral500, fontSize: 13, lineHeight: 18, marginTop: 4 },
  deleteButton: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.overlayWhite05,
    marginTop: 12,
    paddingTop: 10,
  },
  date: { flex: 1, color: Colors.dark.neutral500, fontSize: 12 },
  typePill: {
    backgroundColor: Colors.dark.overlayPrimary10,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: '40%',
  },
  typeText: { color: Colors.dark.primarySoftText, fontSize: 11, fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 32 },
  emptyIcon: {
    padding: 20,
    borderRadius: 24,
    backgroundColor: Colors.dark.surfaceSecondary,
    marginBottom: 8,
  },
  emptyTitle: { color: Colors.dark.white, fontSize: 20, fontWeight: '600', textAlign: 'center' },
});
