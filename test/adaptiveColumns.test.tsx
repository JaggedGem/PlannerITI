import TestRenderer, { act } from 'react-test-renderer';

import React, { useState } from 'react';

import { Pressable, Text } from 'react-native';

import { AdaptiveColumns } from '@/components/ui/AdaptiveColumns';

jest.mock('react-native', () => ({
  View: 'View',
  Pressable: 'Pressable',
  Text: 'Text',
  StyleSheet: { create: (styles: unknown) => styles },
}));

let mockHasTwoColumns = false;
jest.mock('@/hooks/useResponsiveLayout', () => ({
  useResponsiveLayout: () => ({ hasTwoColumns: mockHasTwoColumns }),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function ExpandableCard({ name }: { name: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <Pressable onPress={() => setIsExpanded(!isExpanded)} testID={name}>
      <Text>{isExpanded ? `${name} details` : name}</Text>
    </Pressable>
  );
}

it('preserves reading order and expanded content through rotation and resizing', async () => {
  let renderer!: TestRenderer.ReactTestRenderer;
  const content = () => (
    <AdaptiveColumns>
      {['Monday', 'Tuesday', 'Wednesday'].map((name) => (
        <ExpandableCard key={name} name={name} />
      ))}
    </AdaptiveColumns>
  );

  await act(async () => {
    renderer = TestRenderer.create(content());
  });
  await act(async () => {
    renderer.root.findAllByType(Pressable)[1].props.onPress();
  });
  for (const hasTwoColumns of [true, false, true]) {
    mockHasTwoColumns = hasTwoColumns;
    await act(async () => renderer.update(content()));
    expect(renderer.root.findAllByType(Text).map((node) => node.props.children)).toEqual([
      'Monday',
      'Tuesday details',
      'Wednesday',
    ]);
  }
  await act(async () => renderer.unmount());
});
