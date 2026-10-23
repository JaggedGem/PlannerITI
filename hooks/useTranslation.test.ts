import { act } from 'react-test-renderer';

import type { Language } from '@/services/scheduleService';
import { renderHook } from '@/test/renderHook';

import { useTranslation } from './useTranslation';

let mockLanguage: Language = 'en';
const mockListeners = new Set<() => void>();
jest.mock('@/services/scheduleService', () => ({
  scheduleService: {
    getSettings: () => ({ language: mockLanguage }),
    subscribe: (listener: () => void) => {
      mockListeners.add(listener);
      return () => mockListeners.delete(listener);
    },
  },
}));

it('updates messages, dates, and times on language changes and unsubscribes on unmount', async () => {
  const hook = await renderHook(useTranslation);
  expect(hook.current.t('common').error).toBe('Error');
  expect(hook.current.formatTime('14:30')).toBe('2:30 PM');
  await act(async () => {
    mockLanguage = 'ro';
    mockListeners.forEach((listener) => listener());
  });
  expect(hook.current.t('common').error).toBe('Eroare');
  expect(hook.current.formatTime('14:30')).toBe('14:30');
  await act(async () => {
    mockLanguage = 'ru';
    mockListeners.forEach((listener) => listener());
  });
  expect(hook.current.t('common').error).toBe('Ошибка');
  expect(hook.current.formatFullDate(new Date(2026, 0, 15), false)).toContain('15 января');
  await hook.unmount();
  expect(mockListeners.size).toBe(0);
});
