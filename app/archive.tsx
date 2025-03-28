import React from 'react';
import ArchiveView from '@/components/assignments/ArchiveView';
import { useAssignments } from '@/hooks/useAssignments';

export default function ArchiveScreen() {
  const { 
    archivedAssignments, 
    toggleAssignmentCompletion, 
    deleteAssignment
  } = useAssignments();

  return (
    <ArchiveView
      assignments={archivedAssignments}
      onToggleAssignment={toggleAssignmentCompletion}
      onDeleteAssignment={deleteAssignment}
    />
  );
} 