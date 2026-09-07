// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { reconcileCards, type ReconcileDeps } from '../src/content/index';
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
