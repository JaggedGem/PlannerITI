import React from 'react';
import ArchiveView from '@/components/assignments/ArchiveView';
import { useAssignments } from '@/hooks/useAssignments';
import { Stack } from 'expo-router';
import { useTranslation } from '@/hooks/useTranslation';

export default function ArchiveScreen() {
  const { 
    archivedAssignments, 
    toggleAssignmentCompletion, 
    deleteAssignment
  } = useAssignments();
  
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('assignments').archive.title }} />
      <ArchiveView
        assignments={archivedAssignments}
        onToggleAssignment={toggleAssignmentCompletion}
        onDeleteAssignment={deleteAssignment}
      />
    </>
  );
} 