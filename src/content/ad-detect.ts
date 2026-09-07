export const AD_BADGE_TEXTS = ['广告', '推广'];

export function isAdBadgeElement(el: Element): boolean {
  if (el.closest('a[href*="/video/"]')) return false;
  return AD_BADGE_TEXTS.includes((el.textContent ?? '').trim());
}

export function isAdCard(card: Element): boolean {
  const candidates = card.querySelectorAll<HTMLElement>('span, i, div, p');
  for (const el of Array.from(candidates)) {
    if (isAdBadgeElement(el)) return true;
  }
  return false;
}
