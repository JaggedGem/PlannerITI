import TestRenderer, { act } from 'react-test-renderer';

import React, { StrictMode } from 'react';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

export async function renderHook<T>(hook: () => T, strict = false) {
  let current!: T;
  let renderer!: TestRenderer.ReactTestRenderer;
  function Harness() {
    current = hook();
    return null;
  }
  await act(async () => {
    renderer = TestRenderer.create(
      strict ? (
        <StrictMode>
          <Harness />
        </StrictMode>
      ) : (
        <Harness />
      ),
    );
  });
  return {
    get current() {
      return current;
    },
    unmount: async () => {
      await act(async () => {
        renderer.unmount();
      });
    },
  };
}
