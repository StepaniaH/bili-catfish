import { describe, it, expect, vi } from 'vitest';
import {
  createMemoryStorage, loadState, addVideoRule, addUperRule,
  removeVideoRule, removeUperRule, setPaused, clearAll, onStateChange,
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

it('loadState falls back to empty state on corrupt data', async () => {
  const s = mem();
  await s.set('bcf-state', { videos: 'not-an-object' });
  expect(await loadState(s)).toEqual(emptyState());
});

it('onStateChange fires on writes', async () => {
  const s = mem();
  const cb = vi.fn();
  const off = onStateChange(s, cb);
  await addVideoRule(s, { aid: '1' });
  expect(cb).toHaveBeenCalled();
  off();
});
