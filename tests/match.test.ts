import { describe, it, expect } from 'vitest';
import { matchCard, type CardIdentity } from '../src/core/match';
import { emptyState, type BlockState } from '../src/shared/types';

const state: BlockState = emptyState();
state.videos['170001'] = { aid: '170001', bvid: 'BV1GJ411x7h7', blockedAt: 1 };
state.upers['946974'] = { mid: '946974', name: '老番茄', blockedAt: 1 };

it('matches video by aid', () => {
  const r = matchCard(state, { aid: '170001' } as CardIdentity);
  expect(r.video?.aid).toBe('170001');
  expect(r.uper).toBeNull();
});

it('matches video by bvid when aid unknown', () => {
  const r = matchCard(state, { bvid: 'BV1GJ411x7h7' } as CardIdentity);
  expect(r.video?.aid).toBe('170001');
});

it('matches uper by mid', () => {
  const r = matchCard(state, { mid: '946974' } as CardIdentity);
  expect(r.uper?.mid).toBe('946974');
  expect(r.video).toBeNull();
});

it('returns combined when both hit', () => {
  const r = matchCard(state, { aid: '170001', mid: '946974' } as CardIdentity);
  expect(r.video).not.toBeNull();
  expect(r.uper).not.toBeNull();
});

it('returns nothing for unrelated card', () => {
  const r = matchCard(state, { bvid: 'BV1xx411c7mD', mid: '1' } as CardIdentity);
  expect(r.video).toBeNull();
  expect(r.uper).toBeNull();
});
