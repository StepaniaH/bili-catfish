import { describe, it, expect } from 'vitest';
import { extractDislike } from '../src/core/endpoints';

describe('extractDislike', () => {
  it('ignores unrelated requests', () => {
    expect(extractDislike('https://api.bilibili.com/x/web-interface/ranking/v2', null)).toBeNull();
    expect(extractDislike('https://api.bilibili.com/x/player/wbi/v2?aid=1', null)).toBeNull();
  });

  it('extracts video dislike from query params', () => {
    expect(
      extractDislike('https://api.bilibili.com/x/feed/dislike?aid=170001&mid=946974', null),
    ).toEqual({ kind: 'video', aid: '170001', bvid: undefined, mid: '946974' });
  });

  it('extracts video dislike from form body', () => {
    expect(
      extractDislike('https://api.bilibili.com/x/web-interface/show/dislike', 'aid=170001&bvid=BV1GJ411x7h7'),
    ).toEqual({ kind: 'video', aid: '170001', bvid: 'BV1GJ411x7h7', mid: undefined });
  });

  it('extracts uper dislike via goto=up', () => {
    expect(
      extractDislike('https://api.bilibili.com/x/feed/dislike', 'goto=up&id=946974'),
    ).toEqual({ kind: 'upper', mid: '946974' });
  });

  it('treats mid-only request as uper', () => {
    expect(
      extractDislike('https://api.bilibili.com/x/feed/dislike?mid=946974', null),
    ).toEqual({ kind: 'upper', mid: '946974' });
  });

  it('returns null when dislike endpoint has no usable ids', () => {
    expect(extractDislike('https://api.bilibili.com/x/feed/dislike?feedback=1', null)).toBeNull();
  });
});
