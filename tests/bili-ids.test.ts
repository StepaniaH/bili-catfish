import { describe, it, expect } from 'vitest';
import { extractBvid, extractAid, normalizeAid, extractMid } from '../src/core/bili-ids';

describe('extractBvid', () => {
  it('parses from path', () => {
    expect(extractBvid('//www.bilibili.com/video/BV1GJ411x7h7/?p=1')).toBe('BV1GJ411x7h7');
  });
  it('parses from query', () => {
    expect(extractBvid('//www.bilibili.com/video/av123?bvid=BV1xx411c7mD')).toBe('BV1xx411c7mD');
  });
  it('returns null for non-video links', () => {
    expect(extractBvid('//www.bilibili.com/v/popular/all')).toBeNull();
    expect(extractBvid(null)).toBeNull();
    expect(extractBvid('javascript:void(0)')).toBeNull();
  });
});

describe('extractAid', () => {
  it('parses av number from query', () => {
    expect(extractAid('//www.bilibili.com/video/BV1x?aid=170001')).toBe('170001');
  });
  it('normalizes av-prefixed value', () => {
    expect(extractAid('//www.bilibili.com/video/av170001')).toBe('170001');
  });
  it('returns null otherwise', () => {
    expect(extractAid('//www.bilibili.com/video/BV1GJ411x7h7')).toBeNull();
    expect(extractAid('https://example.com/?aid=abc')).toBeNull();
  });
});

describe('normalizeAid / extractMid', () => {
  it('keeps digit strings, strips leading zeros, rejects junk', () => {
    expect(normalizeAid('007')).toBe('7');
    expect(normalizeAid('170001')).toBe('170001');
    expect(normalizeAid('av1')).toBeNull();
    expect(normalizeAid(null)).toBeNull();
    expect(extractMid(' 12345 ')).toBe('12345');
    expect(extractMid('abc')).toBeNull();
  });
});
