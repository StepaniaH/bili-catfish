import { extractDislike } from '../core/endpoints';
import { isAdCard } from './ad-detect';
import { matchCard, type CardIdentity } from '../core/match';
import type { BlockState } from '../shared/types';
import { addUperRule, addVideoRule, createChromeStorage, loadState, onStateChange, removeUperRule, removeVideoRule } from '../shared/store';
import { installCaptureForwarding } from './capture-forward';
import { createLookup, cacheKey, type LookupInfo, type CachedLookup } from './lookup';
import { pageKind, scanCards, extractSpaceMid, type CardRef } from './scan';
import { applyOverlay, isOverlayed, removeOverlay } from './overlay';
import { renderSpaceBanner, removeSpaceBanner } from './space-banner';

export interface ReconcileDeps {
  getState: () => Promise<BlockState>;
  lookupInfo: (keys: Array<{ bvid?: string | null; aid?: string | null }>) => Promise<Map<string, LookupInfo | null>>;
  applyOverlay: typeof applyOverlay;
  removeOverlay: typeof removeOverlay;
}

export interface ReconcileStats {
  scanned: number;
  masked: number;
}

export async function reconcileCards(cards: CardRef[], deps: ReconcileDeps): Promise<ReconcileStats> {
  const state = await deps.getState();
  const stats: ReconcileStats = { scanned: cards.length, masked: 0 };
  if (state.paused) {
    for (const c of cards) deps.removeOverlay(c.el);
    return stats;
  }
  const masked = new Set<Element>();
  const adHitOf = (el: Element): boolean => state.blockAds && isAdCard(el);

  // 阶段 1：无网络 —— 视频规则（DOM id 直接匹配）+ 广告
  for (const c of cards) {
    const hit = matchCard(state, { aid: c.aid, bvid: c.bvid, mid: null });
    const adHit = adHitOf(c.el);
    if (hit.video || adHit) {
      deps.applyOverlay(c.el, {
        videoHit: hit.video !== null,
        uperHit: false,
        adHit,
        onUnblockVideo: () => void unblockVideo(null, { aid: c.aid, bvid: c.bvid, mid: null }),
        onUnblockUper: () => {},
      });
      masked.add(c.el);
    }
  }

  // 阶段 2：仅当存在 UP 主规则时才查询
  if (Object.keys(state.upers).length > 0) {
    const infos = await deps.lookupInfo(cards.map((c) => ({ bvid: c.bvid, aid: c.aid })));
    for (const c of cards) {
      const info = infos.get(cacheKey({ bvid: c.bvid, aid: c.aid }));
      const identity: CardIdentity = {
        aid: info?.aid ?? c.aid,
        bvid: info?.bvid ?? c.bvid,
        mid: info?.mid ?? null,
      };
      const hit = matchCard(state, identity);
      const adHit = adHitOf(c.el);
      if (hit.video || hit.uper || adHit) {
        deps.applyOverlay(c.el, {
          videoHit: hit.video !== null,
          uperHit: hit.uper !== null,
          adHit,
          onUnblockVideo: () => void unblockVideo(info, identity),
          onUnblockUper: () => void unblockUper(identity, info),
        });
        masked.add(c.el);
      } else if (isOverlayed(c.el)) {
        deps.removeOverlay(c.el);
      }
    }
  } else {
    // 无 UP 主规则：清理已不再命中的旧遮挡
    for (const c of cards) {
      if (masked.has(c.el)) continue;
      if (isOverlayed(c.el)) deps.removeOverlay(c.el);
    }
  }
  stats.masked = masked.size;
  return stats;
}

/* ---------- 装配（生产入口） ---------- */

const storage = createChromeStorage();
const sessionRead =
  typeof chrome !== 'undefined' && chrome.storage?.session
    ? async (key: string): Promise<CachedLookup | undefined> => {
        const o = await chrome.storage.session.get(key);
        return o?.[key] as CachedLookup | undefined;
      }
    : undefined;
const lookup = createLookup((msg) => chrome.runtime.sendMessage(msg), sessionRead);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

function showToast(text: string): void {
  document.querySelector('.bcf-toast')?.remove();
  const t = document.createElement('div');
  t.className = 'bcf-toast';
  t.textContent = text;
  document.body.appendChild(t);
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2000);
}

async function unblockVideo(info: LookupInfo | null | undefined, identity: CardIdentity): Promise<void> {
  const id = identity.aid ?? info?.aid ?? identity.bvid;
  if (!id) return;
  const removed = await removeVideoRule(storage, id);
  if (removed) showToast('已取消屏蔽该视频');
}

async function unblockUper(identity: CardIdentity, info: LookupInfo | null | undefined): Promise<void> {
  const mid = identity.mid ?? info?.mid;
  if (!mid) return;
  const removed = await removeUperRule(storage, mid);
  if (removed) showToast('已取消屏蔽该 UP 主');
}

