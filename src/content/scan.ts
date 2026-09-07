import { extractAid, extractBvid } from '../core/bili-ids';

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
  return Array.from(byEl.values());
}

export function pageKind(href: string = location.href): 'home' | 'search' | 'related' | 'other' {
  try {
    const u = new URL(href);
    if (u.hostname === 'search.bilibili.com') return 'search';
    if (u.hostname === 'www.bilibili.com' && /^\/video\//.test(u.pathname)) return 'related';
    if (u.hostname === 'www.bilibili.com' && (u.pathname === '/' || u.pathname === '/index.html')) return 'home';
  } catch {
    /* fallthrough */
  }
  return 'other';
}
