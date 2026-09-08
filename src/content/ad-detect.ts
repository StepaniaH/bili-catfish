import { CATEGORY_KEYS } from '../shared/types';

export const AD_BADGE_TEXTS = ['广告', '推广'];
export const COURSE_BADGE_TEXTS = ['课堂'];

function isBadgeElement(el: Element, texts: string[]): boolean {
  if (el.closest('a[href*="/video/"]')) return false;
  return texts.includes((el.textContent ?? '').trim());
}

export function isAdBadgeElement(el: Element): boolean {
  return isBadgeElement(el, AD_BADGE_TEXTS);
}

export function isCourseBadgeElement(el: Element): boolean {
  return isBadgeElement(el, COURSE_BADGE_TEXTS);
}

export function isTypeBadgeElement(el: Element): boolean {
  if (isAdBadgeElement(el) || isCourseBadgeElement(el)) return true;
  if (el.closest('a[href*="/video/"]')) return false;
  return (CATEGORY_KEYS as readonly string[]).includes((el.textContent ?? '').trim());
}

function hasBadge(card: Element, pred: (el: Element) => boolean): boolean {
  const candidates = card.querySelectorAll<HTMLElement>('span, i, div, p');
  for (const el of Array.from(candidates)) {
    if (pred(el)) return true;
  }
  return false;
}

export function isAdCard(card: Element): boolean {
  return hasBadge(card, isAdBadgeElement);
}

export function isCourseCard(card: Element): boolean {
  if (card.querySelector('a[href*="/cheese/"]')) return true;
  return hasBadge(card, isCourseBadgeElement);
}

export function isPromoCard(card: Element): boolean {
  return card.querySelector('.vui_icon.bili-video-card__stats--icon') !== null;
}

export const CATEGORY_BADGES: Record<string, string[]> = Object.fromEntries(
  CATEGORY_KEYS.map((key) => [key, [key]]),
);

export function isCategoryCard(card: Element, keywords: string[]): boolean {
  return hasBadge(card, (el) => {
    if (el.closest('a[href*="/video/"]')) return false;
    return keywords.includes((el.textContent ?? '').trim());
  });
}
