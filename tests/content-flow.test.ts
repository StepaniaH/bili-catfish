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
    lookupInfo: async () => new Map(),
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
    expect(deps.applyOverlay).toHaveBeenCalledWith(el, expect.objectContaining({ uperHit: true, videoHit: false }));
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
    expect(deps.applyOverlay).toHaveBeenCalledWith(el, expect.objectContaining({ uperHit: true, videoHit: false }));
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
    expect(deps.applyOverlay).toHaveBeenCalledWith(el, expect.objectContaining({ uperHit: true, videoHit: true }));
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
});
