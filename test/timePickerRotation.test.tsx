import TestRenderer, { act } from 'react-test-renderer';

import React from 'react';

import { ScrollView, TouchableOpacity } from 'react-native';

import { TimePicker } from '@/components/TimePicker';

const mockScrollTo = jest.fn();
let mockIsCompactHeight = false;

jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Animated: {
      Value: class {},
      timing: jest.fn(),
      parallel: () => ({ start: jest.fn() }),
      View: 'AnimatedView',
    },
    Modal: 'Modal',
    Platform: { OS: 'ios', select: () => 0.992 },
    ScrollView: React.forwardRef(function MockScrollView(props: object, ref) {
      React.useImperativeHandle(ref, () => ({ scrollTo: mockScrollTo }));
      return React.createElement('ScrollView', props);
    }),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: 'Text',
    TouchableOpacity: 'TouchableOpacity',
    View: 'View',
  };
});
jest.mock('@/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({
    isCompactHeight: mockIsCompactHeight,
    availableHeight: mockIsCompactHeight ? 354 : 820,
    insets: { top: 0, bottom: 21 },
  }),
}));
jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: () => ({ cancel: 'Cancel', confirm: 'Confirm' }),
    formatTimeFromDate: (date: Date) => `${date.getHours()}:${date.getMinutes()}`,
  }),
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(),
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Medium: 'medium' },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

it('keeps the selected time and recenters both wheels when rotating an open picker', async () => {
  jest.useFakeTimers();
  const onChange = jest.fn();
  const onClose = jest.fn();
  const initialValue = new Date(2026, 9, 23, 9, 15);
  const content = () => (
    <TimePicker value={initialValue} onChange={onChange} onClose={onClose} label="Time" />
  );
  let renderer!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    renderer = TestRenderer.create(content());
  });
  await act(async () => jest.advanceTimersByTime(50));
  const wheels = renderer.root.findAllByType(ScrollView);
  await act(async () => {
    wheels[0].props.onScroll({ nativeEvent: { contentOffset: { y: 22 * 56 } } });
    wheels[1].props.onScroll({ nativeEvent: { contentOffset: { y: 42 * 56 } } });
  });

  for (const isCompactHeight of [true, false, true]) {
    mockIsCompactHeight = isCompactHeight;
    await act(async () => renderer.update(content()));
    mockScrollTo.mockClear();
    await act(async () => jest.advanceTimersByTime(50));
    const itemHeight = isCompactHeight ? 36 : 56;
    expect(mockScrollTo).toHaveBeenNthCalledWith(1, { y: 22 * itemHeight, animated: false });
    expect(mockScrollTo).toHaveBeenNthCalledWith(2, { y: 42 * itemHeight, animated: false });
    expect(renderer.root.findAllByType(ScrollView)[0].props.style.height).toBe(
      isCompactHeight ? 108 : 280,
    );
  }

  await act(async () => {
    renderer.root.findAllByType(TouchableOpacity)[1].props.onPress();
  });
  expect(onChange.mock.calls[0][0].getHours()).toBe(22);
  expect(onChange.mock.calls[0][0].getMinutes()).toBe(42);
  expect(onClose).toHaveBeenCalledTimes(1);
  await act(async () => renderer.unmount());
  jest.useRealTimers();
});
