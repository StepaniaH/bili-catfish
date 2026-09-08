// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { applyOverlay, removeOverlay, isOverlayed } from '../src/content/overlay';

function card(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'bili-video-card';
  el.innerHTML = '<a href="//www.bilibili.com/video/BV1GJ411x7h7/">标题</a>';
  document.body.appendChild(el);
  return el;
}

describe('applyOverlay', () => {
  it('adds mask with video label and unblock button', () => {
    const el = card();
    const onUnblockVideo = vi.fn();
    applyOverlay(el, { videoHit: true, uperHit: false, adHit: false, promoHit: false, categoryHit: false, onUnblockVideo, onUnblockUper: vi.fn() });
    expect(isOverlayed(el)).toBe(true);
    const mask = el.querySelector('.bcf-mask')!;
    expect(mask.textContent).toContain('已屏蔽该视频');
    expect(mask.textContent).not.toContain('已屏蔽该 UP 主');
    expect(mask.textContent).not.toContain('已屏蔽该视频 ·');
  });

  it('shows combined label and both buttons when both rules hit', () => {
    const el = card();
    applyOverlay(el, { videoHit: true, uperHit: true, adHit: false, promoHit: false, categoryHit: false, onUnblockVideo: vi.fn(), onUnblockUper: vi.fn() });
    expect(el.querySelector('.bcf-mask')!.textContent).toContain('已屏蔽该视频 · 已屏蔽该 UP 主');
    const btns = Array.from(el.querySelectorAll('.bcf-bar button')).map((b) => b.textContent);
    expect(btns).toEqual(['不再屏蔽该视频', '不再屏蔽该 UP 主']);
  });

  it('shows only uper label when only uper rule hit', () => {
    const el = card();
    applyOverlay(el, { videoHit: false, uperHit: true, adHit: false, promoHit: false, categoryHit: false, onUnblockVideo: vi.fn(), onUnblockUper: vi.fn() });
    expect(el.querySelector('.bcf-mask')!.textContent).toContain('已屏蔽该 UP 主');
    expect(el.querySelectorAll('.bcf-bar button')).toHaveLength(1);
    expect(el.querySelector('.bcf-bar button')!.textContent).toBe('不再屏蔽该 UP 主');
  });

  it('unblock button click invokes callback', () => {
    const el = card();
    const onUnblockVideo = vi.fn();
    applyOverlay(el, { videoHit: true, uperHit: false, adHit: false, promoHit: false, categoryHit: false, onUnblockVideo, onUnblockUper: vi.fn() });
    (el.querySelector('.bcf-bar button') as HTMLButtonElement).click();
    expect(onUnblockVideo).toHaveBeenCalled();
  });

  it('is idempotent: re-apply does not duplicate mask', () => {
    const el = card();
    applyOverlay(el, { videoHit: true, uperHit: false, adHit: false, promoHit: false, categoryHit: false, onUnblockVideo: vi.fn(), onUnblockUper: vi.fn() });
    applyOverlay(el, { videoHit: true, uperHit: false, adHit: false, promoHit: false, categoryHit: false, onUnblockVideo: vi.fn(), onUnblockUper: vi.fn() });
    expect(el.querySelectorAll('.bcf-mask')).toHaveLength(1);
  });

  it('shows ad label without buttons when only ad hit', () => {
    const el = card();
    applyOverlay(el, { videoHit: false, uperHit: false, adHit: true, promoHit: false, categoryHit: false, onUnblockVideo: vi.fn(), onUnblockUper: vi.fn() });
    expect(el.querySelector('.bcf-mask')!.textContent).toBe('已屏蔽广告');
    expect(el.querySelectorAll('.bcf-bar button')).toHaveLength(0);
  });

  it('combines ad label with rule labels', () => {
    const el = card();
    applyOverlay(el, { videoHit: true, uperHit: true, adHit: true, promoHit: false, categoryHit: false, onUnblockVideo: vi.fn(), onUnblockUper: vi.fn() });
    expect(el.querySelector('.bcf-mask')!.textContent).toBe('已屏蔽该视频 · 已屏蔽该 UP 主 · 已屏蔽广告');
    expect(el.querySelectorAll('.bcf-bar button')).toHaveLength(2);
  });
  it('labels promo and course hits', () => {
    const el = document.createElement('div');
    applyOverlay(el, {
      videoHit: false, uperHit: false, adHit: false, promoHit: true,
      categoryHit: false,
      onUnblockVideo: () => {}, onUnblockUper: () => {},
    });
    expect(el.querySelector('.bcf-mask')!.textContent).toBe('已屏蔽推广');

    const el2 = document.createElement('div');
    applyOverlay(el2, {
      videoHit: false, uperHit: false, adHit: true, promoHit: false,
      categoryHit: true, categoryName: '课堂',
      onUnblockVideo: () => {}, onUnblockUper: () => {},
    });
    expect(el2.querySelector('.bcf-mask')!.textContent).toBe('已屏蔽广告 · 已屏蔽课堂');
    expect(el2.querySelectorAll('.bcf-bar button')).toHaveLength(0);
  });

  it('labels category hits', () => {
    const el = document.createElement('div');
    applyOverlay(el, {
      videoHit: false, uperHit: false, adHit: false, promoHit: false,
      categoryHit: true, categoryName: '番剧',
      onUnblockVideo: () => {}, onUnblockUper: () => {},
    });
    expect(el.querySelector('.bcf-mask')!.textContent).toBe('已屏蔽番剧');
    expect(el.querySelectorAll('.bcf-bar button')).toHaveLength(0);
  });
});

describe('removeOverlay', () => {
  it('removes mask and bar', () => {
    const el = card();
    applyOverlay(el, { videoHit: true, uperHit: false, adHit: false, promoHit: false, categoryHit: false, onUnblockVideo: vi.fn(), onUnblockUper: vi.fn() });
    removeOverlay(el);
    expect(isOverlayed(el)).toBe(false);
    expect(el.querySelector('.bcf-mask')).toBeNull();
    expect(el.querySelector('.bcf-bar')).toBeNull();
  });

  it('is safe when not overlayed', () => {
    const el = card();
    expect(() => removeOverlay(el)).not.toThrow();
  });
});
