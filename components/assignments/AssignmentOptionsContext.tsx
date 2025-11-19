import React, { createContext, useContext } from 'react';

// Context for the options menu to avoid circular dependencies
export interface AssignmentOptionsContextType {
  showOptionsMenu: (assignmentId: string, position: { top: number; right: number }, deleteHandler?: () => void) => void;
  hideOptionsMenu: () => void;
}

export const AssignmentOptionsContext = createContext<AssignmentOptionsContextType>({
  showOptionsMenu: () => {},
  hideOptionsMenu: () => {}
});

// Hook to use the options context
export const useAssignmentOptions = () => useContext(AssignmentOptionsContext);
