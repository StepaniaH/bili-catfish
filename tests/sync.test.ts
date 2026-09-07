import { describe, it, expect } from 'vitest';
import { buildExport, parseImport, mergeImport } from '../src/shared/sync';
import { emptyState } from '../src/shared/types';

describe('buildExport / parseImport round-trip', () => {
  it('round-trips rules', () => {
    const s = emptyState();
    s.videos['1'] = { aid: '1', bvid: 'BVA', title: 'T', blockedAt: 100 };
    s.upers['2'] = { mid: '2', name: 'UP', blockedAt: 200 };
    const file = buildExport(s);
    const text = JSON.stringify(file, null, 2);
    const parsed = parseImport(text);
    expect(parsed).not.toBeNull();
    expect(parsed!.videos).toEqual([{ aid: '1', bvid: 'BVA', title: 'T', blockedAt: 100 }]);
    expect(parsed!.upers).toEqual([{ mid: '2', name: 'UP', blockedAt: 200 }]);
  });
});

describe('parseImport', () => {
  it('rejects garbage', () => {
    expect(parseImport('not json')).toBeNull();
    expect(parseImport('{"app":"other"}')).toBeNull();
  });
});

describe('mergeImport', () => {
  it('merges new records, dedupes existing, skips invalid, reports summary', () => {
    const s = emptyState();
    s.videos['1'] = { aid: '1', title: 'old', blockedAt: 1 };
    const data = parseImport(JSON.stringify({
      app: 'bili-catfish', version: 1, exportedAt: '2026-01-01T00:00:00Z',
      videos: [
        { aid: '1', title: 'dup', blockedAt: 2 },
        { aid: '3', bvid: 'BVC', blockedAt: 3 },
        { title: 'no id', blockedAt: 4 },
        { aid: '', blockedAt: 5 },
      ],
      upers: [
        { mid: '9', name: 'A', blockedAt: 6 },
        { mid: '9', name: 'A-dup', blockedAt: 7 },
        { name: 'no mid', blockedAt: 8 },
      ],
    }))!;
    const { state, summary } = mergeImport(s, data);
    expect(Object.keys(state.videos).sort()).toEqual(['1', '3']);
    expect(state.videos['1'].title).toBe('old');
    expect(Object.keys(state.upers)).toEqual(['9']);
    expect(summary).toEqual({ videosAdded: 1, upersAdded: 1, duplicates: 2, invalid: 3 });
  });

  it('preserves paused flag of current state', () => {
    const s = emptyState();
    s.paused = true;
    const data = parseImport(JSON.stringify({ app: 'bili-catfish', version: 1, exportedAt: 'x', videos: [], upers: [] }))!;
    expect(mergeImport(s, data).state.paused).toBe(true);
  });
});
