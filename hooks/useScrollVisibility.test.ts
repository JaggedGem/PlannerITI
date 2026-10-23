import { renderHook } from '@/test/renderHook';

import { useScrollVisibility } from './useScrollVisibility';

jest.mock('react-native-reanimated', () => ({
  useSharedValue: (value: number) => ({ value }),
  useAnimatedScrollHandler: (handlers: { onScroll: (event: unknown) => void }) => handlers.onScroll,
  useAnimatedStyle: (callback: () => Record<string, unknown>) =>
    new Proxy({}, { get: (_target, key: string) => callback()[key] }),
  withTiming: (value: number) => value,
}));

it('hides on downward scroll, reveals on upward scroll, and clamps overscroll', async () => {
  const hook = await renderHook(useScrollVisibility);
  const style = hook.current.animatedStyle as unknown as { opacity: number; pointerEvents: string };
  const scroll = (y: number) =>
    hook.current.onScroll({ contentOffset: { y } } as unknown as Parameters<
      typeof hook.current.onScroll
    >[0]);
  expect(style.opacity).toBe(1);
  scroll(32);
  expect(style.opacity).toBe(0.5);
  scroll(200);
  expect(style.opacity).toBe(0);
  expect(style.pointerEvents).toBe('none');
  scroll(168);
  expect(style.opacity).toBe(0.5);
  scroll(-20);
  expect(style.opacity).toBe(1);
  scroll(100);
  hook.current.reset();
  expect(style.opacity).toBe(1);
  scroll(10);
  expect(style.opacity).toBeGreaterThan(0.8);
  await hook.unmount();
});
