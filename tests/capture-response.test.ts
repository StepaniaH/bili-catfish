// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { installCaptureHook, CAPTURE_RESPONSE_EVENT, isObservableResponseUrl } from '../src/content/capture';

function fakeWindow(fetchImpl?: typeof fetch) {
  const events: Array<{ type: string; detail?: unknown }> = [];
  const w = {
    fetch: fetchImpl ?? vi.fn(async () => new Response(JSON.stringify({ data: { item: [] } }))),
    XMLHttpRequest: undefined,
    dispatchEvent: (e: Event) => {
      events.push({ type: e.type, detail: (e as CustomEvent).detail });
      return true;
    },
    CustomEvent: class {
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

describe('isObservableResponseUrl', () => {
  it('matches feed/search/related endpoints with and without wbi', () => {
    expect(isObservableResponseUrl('https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd?x=1')).toBe(true);
    expect(isObservableResponseUrl('https://api.bilibili.com/x/web-interface/index/top/rcmd')).toBe(true);
    expect(isObservableResponseUrl('https://api.bilibili.com/x/web-interface/wbi/search/all/v2?keyword=a')).toBe(true);
    expect(isObservableResponseUrl('https://api.bilibili.com/x/web-interface/search/type?search_type=video')).toBe(true);
    expect(isObservableResponseUrl('https://api.bilibili.com/x/web-interface/archive/related?bvid=BV1')).toBe(true);
  });

  it('rejects other endpoints', () => {
    expect(isObservableResponseUrl('https://api.bilibili.com/x/web-interface/view?bvid=BV1')).toBe(false);
    expect(isObservableResponseUrl('https://api.bilibili.com/x/feed/dislike')).toBe(false);
  });
});

describe('response capture', () => {
  it('emits whitelisted fetch responses as text and leaves the original response readable', async () => {
    const { w, events } = fakeWindow();
    installCaptureHook(w);
    const res = await w.fetch('https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd');
    expect(await res.text()).toContain('item');
    await new Promise((r) => setTimeout(r, 0));
    const ev = events.find((e) => e.type === CAPTURE_RESPONSE_EVENT);
    expect(ev?.detail).toEqual({
      url: 'https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd',
      text: JSON.stringify({ data: { item: [] } }),
    });
  });

  it('does not emit for non-whitelisted responses', async () => {
    const { w, events } = fakeWindow();
    installCaptureHook(w);
    await w.fetch('https://api.bilibili.com/x/web-interface/view?bvid=BV1');
    await new Promise((r) => setTimeout(r, 0));
    expect(events.some((e) => e.type === CAPTURE_RESPONSE_EVENT)).toBe(false);
  });

  it('emits XHR responses on load only for whitelisted urls', () => {
    const fired: Array<{ type: string; cb: () => void }> = [];
    class FakeXHR {
      responseType = '';
      responseText = '{"data":1}';
      response: unknown = null;
      open(_m: string, _u: string) {}
      send(_b?: unknown) {}
      addEventListener(type: string, cb: () => void) {
        fired.push({ type, cb });
      }
    }
    const { w, events } = fakeWindow();
    (w as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXHR;
    installCaptureHook(w);
    const xhr = new FakeXHR();
    xhr.open('GET', 'https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd');
    xhr.send();
    expect(fired.map((f) => f.type)).toEqual(['load']);
    fired[0]!.cb();
    const ev = events.find((e) => e.type === CAPTURE_RESPONSE_EVENT);
    expect(ev?.detail).toEqual({
      url: 'https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd',
      text: '{"data":1}',
    });
  });
});
