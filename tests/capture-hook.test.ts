// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { installCaptureHook } from '../src/content/capture';

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
