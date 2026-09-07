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

  it('ignores telemetry endpoints like /player/feedback/log', () => {
    expect(extractDislike('https://api.bilibili.com/x/player/feedback/log?aid=1', null)).toBeNull();
  });

  it('does not let upId shadow a valid aid (mid still carried)', () => {
    expect(
      extractDislike('https://api.bilibili.com/x/feed/dislike?aid=170001&upId=999', null),
    ).toEqual({ kind: 'video', aid: '170001', bvid: undefined, mid: '999' });
  });

  describe('real bilibili home-feed feedback payloads', () => {
    const FEEDBACK_URL = 'https://api.bilibili.com/x/web-interface/feedback/dislike?w_rid=abc&wts=1';
    const VIDEO_BODY =
      'app_id=100&platform=5&goto=av&id=117195749202028&mid=1340863293&feedback_page=1&reason_id=1&csrf=x';
    const UPER_BODY =
      'app_id=100&platform=5&goto=av&id=117195749202028&mid=1340863293&feedback_page=1&reason_id=4&csrf=x';

    it('parses real bilibili 内容不感兴趣 payload (reason_id=1) as video', () => {
      expect(extractDislike(FEEDBACK_URL, VIDEO_BODY)).toEqual({
        kind: 'video',
        aid: '117195749202028',
        bvid: undefined,
        mid: '1340863293',
      });
    });

    it('parses real bilibili 不想看此 up 主 payload (reason_id=4) as upper', () => {
      expect(extractDislike(FEEDBACK_URL, UPER_BODY)).toEqual({ kind: 'upper', mid: '1340863293' });
    });

    it('fails closed on unknown reason_id', () => {
      expect(extractDislike(FEEDBACK_URL, VIDEO_BODY.replace('reason_id=1', 'reason_id=9'))).toBeNull();
    });

    it('accepts the real feedback path through the URL gate', () => {
      expect(extractDislike(FEEDBACK_URL, VIDEO_BODY)).not.toBeNull();
    });
  });
});
