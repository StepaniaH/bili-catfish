// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { isAdCard, AD_BADGE_TEXTS, isCourseCard, isPromoCard, CATEGORY_BADGES, isCategoryCard } from '../src/content/ad-detect';
import { CATEGORY_KEYS } from '../src/shared/types';

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

describe('isCourseCard', () => {
  it('detects exact 课堂 badge', () => {
    const card = document.createElement('div');
    card.innerHTML = '<div class="bili-video-card__wrap"><span class="badge">课堂</span><h3>公考课</h3></div>';
    expect(isCourseCard(card)).toBe(true);
  });

  it('detects cheese link', () => {
    const card = document.createElement('div');
    card.innerHTML = '<a href="https://www.bilibili.com/cheese/play/ss210">课</a>';
    expect(isCourseCard(card)).toBe(true);
  });

  it('rejects 课堂 text inside a /video/ anchor', () => {
    const card = document.createElement('div');
    card.innerHTML = '<a href="/video/BV1abc"><span>课堂</span></a>';
    expect(isCourseCard(card)).toBe(false);
  });

  it('rejects partial badge text and plain cards', () => {
    const card = document.createElement('div');
    card.innerHTML = '<span>课堂精选</span>';
    expect(isCourseCard(card)).toBe(false);
    expect(isCourseCard(document.createElement('div'))).toBe(false);
  });
});

describe('isPromoCard', () => {
  it('detects rocket icon by class', () => {
    const card = document.createElement('div');
    card.innerHTML = '<div class="bili-video-card__stats"><i class="vui_icon bili-video-card__stats--icon"></i></div>';
    expect(isPromoCard(card)).toBe(true);
  });

  it('rejects cards without the icon', () => {
    const card = document.createElement('div');
    card.innerHTML = '<div class="bili-video-card__stats"><i class="vui_icon other-icon"></i></div>';
    expect(isPromoCard(card)).toBe(false);
  });
});

describe('isCategoryCard', () => {
  it('detects exact category badge', () => {
    const card = document.createElement('div');
    card.innerHTML = '<div class="badge"><span class="floor-title">番剧</span></div><h3>小猪佩奇</h3>';
    expect(isCategoryCard(card, ['番剧'])).toBe(true);
  });

  it('rejects up name containing the keyword', () => {
    const card = document.createElement('div');
    card.innerHTML = '<div class="badge"><span>国创</span></div><span>哔哩哔哩番剧</span><h3>正片</h3>';
    expect(isCategoryCard(card, ['番剧'])).toBe(false);
  });

  it('rejects badge inside a /video/ anchor', () => {
    const card = document.createElement('div');
    card.innerHTML = '<a href="/video/BV1abc"><span>番剧</span></a>';
    expect(isCategoryCard(card, ['番剧'])).toBe(false);
  });

  it('maps every CATEGORY_KEY to itself', () => {
    for (const key of CATEGORY_KEYS) {
      expect(CATEGORY_BADGES[key]).toEqual([key]);
    }
  });
});
