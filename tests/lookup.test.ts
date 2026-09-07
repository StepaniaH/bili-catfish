import { describe, it, expect, vi } from 'vitest';
import { createLookup, cacheKey, type CachedLookup, type LookupResponse } from '../src/content/lookup';
import { handleLookup } from '../src/background/index';

describe('cacheKey', () => {
  it('prefers bvid key', () => {
    expect(cacheKey({ bvid: 'BV1GJ411x7h7', aid: '1' })).toBe('bvid:BV1GJ411x7h7');
    expect(cacheKey({ aid: '1' })).toBe('aid:1');
  });
});

describe('createLookup', () => {
  it('batches concurrent requests and caches results', async () => {
    const send = vi.fn(async (msg: { keys: Array<{ bvid?: string }> }): Promise<LookupResponse> => {
      const out: LookupResponse = {};
      for (const k of msg.keys) {
        out[cacheKey(k)] = { aid: '1', bvid: k.bvid, title: 'T', mid: '2', upName: 'U' };
      }
      return out;
    });
    const lookup = createLookup(send);
    const [a, b] = await Promise.all([
      lookup.lookup([{ bvid: 'BVA' }]),
      lookup.lookup([{ bvid: 'BVA' }]),
    ]);
    expect(send).toHaveBeenCalledTimes(1); // 第二次命中缓存
    expect(a.get('bvid:BVA')?.mid).toBe('2');
    expect(b.get('bvid:BVA')?.mid).toBe('2');
  });

  it('negative-caches null results', async () => {
    const send = vi.fn(async (msg: { keys: Array<{ bvid?: string }> }) => ({ [cacheKey(msg.keys[0])]: null }));
    const lookup = createLookup(send);
    const r1 = await lookup.lookup([{ bvid: 'BVX' }]);
    const r2 = await lookup.lookup([{ bvid: 'BVX' }]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(r1.get('bvid:BVX')).toBeNull();
    expect(r2.get('bvid:BVX')).toBeNull();
  });
});

describe('session cache hydration', () => {
  it('hydrates from session cache without sending', async () => {
    const store = new Map<string, CachedLookup>();
    store.set('bvid:BVA', { info: { aid: '1', bvid: 'BVA', mid: '2', upName: 'U' }, at: Date.now() });
    const send = vi.fn(async () => ({}) as LookupResponse);
    const lookup = createLookup(send, async (key) => store.get(key));
    const r = await lookup.lookup([{ bvid: 'BVA' }]);
    expect(send).not.toHaveBeenCalled();
    expect(r.get('bvid:BVA')?.mid).toBe('2');
  });

  it('expired positive entries fall through to send', async () => {
    const store = new Map<string, CachedLookup>();
    store.set('bvid:BVA', { info: { aid: '1', bvid: 'BVA' }, at: Date.now() - 25 * 3600 * 1000 });
    const send = vi.fn(async (msg) => ({ [cacheKey(msg.keys[0])]: { aid: '9', bvid: 'BVA', mid: '8' } }) as LookupResponse);
    const lookup = createLookup(send, async (key) => store.get(key));
    const r = await lookup.lookup([{ bvid: 'BVA' }]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(r.get('bvid:BVA')?.mid).toBe('8');
  });

  it('negative cache entries expire after 1h', async () => {
    const store = new Map<string, CachedLookup>();
    store.set('bvid:BVX', { info: null, at: Date.now() - 2 * 3600 * 1000 });
    const send = vi.fn(async (msg) => ({ [cacheKey(msg.keys[0])]: null }) as LookupResponse);
    const lookup = createLookup(send, async (key) => store.get(key));
    await lookup.lookup([{ bvid: 'BVX' }]);
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe('handleLookup (background core)', () => {
  it('calls view api per key and maps fields', async () => {
    const fetcher = vi.fn(async (url: string) => {
      const bv = new URL(url).searchParams.get('bvid');
      return {
        ok: true,
        json: async () => ({
          code: 0,
          data: { bvid: bv, aid: 170001, title: '标题', owner: { mid: 946974, name: '老番茄' } },
        }),
      };
    });
    const res = await handleLookup([{ bvid: 'BV1GJ411x7h7' }], fetcher as unknown as typeof fetch);
    expect(res['bvid:BV1GJ411x7h7']).toEqual({
      aid: '170001', bvid: 'BV1GJ411x7h7', title: '标题', mid: '946974', upName: '老番茄',
    });
  });

  it('returns null per key on api error, does not throw', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('boom');
    });
    const res = await handleLookup([{ bvid: 'BVX' }, { aid: '5' }], fetcher as unknown as typeof fetch);
    expect(res['bvid:BVX']).toBeNull();
    expect(res['aid:5']).toBeNull();
  });
});
