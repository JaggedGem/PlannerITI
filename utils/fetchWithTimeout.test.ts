import { fetchWithTimeout } from './fetchWithTimeout';

const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
beforeEach(() => {
  jest.useFakeTimers();
  globalThis.fetch = mockFetch;
  mockFetch.mockReset();
});
afterEach(() => {
  jest.useRealTimers();
});

const waitForAbort = (_input: RequestInfo | URL, options?: RequestInit): Promise<Response> =>
  new Promise((_, reject) => {
    options?.signal?.addEventListener('abort', () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      reject(error);
    });
  });

it('does not start requests that were already cancelled', async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(fetchWithTimeout('/test', { signal: controller.signal })).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(mockFetch).not.toHaveBeenCalled();
  expect(jest.getTimerCount()).toBe(0);
});

it('forwards cancellation and removes its listener and timer', async () => {
  mockFetch.mockImplementation(waitForAbort);
  const controller = new AbortController();
  const remove = jest.spyOn(controller.signal, 'removeEventListener');
  const request = fetchWithTimeout('/test', { signal: controller.signal });
  const rejected = expect(request).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await rejected;
  expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  expect(jest.getTimerCount()).toBe(0);
});

it('distinguishes a deadline from user cancellation', async () => {
  mockFetch.mockImplementation(waitForAbort);
  const rejected = expect(fetchWithTimeout('/test', {}, 100)).rejects.toThrow('Request timeout');
  jest.advanceTimersByTime(100);
  await rejected;
  expect(jest.getTimerCount()).toBe(0);
});

it('cleans up after successful responses and network errors', async () => {
  const response = new Response('ok');
  mockFetch.mockResolvedValueOnce(response);
  await expect(fetchWithTimeout('/test')).resolves.toBe(response);
  mockFetch.mockRejectedValueOnce(new TypeError('offline'));
  await expect(fetchWithTimeout('/test')).rejects.toThrow('offline');
  expect(jest.getTimerCount()).toBe(0);
});
