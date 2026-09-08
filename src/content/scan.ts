import { extractAid, extractBvid } from '../core/bili-ids';
import { isTypeBadgeElement } from './ad-detect';

export interface CardRef {
  el: Element;
  bvid: string | null;
  aid: string | null;
}

const CONTAINER_SELECTOR = [
  '.bili-video-card',
  '.video-page-card',
  '.video-list-item',
  '.v-card',
  'li',
  '.floor-single-card',
  '.bili-live-card',
].join(',');

const BADGE_CONTAINER_SELECTOR = [
  '.bili-video-card',
  '.video-page-card',
  '.video-list-item',
  '.v-card',
  '.floor-single-card',
  '.bili-live-card',
].join(',');

const ANCHOR_SELECTOR = 'a[href*="/video/BV"], a[href*="bvid=BV"], a[href*="/video/av"], a[href*="aid="]';

export function scanCards(root: Document | Element): CardRef[] {
  const byEl = new Map<Element, CardRef>();
  const anchors = root.querySelectorAll(ANCHOR_SELECTOR);
  for (const a of Array.from(anchors)) {
    const href = a.getAttribute('href') ?? '';
    const bvid = extractBvid(href);
    const aid = extractAid(href);
    if (!bvid && !aid) continue;
    const el = a.closest(CONTAINER_SELECTOR) ?? a;
    const existing = byEl.get(el);
    if (!existing) byEl.set(el, { el, bvid, aid });
    else {
      existing.bvid = existing.bvid ?? bvid;
      existing.aid = existing.aid ?? aid;
    }
  }
  const badgeCandidates = root.querySelectorAll<HTMLElement>('span, i, div, p');
  for (const el of Array.from(badgeCandidates)) {
    if (!isTypeBadgeElement(el)) continue;
    const card = el.closest(BADGE_CONTAINER_SELECTOR);
    if (!card || byEl.has(card)) continue;
    byEl.set(card, { el: card, bvid: null, aid: null });
  }
  return Array.from(byEl.values());
}

export function pageKind(href: string = location.href): 'home' | 'search' | 'related' | 'space' | 'other' {
  try {
    const u = new URL(href);
    if (u.hostname === 'search.bilibili.com') return 'search';
    if (u.hostname === 'space.bilibili.com') return 'space';
    if (u.hostname === 'www.bilibili.com' && /^\/video\//.test(u.pathname)) return 'related';
    if (u.hostname === 'www.bilibili.com' && (u.pathname === '/' || u.pathname === '/index.html')) return 'home';
  } catch {
    /* fallthrough */
  }
  return 'other';
}

export function extractSpaceMid(href: string = location.href): string | null {
  try {
    const u = new URL(href);
    if (u.hostname !== 'space.bilibili.com') return null;
    const m = /^\/(\d+)/.exec(u.pathname);
    return m ? m[1]! : null;
  } catch {
    return null;
  }
}
