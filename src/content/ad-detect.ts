export const AD_BADGE_TEXTS = ['广告', '推广'];

export function isAdCard(card: Element): boolean {
  const candidates = card.querySelectorAll<HTMLElement>('span, i, div, p');
  for (const el of Array.from(candidates)) {
    if (el.closest('a')) continue;
    const t = (el.textContent ?? '').trim();
    if (AD_BADGE_TEXTS.includes(t)) return true;
  }
  return false;
}
