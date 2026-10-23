/** Combine a caller's cancellation signal with a request deadline, cleaning up both. */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 8000,
): Promise<Response> {
  const controller = new AbortController();
  const upstream = options.signal;
  let timedOut = false;
  const abort = () => controller.abort();
  if (upstream?.aborted) {
    const error = new Error('Request cancelled');
    error.name = 'AbortError';
    throw error;
  }
  upstream?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (timedOut && !upstream?.aborted) throw new Error('Request timeout');
    throw error;
  } finally {
    clearTimeout(timeout);
    upstream?.removeEventListener('abort', abort);
  }
}
