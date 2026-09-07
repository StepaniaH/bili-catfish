import { describe, it, expect } from 'vitest';
import { mergeCacheEntries } from '../src/background/index';

describe('mergeCacheEntries', () => {
  it('merges fresh results over existing entries with timestamps', () => {
    const now = 1000;
    const existing = { 'bvid:OLD': { info: { aid: '0', bvid: 'OLD' }, at: 1 } };
    const merged = mergeCacheEntries(existing, { 'bvid:NEW': { aid: '1', bvid: 'NEW', mid: '2' }, 'bvid:FAIL': null }, now);
    expect(merged['bvid:OLD']).toEqual({ info: { aid: '0', bvid: 'OLD' }, at: 1 });
    expect(merged['bvid:NEW']).toEqual({ info: { aid: '1', bvid: 'NEW', mid: '2' }, at: now });
    expect(merged['bvid:FAIL']).toEqual({ info: null, at: now });
  });

  it('does not mutate input', () => {
    const existing = { 'bvid:OLD': { info: null, at: 1 } };
    const merged = mergeCacheEntries(existing, {}, 1000);
    expect(merged).not.toBe(existing);
    expect(existing['bvid:OLD']).toEqual({ info: null, at: 1 });
  });
});
