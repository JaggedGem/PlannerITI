import { useState, useCallback, useEffect } from 'react';
import { Assignment } from '../utils/assignmentStorage';
import { getAssignments, toggleAssignmentCompletion as toggleCompletion, deleteAssignment as deleteAssignmentStorage } from '../utils/assignmentStorage';

export function useAssignments() {
  const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
  const [archivedAssignments, setArchivedAssignments] = useState<Assignment[]>([]);

  // Fetch assignments
  const fetchAssignments = useCallback(async () => {
    try {
      const assignments = await getAssignments();
      
      // Separate current and archived assignments
      const now = new Date();
      const current: Assignment[] = [];
      const archived: Assignment[] = [];
      
      assignments.forEach(assignment => {
        const dueDate = new Date(assignment.dueDate);
        // If due date is in the past, move to archive regardless of completion status
        if (dueDate < now) {
          archived.push(assignment);
        } else {
          current.push(assignment);
        }
      });
      
      setAllAssignments(current);
      setArchivedAssignments(archived);
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  }, []);

  // Load assignments on mount
  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Toggle assignment completion
  const toggleAssignmentCompletion = useCallback(async (id: string) => {
    try {
      await toggleCompletion(id);
      await fetchAssignments(); // Refresh assignments after toggle
    } catch (error) {
      console.error('Error toggling assignment:', error);
    }
  }, [fetchAssignments]);

  // Delete assignment
  const deleteAssignment = useCallback(async (id: string) => {
    try {
      await deleteAssignmentStorage(id);
      await fetchAssignments(); // Refresh assignments after deletion
    } catch (error) {
      console.error('Error deleting assignment:', error);
    }
  }, [fetchAssignments]);

  return {
    allAssignments,
    archivedAssignments,
    toggleAssignmentCompletion,
    deleteAssignment,
    refreshAssignments: fetchAssignments
  };
} 