async function recordCapture(url: string, body: string | null): Promise<void> {
  const cap = extractDislike(url, body);
  if (!cap) return;
  if (cap.kind === 'video') {
    if (!cap.aid && !cap.bvid) return;
    const info = cap.aid ? (await lookup.lookup([{ aid: cap.aid }])).get(cacheKey({ aid: cap.aid })) : (await lookup.lookup([{ bvid: cap.bvid! }])).get(cacheKey({ bvid: cap.bvid! }));
    const aid = cap.aid ?? info?.aid ?? '';
    if (!aid) return;
    const added = await addVideoRule(storage, {
      aid,
      bvid: cap.bvid ?? info?.bvid,
      title: info?.title,
      upMid: cap.mid ?? info?.mid,
      upName: info?.upName,
    });
    if (added && cap.aid) showToast('已屏蔽该视频');
  } else {
    if (!cap.mid) return;
    const added = await addUperRule(storage, { mid: cap.mid });
    if (added) showToast('已屏蔽该 UP 主');
  }
}

/* DOM 兜底捕获：点「不感兴趣/不喜欢」菜单项时，就近找卡片拿 bvid */
export function matchMenuFallback(ownText: string, itemContainsVideoLink: boolean): 'video' | 'uper' | null {
  if (itemContainsVideoLink) return null;
  const isUper = /UP\s*主|up\s*主/i.test(ownText);
  const isVideo = /不感兴趣|不想看/.test(ownText);
  const isDislike = /不喜欢/.test(ownText);
  if (!isVideo && !isDislike) return null;
  if (ownText.length > 12) return null;
  return isUper ? 'uper' : 'video';
}

function installDomFallback(): void {
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const item = t.closest<HTMLElement>('li, .van-popover-item, [class*="menu-item"], [class*="popover-item"]');
      if (!item) return;
      const ownText = (t.textContent ?? '').trim();
      const kind = matchMenuFallback(ownText, item.querySelector('a[href*="/video/"]') !== null);
      if (!kind) return;
      const card = item.closest('.bili-video-card, .video-page-card, .video-list-item, li');
      const href = card?.querySelector<HTMLAnchorElement>('a[href*="/video/"]')?.href;
      if (!href) return;
      const bvid = /BV[0-9A-Za-z]{10}/.exec(href)?.[0];
      if (!bvid) return;
      void (async () => {
        const info = (await lookup.lookup([{ bvid }])).get(cacheKey({ bvid }));
        if (kind === 'uper') {
          const mid = info?.mid;
          if (!mid) return;
          if (await addUperRule(storage, { mid, name: info?.upName })) showToast('已屏蔽该 UP 主');
        } else {
          const aid = info?.aid;
          if (!aid) return;
          if (await addVideoRule(storage, { aid, bvid, title: info?.title, upMid: info?.mid, upName: info?.upName })) showToast('已屏蔽该视频');
        }
      })();
    },
    true,
  );
}

function installRescan(): void {
  let scanning = false;
  let pending = false;
  async function scan(): Promise<void> {
    if (scanning) {
      pending = true;
      return;
    }
    if (pageKind() === 'other') return;
    scanning = true;
    try {
      const cards = scanCards(document.body);
      await reconcileCards(cards, {
        getState: () => loadState(storage),
        lookupInfo: (keys) => lookup.lookup(keys),
        applyOverlay,
        removeOverlay,
      });
    } finally {
      scanning = false;
      if (pending) {
        pending = false;
        void scan();
      }
    }
  }
  const debounced = (() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    return () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => void scan(), 100);
    };
  })();
  const mo = new MutationObserver(debounced);
  mo.observe(document.body, { childList: true, subtree: true });
  onStateChange(storage, () => debounced());
  window.addEventListener('scroll', debounced, { passive: true });
  void scan();
}

function main(): void {
  const kind = pageKind();
  if (kind === 'other') return;
  if (kind === 'space') {
    installSpace();
    return;
  }
  installCaptureForwarding((url, body) => void recordCapture(url, body));
  installDomFallback();
  installRescan();
}

async function unblockUperByMid(mid: string): Promise<void> {
  const removed = await removeUperRule(storage, mid);
  if (removed) showToast('已取消屏蔽该 UP 主');
}

function installSpace(): void {
  const refreshBanner = async (): Promise<void> => {
    const mid = extractSpaceMid();
    const state = await loadState(storage);
    if (mid && state.upers[mid] && !state.paused) {
      const host = document.querySelector('#app .main-content, #app, body') ?? document.body;
      renderSpaceBanner(host as HTMLElement, () => void unblockUperByMid(mid));
    } else {
      removeSpaceBanner();
    }
  };
  onStateChange(storage, () => void refreshBanner());
  void refreshBanner();
}

export { main as startContentScript };

if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
  main();
}
