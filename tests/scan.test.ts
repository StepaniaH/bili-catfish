// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { scanCards, pageKind } from '../src/content/scan';

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
});

describe('pageKind', () => {
  it('classifies pages by location', () => {
    expect(pageKind('https://www.bilibili.com/')).toBe('home');
    expect(pageKind('https://search.bilibili.com/all?keyword=x')).toBe('search');
    expect(pageKind('https://www.bilibili.com/video/BV1GJ411x7h7/')).toBe('related');
    expect(pageKind('https://www.bilibili.com/v/popular/all')).toBe('other');
  });
});
