import { describe, it, expect } from 'vitest';
import { AD_FLAGS_MAX_ENTRIES, AD_FLAGS_TTL_MS, createAdFlags, extractAdFlags } from '../src/content/ad-flags';

describe('extractAdFlags', () => {
  it('extracts feed item with is_ad and archive id, video82 => promo', () => {
    const flags = extractAdFlags({
      code: 0,
      data: {
        item: [
          { goto: 'av', bvid: 'BV1organic00', is_ad: 0 },
          { goto: 'ad', is_ad: 1, card_type: 82, archive: { aid: 123, bvid: 'BV1promo0000' } },
        ],
      },
    });
    expect(flags).toEqual([{ kind: 'promo', aid: '123', bvid: 'BV1promo0000', creativeId: undefined }]);
  });

  it('extracts search card with type video_ad_82 => promo', () => {
    const flags = extractAdFlags({ result: [{ type: 'video_ad_82', aid: 9, bvid: 'BV1search000' }] });
    expect(flags).toEqual([{ kind: 'promo', aid: '9', bvid: 'BV1search000', creativeId: undefined }]);
  });

  it('treats picture ads with ad_content as ad, keeps creative_id', () => {
    const flags = extractAdFlags({
      data: { item: { is_ad: 1, card_type: 'picture_ad_0', ad_content: { creative_id: 3358499029 } } },
    });
    expect(flags).toEqual([{ kind: 'ad', aid: undefined, bvid: undefined, creativeId: '3358499029' }]);
  });

  it('ignores organic items', () => {
    expect(extractAdFlags({ data: { item: [{ goto: 'av', aid: 1, bvid: 'BV1organic00' }] } })).toEqual([]);
  });

  it('survives deep structures without throwing', () => {
    const deep: Record<string, unknown> = {};
    let cur = deep;
    for (let i = 0; i < 30; i += 1) {
      cur.next = {};
      cur = cur.next as Record<string, unknown>;
    }
    expect(() => extractAdFlags(deep)).not.toThrow();
  });
});

describe('createAdFlags', () => {
  it('ingests and locates by bvid/aid/creative_id; returns false when nothing changes', () => {
    const store = createAdFlags();
    const text = JSON.stringify({
      data: { item: { is_ad: 1, card_type: 82, aid: 7, bvid: 'BV1promo0000', creative_id: '55' } },
    });
    expect(store.ingest('https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd', text)).toBe(true);
    expect(store.locate({ bvid: 'BV1promo0000' })).toBe('promo');
    expect(store.locate({ aid: '7' })).toBe('promo');
    expect(store.locate({ creativeId: '55' })).toBe('promo');
    expect(store.ingest('https://api.bilibili.com/x/web-interface/wbi/index/top/feed/rcmd', text)).toBe(false);
  });

  it('ignores malformed json', () => {
    const store = createAdFlags();
    expect(store.ingest('https://x', '{oops')).toBe(false);
    expect(store.size()).toBe(0);
  });

  it('expires entries after TTL', () => {
    let t = 0;
    const store = createAdFlags(() => t);
    store.ingest('https://x', JSON.stringify({ is_ad: 1, aid: 1 }));
    expect(store.locate({ aid: '1' })).toBe('ad');
    t = AD_FLAGS_TTL_MS + 1;
    expect(store.locate({ aid: '1' })).toBeNull();
  });

  it('caps entries at AD_FLAGS_MAX_ENTRIES', () => {
    const store = createAdFlags();
    const items = Array.from({ length: AD_FLAGS_MAX_ENTRIES + 10 }, (_, i) => ({ is_ad: 1, aid: i + 1 }));
    store.ingest('https://x', JSON.stringify({ data: { item: items } }));
    expect(store.size()).toBe(AD_FLAGS_MAX_ENTRIES);
    expect(store.locate({ aid: '1' })).toBeNull();
    expect(store.locate({ aid: String(AD_FLAGS_MAX_ENTRIES + 10) })).toBe('ad');
  });
});
