import TestRenderer, { act } from 'react-test-renderer';

import React from 'react';

import { Pressable, Text, TouchableOpacity } from 'react-native';

import AssignmentItem from '@/components/assignments/AssignmentItem';
import { createAssignment } from '@/test/fixtures';
import { Subtask } from '@/types/assignment';

let mockStoredSubtasks: Subtask[] = [];

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: async () => null,
  setItem: async () => {},
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('react-native', () => ({
  Pressable: 'Pressable',
  Text: 'Text',
  TextInput: 'TextInput',
  TouchableOpacity: 'TouchableOpacity',
  View: 'View',
  StyleSheet: { create: (styles: unknown) => styles },
}));
jest.mock('@react-native-vector-icons/ionicons', () => ({ Ionicons: () => null }));
jest.mock('react-native-reanimated', () => {
  const chain = { duration: () => chain, springify: () => chain, mass: () => chain };
  return {
    __esModule: true,
    default: { View: 'AnimatedView', createAnimatedComponent: (component: unknown) => component },
    FadeIn: chain,
    FadeOut: chain,
    Layout: chain,
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (callback: () => unknown) => callback(),
    withTiming: (value: number) => value,
  };
});
jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: keyof typeof import('@/constants/Translations').translations.en) =>
      jest.requireActual<typeof import('@/constants/Translations')>('@/constants/Translations')
        .translations.en[key],
    currentLanguage: 'en',
    formatTimeFromDate: () => '12:00 PM',
  }),
}));
jest.mock('@/utils/assignmentStorage', () => ({
  AssignmentType:
    jest.requireActual<typeof import('@/types/assignment')>('@/types/assignment').AssignmentType,
  getPeriodById: async () => null,
  getSubtasksForAssignment: async () => mockStoredSubtasks,
  updateAllSubtaskCompletion: async (_id: string, isCompleted: boolean) => {
    mockStoredSubtasks = mockStoredSubtasks.map((task) => ({ ...task, isCompleted }));
  },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('shows saved subtasks after remount, expansion, refresh, and countdown ticks without RelativeTimeFormat', async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-23T10:00:00Z'));
  const descriptor = Object.getOwnPropertyDescriptor(Intl, 'RelativeTimeFormat')!;
  Object.defineProperty(Intl, 'RelativeTimeFormat', { configurable: true, value: undefined });
  let renderer!: TestRenderer.ReactTestRenderer;
  let assignment = createAssignment({
    subtasks: [{ id: 'step-1', title: 'Saved subtask', isCompleted: false }],
  });
  const content = () => (
    <AssignmentItem
      assignment={assignment}
      onToggle={() => {
        assignment = { ...assignment, isCompleted: !assignment.isCompleted };
        renderer.update(content());
      }}
    />
  );
  const texts = () =>
    renderer.root
      .findAllByType(Text)
      .map((node) => node.props.children)
      .flat()
      .join(' ');
  try {
    for (let mount = 0; mount < 2; mount++) {
      await act(async () => {
        renderer = TestRenderer.create(content());
      });
      for (let toggle = 0; toggle < 3; toggle++) {
        await act(async () =>
          renderer.root
            .findAllByType(TouchableOpacity)
            .find((node) => node.props.accessibilityState?.expanded !== undefined)!
            .props.onPress(),
        );
        if (toggle % 2 === 0) expect(texts()).toContain('Saved subtask');
      }
      await act(async () => jest.advanceTimersByTime(60_000));
      expect(texts()).toContain('Saved subtask');
      assignment = {
        ...assignment,
        subtasks: [
          ...assignment.subtasks!,
          { id: `new-${mount}`, title: 'Refreshed subtask', isCompleted: false },
        ],
      };
      await act(async () => renderer.update(content()));
      expect(texts()).toContain('Refreshed subtask');
      mockStoredSubtasks = assignment.subtasks!;
      await act(async () => renderer.root.findAllByType(Pressable)[0].props.onPress());
      const savedTitle = renderer.root
        .findAllByType(Text)
        .find((node) => node.props.children === 'Saved subtask')!;
      expect(
        savedTitle.props.style.some(
          (style: { textDecorationLine?: string } | false) =>
            style && style.textDecorationLine === 'line-through',
        ),
      ).toBe(assignment.isCompleted);
      assignment = { ...assignment, subtasks: mockStoredSubtasks };
      await act(async () => renderer.unmount());
    }
  } finally {
    Object.defineProperty(Intl, 'RelativeTimeFormat', descriptor);
    jest.useRealTimers();
  }
});
