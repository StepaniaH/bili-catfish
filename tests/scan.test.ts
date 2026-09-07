// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { scanCards, pageKind, extractSpaceMid } from '../src/content/scan';

function doc(name: string): Document {
  return new DOMParser().parseFromString(
    readFileSync(`tests/fixtures/${name}`, 'utf8'),
    'text/html',
  );
}

describe('scanCards', () => {
  it('home feed: one ref per card container', () => {
    const refs = scanCards(doc('home.html'));
    expect(refs.map((r) => r.bvid)).toEqual(['BV1GJ411x7h7', 'BV1xx411c7mD']);
    expect(refs[0].el.className).toContain('bili-video-card');
  });

  it('search page: falls back to link itself when no known container', () => {
    const refs = scanCards(doc('search.html'));
    expect(refs.map((r) => r.bvid)).toEqual(['BV1GJ411x7h7', 'BV1zz411U7h6']);
  });

  it('related page: detects container', () => {
    const refs = scanCards(doc('related.html'));
    expect(refs).toHaveLength(1);
    expect(refs[0].el.className).toContain('video-page-card');
  });

  it('discovers ad card by badge when it has no video anchor (identity-less)', () => {
    const refs = scanCards(doc('home-ad-badge.html'));
    const ad = refs.find((r) => r.bvid === null && r.aid === null);
    expect(ad).toBeDefined();
    expect(ad!.el.className).toContain('bili-video-card');
    expect(ad!.el.querySelector('h3')!.textContent).toBe('豆包广告');
  });

  it('does not discover video-anchor card via badge pass (title link excluded)', () => {
    const refs = scanCards(doc('home-ad-badge.html'));
    expect(refs).toHaveLength(2);
    const normal = refs.find((r) => r.bvid === 'BV1GJ411x7h7');
    expect(normal).toBeDefined();
    expect(refs.filter((r) => r.el === normal!.el)).toHaveLength(1);
  });
});

describe('pageKind', () => {
  it('classifies pages by location', () => {
    expect(pageKind('https://www.bilibili.com/')).toBe('home');
    expect(pageKind('https://search.bilibili.com/all?keyword=x')).toBe('search');
    expect(pageKind('https://www.bilibili.com/video/BV1GJ411x7h7/')).toBe('related');
    expect(pageKind('https://www.bilibili.com/v/popular/all')).toBe('other');
  });

  it('classifies space pages', () => {
    expect(pageKind('https://space.bilibili.com/12345')).toBe('space');
    expect(pageKind('https://space.bilibili.com/12345/video')).toBe('space');
    expect(pageKind('https://space.bilibili.com/')).toBe('space');
  });

  it('extracts mid from space url', () => {
    expect(extractSpaceMid('https://space.bilibili.com/12345')).toBe('12345');
    expect(extractSpaceMid('https://space.bilibili.com/12345/video?kw=x')).toBe('12345');
    expect(extractSpaceMid('https://space.bilibili.com/')).toBeNull();
    expect(extractSpaceMid('https://www.bilibili.com/')).toBeNull();
  });
});
