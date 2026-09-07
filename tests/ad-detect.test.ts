// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { isAdCard, AD_BADGE_TEXTS } from '../src/content/ad-detect';

function cardWith(html: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'bili-video-card';
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

describe('isAdCard', () => {
  it('detects exact 广告 badge', () => {
    expect(isAdCard(cardWith('<a href="//www.bilibili.com/video/BV1GJ411x7h7/">标题</a><span class="badge">广告</span>'))).toBe(true);
  });

  it('detects 推广 badge', () => {
    expect(isAdCard(cardWith('<span>推广</span>'))).toBe(true);
  });

  it('ignores plain cards', () => {
    expect(isAdCard(cardWith('<a href="//www.bilibili.com/video/BV1GJ411x7h7/">广告片拍摄教程</a>'))).toBe(false);
  });

  it('ignores badge inside a /video/ title link', () => {
    expect(isAdCard(cardWith('<a href="//www.bilibili.com/video/BV1GJ411x7h7/"><span>广告</span></a>'))).toBe(false);
  });

  it('detects badge inside a non-video (ad landing) link', () => {
    expect(isAdCard(cardWith('<a href="//cm.bilibili.com/landing"><span>广告</span></a>'))).toBe(true);
  });

  it('detects badge deep-nested in plain divs', () => {
    expect(isAdCard(cardWith('<div><div><span>广告</span></div></div>'))).toBe(true);
  });

  it('requires exact badge text (no substring matches)', () => {
    expect(isAdCard(cardWith('<span>广告说明</span>'))).toBe(false);
  });

  it('exports AD_BADGE_TEXTS', () => {
    expect(AD_BADGE_TEXTS).toEqual(['广告', '推广']);
  });
});
