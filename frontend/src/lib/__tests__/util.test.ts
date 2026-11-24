import { anySignal, timeoutSignal } from '../util';
import { api } from '../api';

const native = { timeout: AbortSignal.timeout, any: AbortSignal.any };

// Safari before 16 has no AbortSignal.timeout; before 17.4 no AbortSignal.any.
beforeEach(() => {
  Object.assign(AbortSignal, { timeout: undefined, any: undefined });
});

afterEach(() => {
  Object.assign(AbortSignal, native);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('times out without AbortSignal.timeout', () => {
  vi.useFakeTimers();
  const signal = timeoutSignal(1000);
  vi.advanceTimersByTime(999);
  expect(signal.aborted).toBe(false);
  vi.advanceTimersByTime(1);
  expect(signal.aborted).toBe(true);
  expect((signal.reason as DOMException).name).toBe('TimeoutError');
});

it('follows whichever signal aborts first without AbortSignal.any', () => {
  const first = new AbortController();
  const second = new AbortController();
  const signal = anySignal([first.signal, second.signal]);
  expect(signal.aborted).toBe(false);
  second.abort('stop');
  expect(signal.aborted).toBe(true);
  expect(signal.reason).toBe('stop');
});

it('is already aborted when an input already is', () => {
  const done = new AbortController();
  done.abort('early');
  const signal = anySignal([new AbortController().signal, done.signal]);
  expect(signal.aborted).toBe(true);
  expect(signal.reason).toBe('early');
});

it('loads with GET on browsers without AbortSignal.timeout', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: 1 }), { status: 200 })));
  await expect(api('GET', '/api/songs')).resolves.toEqual({ ok: 1 });
});
