// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { installCaptureHook, CAPTURE_EVENT } from '../src/content/capture';
import { installCaptureForwarding } from '../src/content/capture-forward';

function fakeWindow() {
  const events: Array<{ type: string; detail?: unknown }> = [];
  const w = {
    fetch: vi.fn(async () => new Response('{}')),
    XMLHttpRequest: undefined,
    dispatchEvent: (e: Event) => {
      events.push({ type: e.type, detail: (e as CustomEvent).detail });
      return true;
    },
    CustomEvent: class CustomEventPolyfill {
      type: string;
      detail: unknown;
      constructor(type: string, init: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    },
  };
  return { w: w as unknown as Window & typeof globalThis, events };
}

describe('installCaptureHook', () => {
  it('emits fetch requests with string body', async () => {
    const { w, events } = fakeWindow();
    installCaptureHook(w);
    await w.fetch('https://api.bilibili.com/x/feed/dislike?aid=1', { body: 'a=b' });
    expect(events).toEqual([
      { type: 'bcf:capture', detail: { url: 'https://api.bilibili.com/x/feed/dislike?aid=1', body: 'a=b' } },
    ]);
  });

  it('emits URLSearchParams bodies serialized', async () => {
    const { w, events } = fakeWindow();
    installCaptureHook(w);
    await w.fetch('https://api.bilibili.com/x/feed/dislike', { body: new URLSearchParams({ aid: '9' }) });
    expect(events[0].detail).toMatchObject({ body: 'aid=9' });
  });

  it('does not break normal fetches', async () => {
    const { w } = fakeWindow();
    installCaptureHook(w);
    const res = await w.fetch('https://api.bilibili.com/x/web-interface/ranking/v2');
    expect(await res.text()).toBe('{}');
  });
});

describe('installCaptureForwarding', () => {
  const realFetch = window.fetch;

  afterEach(() => {
    window.fetch = realFetch;
  });

  it('adds and removes the capture listener without touching fetch', () => {
    const onCapture = vi.fn();
    const addSpy = vi.spyOn(window, 'addEventListener');
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const remove = installCaptureForwarding(onCapture);

    expect(addSpy).toHaveBeenCalledWith('bcf:capture', expect.any(Function));
    remove();
    expect(removeSpy).toHaveBeenCalledWith('bcf:capture', expect.any(Function));
    expect(window.fetch).toBe(realFetch);
    expect(CAPTURE_EVENT).toBe('bcf:capture');
  });

  it('forwards matching capture events to the callback', () => {
    const onCapture = vi.fn();
    installCaptureForwarding(onCapture);
    window.dispatchEvent(
      new CustomEvent(CAPTURE_EVENT, { detail: { url: 'https://x', body: null } }),
    );
    expect(onCapture).toHaveBeenCalledWith('https://x', null);
  });
});
