import { extractAid } from '../core/bili-ids';
import { extractDislike } from '../core/endpoints';
import { isAdCard, isCategoryCard, isCourseCard, isPromoCard } from './ad-detect';
import { matchCard, type CardIdentity } from '../core/match';
import type { BlockState } from '../shared/types';
import { addUperRule, addVideoRule, createChromeStorage, loadState, onStateChange, removeUperRule, removeVideoRule } from '../shared/store';
import { installCaptureForwarding } from './capture-forward';
import { createLookup, cacheKey, type LookupInfo, type CachedLookup } from './lookup';
import { pageKind, scanCards, extractSpaceMid, type CardRef } from './scan';
import { applyOverlay, isOverlayed, removeOverlay } from './overlay';
import { renderSpaceBanner, removeSpaceBanner, shouldRenderBanner, BANNER_ID } from './space-banner';

export interface ReconcileDeps {
  getState: () => Promise<BlockState>;
  lookupInfo: (keys: Array<{ bvid?: string | null; aid?: string | null }>) => Promise<Map<string, LookupInfo | null>>;
  applyOverlay: typeof applyOverlay;
  removeOverlay: typeof removeOverlay;
  backfillUperName: (mid: string, name: string) => Promise<void>;
}

export interface ReconcileStats {
  scanned: number;
  masked: number;
}

