// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { matchMenuFallback, reconcileCards, type ReconcileDeps } from '../src/content/index';
import { emptyState } from '../src/shared/types';

function makeCard(bvid: string): HTMLElement {
  const el = document.createElement('div');
  el.className = 'bili-video-card';
  el.innerHTML = `<a href="//www.bilibili.com/video/${bvid}/">t</a>`;
  document.body.appendChild(el);
  return el;
}

function makeDeps(over: Partial<ReconcileDeps> = {}): ReconcileDeps {
  return {
    getState: async () => state,
    lookupInfo: vi.fn(async () => new Map()),
    applyOverlay: vi.fn(),
    removeOverlay: vi.fn(),
    ...over,
  };
}

let state = emptyState();

describe('matchMenuFallback', () => {
  it('matches short video-dislike labels', () => {
    expect(matchMenuFallback('不感兴趣该视频', false)).toBe('video');
  });

  it('matches uper dislike labels', () => {
    expect(matchMenuFallback('不喜欢该UP主', false)).toBe('uper');
  });

  it('matches bilibili menu labels with spaces (不想看此 UP 主 / 内容不感兴趣)', () => {
    expect(matchMenuFallback('不想看此 UP 主', false)).toBe('uper');
    expect(matchMenuFallback('不喜欢此 UP 主', false)).toBe('uper');
    expect(matchMenuFallback('内容不感兴趣', false)).toBe('video');
    expect(matchMenuFallback('不想看此视频', false)).toBe('video');
  });

  it('ignores long text such as card titles', () => {
    expect(matchMenuFallback('新人UP主教你做饭，不感兴趣速来看', false)).toBeNull();
  });

  it('ignores items that contain a video link (card ancestors)', () => {
    expect(matchMenuFallback('不感兴趣', true)).toBeNull();
    expect(matchMenuFallback('不喜欢该UP主', true)).toBeNull();
  });

  it('matches promo menu labels (屏蔽推广面板)', () => {
    expect(matchMenuFallback('不想看该视频', false)).toBe('video');
    expect(matchMenuFallback('up 主不感兴趣', false)).toBe('uper');
    expect(matchMenuFallback('相似内容过多', false)).toBeNull();
    expect(matchMenuFallback('分区不感兴趣', false)).toBeNull();
  });

  it('ignores non-menu text', () => {
    expect(matchMenuFallback('点赞 1.2万', false)).toBeNull();
    expect(matchMenuFallback('', false)).toBeNull();
  });
});

