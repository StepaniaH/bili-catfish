import { describe, it, expect, vi } from 'vitest';
import {
  createMemoryStorage, loadState, addVideoRule, addUperRule,
  removeVideoRule, removeUperRule, setPaused, setBlockAds, clearAll, onStateChange,
  setBlockCourses, setBlockPromos, setBlockedCategory,
} from '../src/shared/store';
import { emptyState } from '../src/shared/types';

function mem() {
  const s = createMemoryStorage();
  return s;
}

it('addVideoRule persists and dedupes by aid', async () => {
  const s = mem();
  expect(await addVideoRule(s, { aid: '1' })).toBe(true);
  expect(await addVideoRule(s, { aid: '1' })).toBe(false);
  const state = await loadState(s);
  expect(state.videos['1'].aid).toBe('1');
  expect(typeof state.videos['1'].blockedAt).toBe('number');
});

it('addVideoRule enriches existing entry, no duplicate', async () => {
  const s = mem();
  await addVideoRule(s, { aid: '1' });
  await addVideoRule(s, { aid: '1', bvid: 'BVA', title: 'T' });
  const state = await loadState(s);
  expect(Object.keys(state.videos)).toEqual(['1']);
  expect(state.videos['1'].title).toBe('T');
});

it('addVideoRule identical enrich is a no-op write', async () => {
  const s = mem();
  const payload = { aid: '1', bvid: 'BVA', title: 'T', upMid: '946974', upName: '老番茄' };
  const cb = vi.fn();
  const off = onStateChange(s, cb);
  await addVideoRule(s, payload);
  const firesAfterFirst = cb.mock.calls.length;
  const result = await addVideoRule(s, payload);
  expect(result).toBe(false);
  expect(cb.mock.calls.length).toBe(firesAfterFirst);
  off();
});

it('addVideoRule enrich with new non-empty field still writes', async () => {
  const s = mem();
  const payload = { aid: '1', bvid: 'BVA', title: 'T', upMid: '946974', upName: '老番茄' };
  const cb = vi.fn();
  const off = onStateChange(s, cb);
  await addVideoRule(s, payload);
  const firesAfterFirst = cb.mock.calls.length;
  const result = await addVideoRule(s, { ...payload, title: 'T2' });
  expect(result).toBe(false);
  expect(cb.mock.calls.length).toBe(firesAfterFirst + 1);
  expect((await loadState(s)).videos['1'].title).toBe('T2');
  off();
});

it('addUperRule dedupes by mid and keeps name', async () => {
  const s = mem();
  await addUperRule(s, { mid: '946974', name: '老番茄' });
  await addUperRule(s, { mid: '946974' });
  const state = await loadState(s);
  expect(Object.keys(state.upers)).toEqual(['946974']);
  expect(state.upers['946974'].name).toBe('老番茄');
});

it('removeVideoRule works by aid and by bvid', async () => {
  const s = mem();
  await addVideoRule(s, { aid: '1', bvid: 'BVA' });
  expect(await removeVideoRule(s, 'BVA')).toBe(true);
  expect(await removeVideoRule(s, 'BVA')).toBe(false);
});

it('removeUperRule deletes', async () => {
  const s = mem();
  await addUperRule(s, { mid: '946974' });
  expect(await removeUperRule(s, '946974')).toBe(true);
  expect((await loadState(s)).upers).toEqual({});
});

it('setPaused toggles; clearAll empties', async () => {
  const s = mem();
  await addVideoRule(s, { aid: '1' });
  await addUperRule(s, { mid: '2' });
  await setPaused(s, true);
  expect((await loadState(s)).paused).toBe(true);
  await clearAll(s);
  expect(await loadState(s)).toEqual(emptyState());
});

it('paused mode blocks new rule writes until resumed', async () => {
  const s = mem();
  await setPaused(s, true);
  expect(await addVideoRule(s, { aid: '1' })).toBe(false);
  expect(await addUperRule(s, { mid: '2' })).toBe(false);
  const st = await loadState(s);
  expect(st.paused).toBe(true);
  expect(st.videos).toEqual({});
  expect(st.upers).toEqual({});
  await setPaused(s, false);
  expect(await addVideoRule(s, { aid: '1' })).toBe(true);
  expect(await addUperRule(s, { mid: '2' })).toBe(true);
});

it('concurrent addVideoRule and addUperRule are serialized (no lost write)', async () => {
  const s = mem();
  await Promise.all([
    addVideoRule(s, { aid: '1' }),
    addUperRule(s, { mid: '2' }),
  ]);
  const st = await loadState(s);
  expect(st.videos['1'].aid).toBe('1');
  expect(st.upers['2'].mid).toBe('2');
});

it('loadState falls back to empty state on corrupt data', async () => {
  const s = mem();
  await s.set('bcf-state', { videos: 'not-an-object' });
  expect(await loadState(s)).toEqual(emptyState());
});

it('blockAds defaults to false and persists via setBlockAds', async () => {
  const s = createMemoryStorage();
  expect((await loadState(s)).blockAds).toBe(false);
  await setBlockAds(s, true);
  expect((await loadState(s)).blockAds).toBe(true);
  await setBlockAds(s, false);
  expect((await loadState(s)).blockAds).toBe(false);
});

it('loadState normalizes corrupt blockAds to false', async () => {
  const s = createMemoryStorage();
  await s.set('bcf-state', { videos: {}, upers: {}, blockAds: 'yes' });
  expect((await loadState(s)).blockAds).toBe(false);
});

it('onStateChange fires on writes', async () => {
  const s = mem();
  const cb = vi.fn();
  const off = onStateChange(s, cb);
  await addVideoRule(s, { aid: '1' });
  expect(cb).toHaveBeenCalled();
  off();
});

describe('blockedCategories', () => {
  it('sanitizes corrupt storage: keeps only known category keys', async () => {
    const s = createMemoryStorage();
    await s.set('bcf-state', {
      videos: {},
      upers: {},
      blockedCategories: { '垃圾': true, '番剧': true },
    });
    expect((await loadState(s)).blockedCategories).toEqual({ '番剧': true });
  });

  it('defaults to empty and round-trips per-category toggles', async () => {
    const s = createMemoryStorage();
    expect((await loadState(s)).blockedCategories).toEqual({});
    await setBlockedCategory(s, '番剧', true);
    await setBlockedCategory(s, '电影', true);
    await setBlockedCategory(s, '番剧', false);
    const state = await loadState(s);
    expect(state.blockedCategories['番剧']).toBe(false);
    expect(state.blockedCategories['电影']).toBe(true);
  });
});

describe('blockCourses/blockPromos', () => {
  it('defaults to false and round-trips both flags', async () => {
    const s = createMemoryStorage();
    const empty = await loadState(s);
    expect(empty.blockCourses).toBe(false);
    expect(empty.blockPromos).toBe(false);
    await setBlockCourses(s, true);
    await setBlockPromos(s, true);
    const state = await loadState(s);
    expect(state.blockCourses).toBe(true);
    expect(state.blockPromos).toBe(true);
    await setBlockCourses(s, false);
    expect((await loadState(s)).blockCourses).toBe(false);
  });
});
