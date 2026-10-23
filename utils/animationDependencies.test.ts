import { Platform } from 'react-native';

import { getAnimationDependencies } from './animationDependencies';

jest.mock('react-native', () => ({ Platform: { OS: 'android' } }));

it.each(['android', 'ios'] as const)('omits ignored animation dependencies on %s', (platform) => {
  jest.replaceProperty(Platform, 'OS', platform);
  expect(getAnimationDependencies([1, 2])).toBeUndefined();
});

it('preserves the dependency array for web without changing its identity', () => {
  jest.replaceProperty(Platform, 'OS', 'web');
  const dependencies = [1, 2];
  expect(getAnimationDependencies(dependencies)).toBe(dependencies);
});