describe('reconcileCards', () => {
  it('applies overlay when uper rule matches card', async () => {
    state = emptyState();
    state.upers['2'] = { mid: '2', blockedAt: 1 };
    const el = makeCard('BVA');
    const deps = makeDeps({
      lookupInfo: async () => new Map([['bvid:BVA', { aid: '1', bvid: 'BVA', mid: '2', upName: 'UP' }]]),
    });
    const n = await reconcileCards([{ el, bvid: 'BVA', aid: null }], deps);
    expect(n.masked).toBe(1);
    expect(deps.applyOverlay).toHaveBeenCalledWith(el, expect.objectContaining({ uperHit: true, videoHit: false, adHit: false }));
  });

  it('removes overlay when rule gone', async () => {
    state = emptyState();
    const el = makeCard('BVA');
    el.classList.add('bcf-card');
    el.appendChild(Object.assign(document.createElement('div'), { className: 'bcf-mask' }));
    const deps = makeDeps();
    const n = await reconcileCards([{ el, bvid: 'BVA', aid: null }], deps);
    expect(n.masked).toBe(0);
    expect(deps.removeOverlay).toHaveBeenCalledWith(el);
  });

  it('re-applies overlay to an already-masked matching card and counts it as masked', async () => {
    state = emptyState();
    state.upers['2'] = { mid: '2', blockedAt: 1 };
    const el = makeCard('BVA');
    el.classList.add('bcf-card');
    el.appendChild(Object.assign(document.createElement('div'), { className: 'bcf-mask' }));
    const deps = makeDeps({
      lookupInfo: async () => new Map([['bvid:BVA', { aid: '1', bvid: 'BVA', mid: '2', upName: 'UP' }]]),
    });
    const n = await reconcileCards([{ el, bvid: 'BVA', aid: null }], deps);
    expect(n.masked).toBe(1);
    expect(deps.applyOverlay).toHaveBeenCalledWith(el, expect.objectContaining({ uperHit: true, videoHit: false, adHit: false }));
    expect(deps.removeOverlay).not.toHaveBeenCalled();
  });

  it('refreshes overlay when hit state changes on rescan (video-only mask gains uper block)', async () => {
    state = emptyState();
    state.videos['1'] = { aid: '1', bvid: 'BVA', blockedAt: 1 };
    state.upers['2'] = { mid: '2', blockedAt: 2 };
    const el = makeCard('BVA');
    el.classList.add('bcf-card');
    el.appendChild(Object.assign(document.createElement('div'), { className: 'bcf-mask' }));
    const deps = makeDeps({
      lookupInfo: async () => new Map([['bvid:BVA', { aid: '1', bvid: 'BVA', mid: '2', upName: 'UP' }]]),
    });
    const n = await reconcileCards([{ el, bvid: 'BVA', aid: null }], deps);
    expect(n.masked).toBe(1);
    expect(deps.applyOverlay).toHaveBeenCalledWith(el, expect.objectContaining({ uperHit: true, videoHit: true, adHit: false }));
  });

  it('paused state removes all overlays and blocks new ones', async () => {
    state = emptyState();
    state.paused = true;
    state.upers['2'] = { mid: '2', blockedAt: 1 };
    const el = makeCard('BVA');
    const deps = makeDeps({
      lookupInfo: async () => new Map([['bvid:BVA', { aid: '1', bvid: 'BVA', mid: '2' }]]),
    });
    await reconcileCards([{ el, bvid: 'BVA', aid: null }], deps);
    expect(deps.applyOverlay).not.toHaveBeenCalled();
    expect(deps.removeOverlay).toHaveBeenCalledWith(el);
  });

  it('does not overlay cards with unknown identity (lookup null)', async () => {
    state = emptyState();
    state.upers['2'] = { mid: '2', blockedAt: 1 };
    const el = makeCard('BVUNKNOWN');
    const deps = makeDeps();
    await reconcileCards([{ el, bvid: 'BVUNKNOWN', aid: null }], deps);
    expect(deps.applyOverlay).not.toHaveBeenCalled();
  });

  it('masks video-rule hits without any lookup (phase 1, no network)', async () => {
    state = emptyState();
    state.videos['1'] = { aid: '1', bvid: 'BVA', blockedAt: 1 };
    const el = makeCard('BVA');
    const deps = makeDeps();
    const n = await reconcileCards([{ el, bvid: 'BVA', aid: null }], deps);
    expect(deps.lookupInfo).not.toHaveBeenCalled(); // 无 UP 主规则 → 不查
    expect(deps.applyOverlay).toHaveBeenCalledWith(el, expect.objectContaining({ videoHit: true, uperHit: false, adHit: false }));
    expect(n.masked).toBe(1);
  });

  it('sends only id-bearing cards to lookup but still overlays identity-less ad cards', async () => {
    state = emptyState();
    state.blockAds = true;
    state.upers['2'] = { mid: '2', blockedAt: 1 };
    const adEl = document.createElement('div');
    adEl.className = 'bili-video-card';
    adEl.innerHTML = '<a href="//cm.bilibili.com/landing">落地页</a><span>广告</span>';
    document.body.appendChild(adEl);
    const idEl = makeCard('BVA');
    const deps = makeDeps({ lookupInfo: vi.fn(async () => new Map()) });
    const n = await reconcileCards([{ el: adEl, bvid: null, aid: null }, { el: idEl, bvid: 'BVA', aid: null }], deps);
    expect(deps.lookupInfo).toHaveBeenCalledWith([{ bvid: 'BVA', aid: null }]);
    expect(deps.applyOverlay).toHaveBeenCalledWith(adEl, expect.objectContaining({ adHit: true, videoHit: false, uperHit: false }));
    expect(vi.mocked(deps.applyOverlay).mock.calls.filter((c) => c[0] === adEl).length).toBeGreaterThanOrEqual(2); // phase 1 + phase 2 maintenance
    expect(n.masked).toBe(1);
  });

  it('masks ad cards immediately when blockAds on (no lookup)', async () => {
    state = emptyState();
    state.blockAds = true;
    const el = makeCard('BVA');
    el.insertAdjacentHTML('beforeend', '<span>广告</span>');
    const deps = makeDeps();
    const n = await reconcileCards([{ el, bvid: 'BVA', aid: null }], deps);
    expect(deps.lookupInfo).not.toHaveBeenCalled();
    expect(deps.applyOverlay).toHaveBeenCalledWith(el, expect.objectContaining({ adHit: true, videoHit: false, uperHit: false }));
    expect(n.masked).toBe(1);
  });

  it('does not mask ads when blockAds off', async () => {
    state = emptyState();
    const el = makeCard('BVA');
    el.insertAdjacentHTML('beforeend', '<span>广告</span>');
    const deps = makeDeps();
    await reconcileCards([{ el, bvid: 'BVA', aid: null }], deps);
    expect(deps.applyOverlay).not.toHaveBeenCalled();
  });

  it('paused removes overlays even for ads', async () => {
    state = emptyState();
    state.paused = true;
    state.blockAds = true;
    const el = makeCard('BVA');
    el.insertAdjacentHTML('beforeend', '<span>广告</span>');
    const deps = makeDeps();
    await reconcileCards([{ el, bvid: 'BVA', aid: null }], deps);
    expect(deps.removeOverlay).toHaveBeenCalledWith(el);
    expect(deps.applyOverlay).not.toHaveBeenCalled();
  });

  it('masks promo card only when blockPromos is on', async () => {
    const el = document.createElement('div');
    el.innerHTML = '<i class="vui_icon bili-video-card__stats--icon"></i>';
    state = emptyState();
    state.blockPromos = true;
    const onDeps = makeDeps();
    await reconcileCards([{ el, bvid: 'BVA', aid: null }], onDeps);
    expect(onDeps.applyOverlay).toHaveBeenCalled();

    state = emptyState();
    el.classList.add('bcf-card');
    el.appendChild(Object.assign(document.createElement('div'), { className: 'bcf-mask' }));
    const offDeps = makeDeps();
    await reconcileCards([{ el, bvid: 'BVA', aid: null }], offDeps);
    expect(offDeps.removeOverlay).toHaveBeenCalled();
  });

  it('masks identity-less 课堂 card via categoryHit without lookup', async () => {
    const el = document.createElement('div');
    el.innerHTML = '<a href="//www.bilibili.com/cheese/play/ss1">付费课程</a>';
    state = emptyState();
    state.blockedCategories['课堂'] = true;
    const deps = makeDeps();
    await reconcileCards([{ el, bvid: null, aid: null }], deps);
    expect(deps.applyOverlay).toHaveBeenCalled();
    expect(deps.lookupInfo).not.toHaveBeenCalled();
    expect(vi.mocked(deps.applyOverlay).mock.calls[0]![1].categoryHit).toBe(true);
    expect(vi.mocked(deps.applyOverlay).mock.calls[0]![1].categoryName).toBe('课堂');
  });

  it('masks floor category card via categoryHit without lookup', async () => {
    const el = document.createElement('div');
    el.innerHTML = '<span>番剧</span>';
    state = emptyState();
    state.blockedCategories['番剧'] = true;
    const deps = makeDeps();
    await reconcileCards([{ el, bvid: null, aid: null }], deps);
    expect(deps.applyOverlay).toHaveBeenCalled();
    expect(deps.lookupInfo).not.toHaveBeenCalled();
    expect(vi.mocked(deps.applyOverlay).mock.calls[0]![1].categoryHit).toBe(true);
    expect(vi.mocked(deps.applyOverlay).mock.calls[0]![1].categoryName).toBe('番剧');
  });

  it('does not mask category card when toggle off', async () => {
    const el = document.createElement('div');
    el.innerHTML = '<span>番剧</span>';
    state = emptyState();
    const deps = makeDeps();
    await reconcileCards([{ el, bvid: null, aid: null }], deps);
    expect(deps.applyOverlay).not.toHaveBeenCalled();
  });
});
