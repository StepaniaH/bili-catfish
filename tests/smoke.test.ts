import { describe, it, expect } from 'vitest';
import { emptyState } from '../src/shared/types';

describe('smoke', () => {
  it('creates empty state', () => {
    expect(emptyState()).toEqual({ videos: {}, upers: {}, paused: false, blockAds: false, blockCourses: false, blockPromos: false, blockedCategories: {} });
  });
});
