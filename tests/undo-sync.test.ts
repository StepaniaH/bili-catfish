// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { installUndoSync, undoPlan } from '../src/content/index';
import type { BlockState } from '../src/shared/types';

const state: BlockState = {
  videos: { '100': { aid: '100', bvid: 'BV1abc0000000', blockedAt: 1 } },
  upers: { '42': { mid: '42', blockedAt: 1 } },
  paused: false, blockAds: false, blockCourses: false, blockPromos: false, blockedCategories: {},
};

function makeCard(masked: boolean): HTMLElement {
  const el = document.createElement('div');
  el.className = 'bili-video-card';
  if (masked) { el.classList.add('bcf-card'); el.appendChild(Object.assign(document.createElement('div'), { className: 'bcf-mask' })); }
  el.innerHTML += '<a href="/video/av100">t</a><span class="undo">撤销</span>';
  document.body.appendChild(el);
  return el;
}

function baseDeps(over: Partial<Parameters<typeof installUndoSync>[0]> = {}): Parameters<typeof installUndoSync>[0] {
  return {
    getState: async () => state,
    lookupInfo: async () => new Map(),
    removeVideoRule: vi.fn(async () => true),
    removeUperRule: vi.fn(async () => true),
    removeOverlay: vi.fn(),
    showToast: vi.fn(),
    ...over,
  };
}

describe('undoPlan', () => {
  it('reports which rules hit', () => {
    expect(undoPlan(state, { aid: '100', bvid: null, mid: null })).toEqual({ video: true, uper: false });
    expect(undoPlan(state, { aid: null, bvid: null, mid: '42' })).toEqual({ video: false, uper: true });
    expect(undoPlan(state, { aid: null, bvid: null, mid: null })).toEqual({ video: false, uper: false });
  });
});

describe('installUndoSync', () => {
  it('removes rules, overlay and toasts on 撤销 click in masked card', async () => {
    const card = makeCard(true);
    const deps = baseDeps();
    installUndoSync(deps);
    (card.querySelector('.undo') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(deps.removeVideoRule).toHaveBeenCalledWith('100');
    expect(deps.removeOverlay).toHaveBeenCalledWith(card);
    expect(deps.showToast).toHaveBeenCalledWith('已取消屏蔽该视频');
  });

  it('does nothing in unmasked card', async () => {
    const card = makeCard(false);
    const deps = baseDeps();
    installUndoSync(deps);
    (card.querySelector('.undo') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(deps.removeVideoRule).not.toHaveBeenCalled();
    expect(deps.removeOverlay).not.toHaveBeenCalled();
    expect(deps.showToast).not.toHaveBeenCalled();
  });

  it('removes uper rule when identity resolves via lookup', async () => {
    const card = makeCard(true);
    const deps = baseDeps({
      lookupInfo: async () => new Map([['aid:100', { aid: '100', bvid: 'BV1abc0000000', mid: '42', title: '', upName: '' }]]),
    });
    installUndoSync(deps);
    (card.querySelector('.undo') as HTMLElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(deps.removeUperRule).toHaveBeenCalledWith('42');
    expect(deps.showToast).toHaveBeenCalledWith('已取消屏蔽该视频 · 已取消屏蔽该 UP 主');
  });
});