export async function reconcileCards(
  cards: CardRef[],
  deps: ReconcileDeps,
  context: { suppressWhen?: (state: BlockState) => boolean } = {},
): Promise<ReconcileStats> {
  const state = await deps.getState();
  const stats: ReconcileStats = { scanned: cards.length, masked: 0 };
  if (state.paused || context.suppressWhen?.(state) === true) {
    for (const c of cards) deps.removeOverlay(c.el);
    return stats;
  }
  const masked = new Set<Element>();
  const adHitOf = (el: Element): boolean => state.blockAds && isAdCard(el);
  const promoHitOf = (el: Element): boolean => state.blockPromos && isPromoCard(el);
  const categoryHitOf = (el: Element): { hit: boolean; name?: string } => {
    for (const [key, on] of Object.entries(state.blockedCategories)) {
      if (!on) continue;
      const hit = key === '课堂' ? isCourseCard(el) : isCategoryCard(el, [key]);
      if (hit) return { hit: true, name: key };
    }
    return { hit: false };
  };

  // 阶段 1：无网络 —— 视频规则（DOM id 直接匹配）+ 广告
  for (const c of cards) {
    const hit = matchCard(state, { aid: c.aid, bvid: c.bvid, mid: null });
    const adHit = adHitOf(c.el);
    const promoHit = promoHitOf(c.el);
    const category = categoryHitOf(c.el);
    if (hit.video || adHit || promoHit || category.hit) {
      deps.applyOverlay(c.el, {
        videoHit: hit.video !== null,
        uperHit: false,
        adHit,
        promoHit,
        categoryHit: category.hit,
        categoryName: category.name,
        onUnblockVideo: () => void unblockVideo(null, { aid: c.aid, bvid: c.bvid, mid: null }),
        onUnblockUper: () => {},
      });
      masked.add(c.el);
    }
  }

  // 阶段 2：仅当存在 UP 主规则时才查询
  if (Object.keys(state.upers).length > 0) {
    const infos = await deps.lookupInfo(cards.filter((c) => c.bvid || c.aid).map((c) => ({ bvid: c.bvid, aid: c.aid })));
    for (const c of cards) {
      const info = infos.get(cacheKey({ bvid: c.bvid, aid: c.aid }));
      if (info?.mid && info.upName && state.upers[info.mid] && !state.upers[info.mid].name) {
        void deps.backfillUperName(info.mid, info.upName);
      }
      const identity: CardIdentity = {
        aid: info?.aid ?? c.aid,
        bvid: info?.bvid ?? c.bvid,
        mid: info?.mid ?? null,
      };
      const hit = matchCard(state, identity);
      const adHit = adHitOf(c.el);
      const promoHit = promoHitOf(c.el);
      const category = categoryHitOf(c.el);
      if (hit.video || hit.uper || adHit || promoHit || category.hit) {
        deps.applyOverlay(c.el, {
          videoHit: hit.video !== null,
          uperHit: hit.uper !== null,
          adHit,
          promoHit,
          categoryHit: category.hit,
          categoryName: category.name,
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
  if (cap.cancel) {
    if (cap.kind === 'video') {
      const id = cap.aid ?? cap.bvid;
      if (!id) return;
      if (await removeVideoRule(storage, id)) showToast('已取消屏蔽该视频');
    } else if (cap.mid) {
      if (await removeUperRule(storage, cap.mid)) showToast('已取消屏蔽该 UP 主');
    }
    return;
  }
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
  if (/分区/.test(ownText)) return null; // 分区规则不做（产品边界）
  return isUper ? 'uper' : 'video';
}

export function undoPlan(state: BlockState, identity: CardIdentity): { video: boolean; uper: boolean } {
  const hit = matchCard(state, identity);
  return { video: hit.video !== null, uper: hit.uper !== null };
}

export interface UndoDeps {
  getState: () => Promise<BlockState>;
  lookupInfo: (keys: Array<{ bvid?: string | null; aid?: string | null }>) => Promise<Map<string, LookupInfo | null>>;
  removeVideoRule: (id: string) => Promise<boolean>;
  removeUperRule: (mid: string) => Promise<boolean>;
  removeOverlay: (card: Element) => void;
  showToast: (text: string) => void;
}

export function installUndoSync(deps: UndoDeps): void {
  document.addEventListener(
    'click',
    (e) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const node = t.closest<HTMLElement>('span, i, div, p, button, li');
      if (!node || (node.textContent ?? '').trim() !== '撤销') return;
      const card = node.closest('.bili-video-card, .video-page-card, .video-list-item, .v-card, .floor-single-card, li');
      if (!card || !isOverlayed(card)) return;
      void (async () => {
        const state = await deps.getState();
        const href = card.querySelector<HTMLAnchorElement>('a[href*="/video/"]')?.getAttribute('href') ?? '';
        const bvid = /BV[0-9A-Za-z]{10}/.exec(href)?.[0] ?? null;
        const aid = extractAid(href);
        let identity: CardIdentity = { aid, bvid, mid: null };
        if (Object.keys(state.upers).length > 0 && (bvid || aid)) {
          const infos = await deps.lookupInfo([{ bvid, aid }]);
          const info = infos.get(cacheKey({ bvid, aid }));
          identity = { aid: info?.aid ?? aid, bvid: info?.bvid ?? bvid, mid: info?.mid ?? null };
        }
        const plan = undoPlan(state, identity);
        const parts: string[] = [];
        if (plan.video) {
          const id = identity.aid ?? identity.bvid;
          if (id && (await deps.removeVideoRule(id))) parts.push('已取消屏蔽该视频');
        }
        if (plan.uper && identity.mid && (await deps.removeUperRule(identity.mid))) parts.push('已取消屏蔽该 UP 主');
        if (parts.length > 0) {
          deps.removeOverlay(card);
          deps.showToast(parts.join(' · '));
        }
      })();
    },
    true,
  );
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

export function isExtensionContextValid(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.id;
}

function installRescan(): void {
  let scanning = false;
  let pending = false;
  let offState: (() => void) | null = null;
  function stop(): void {
    mo.disconnect();
    window.removeEventListener('scroll', debounced);
    offState?.();
  }
  async function scan(): Promise<void> {
    if (scanning) {
      pending = true;
      return;
    }
    if (pageKind() === 'other') return;
    scanning = true;
    try {
      if (!isExtensionContextValid()) {
        stop();
        pending = false;
        return;
      }
      const cards = scanCards(document.body);
      await reconcileCards(
        cards,
        {
          getState: () => loadState(storage),
          lookupInfo: (keys) => lookup.lookup(keys),
          applyOverlay,
          removeOverlay,
          backfillUperName: async (mid, name) => {
            await addUperRule(storage, { mid, name });
          },
        },
        {
          suppressWhen: (s) => {
            const mid = pageKind() === 'space' ? extractSpaceMid() : null;
            return !!mid && !!s.upers[mid];
          },
        },
      );
    } catch (err) {
      if (!isExtensionContextValid()) {
        stop();
        pending = false;
        return;
      }
      console.warn('Bili Catfish scan failed', err);
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
  offState = onStateChange(storage, () => debounced());
  window.addEventListener('scroll', debounced, { passive: true });
  void scan();
}

function main(): void {
  const kind = pageKind();
  if (kind === 'other') return;
  installUndoSync({
    getState: () => loadState(storage),
    lookupInfo: (keys) => lookup.lookup(keys),
    removeVideoRule: (id) => removeVideoRule(storage, id),
    removeUperRule: (mid) => removeUperRule(storage, mid),
    removeOverlay,
    showToast,
  });
  if (kind === 'space') {
    installSpace();
    installRescan();
    return;
  }
  installCaptureForwarding((url, body) => {
    recordCapture(url, body).catch(() => {});
  });
  installDomFallback();
  installRescan();
}

function navBottomOffset(): number {
  const header =
    document.querySelector<HTMLElement>('.bili-header') ??
    document.querySelector<HTMLElement>('header');
  const bottom = header?.getBoundingClientRect().bottom ?? 0;
  return bottom > 0 && bottom < 200 ? Math.round(bottom) : 64;
}

async function unblockUperByMid(mid: string): Promise<void> {
  const removed = await removeUperRule(storage, mid);
  if (removed) showToast('已取消屏蔽该 UP 主');
}

let spaceTimer: ReturnType<typeof setInterval> | null = null;

function installSpace(): void {
  let renderedMid: string | null = null;
  const refreshBanner = async (): Promise<void> => {
    try {
      const mid = extractSpaceMid();
      const state = await loadState(storage);
      if (mid && state.upers[mid] && !state.paused) {
        const bannerInDom = document.getElementById(BANNER_ID) !== null;
        if (!shouldRenderBanner(mid, renderedMid, bannerInDom)) return;
        removeSpaceBanner();
        const host = document.querySelector('#app .main-content, #app, body') ?? document.body;
        renderSpaceBanner(host as HTMLElement, () => void unblockUperByMid(mid), navBottomOffset());
        renderedMid = mid;
      } else {
        removeSpaceBanner();
        renderedMid = null;
      }
    } catch (err) {
      if (!isExtensionContextValid()) return;
      console.warn('Bili Catfish banner refresh failed', err);
    }
  };
  if (spaceTimer) clearInterval(spaceTimer);
  spaceTimer = setInterval(() => {
    if (extractSpaceMid() !== renderedMid) {
      void refreshBanner();
    } else if (renderedMid && !document.getElementById(BANNER_ID)) {
      void refreshBanner();
    }
  }, 1000);
  onStateChange(storage, () => void refreshBanner());
  void refreshBanner();
}

export { main as startContentScript };

if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
  main();
}
