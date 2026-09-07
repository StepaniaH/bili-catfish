export interface ApplyOptions {
  videoHit: boolean;
  uperHit: boolean;
  onUnblockVideo: () => void;
  onUnblockUper: () => void;
}

const MASK_CLASS = 'bcf-mask';
const BAR_CLASS = 'bcf-bar';
const CARD_CLASS = 'bcf-card';

function labelFor(videoHit: boolean, uperHit: boolean): string {
  if (videoHit && uperHit) return '已屏蔽该视频 · 已屏蔽该 UP 主';
  if (videoHit) return '已屏蔽该视频';
  return '已屏蔽该 UP 主';
}

function makeButton(text: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
  });
  return b;
}

export function isOverlayed(card: Element): boolean {
  return card.classList.contains(CARD_CLASS) && card.querySelector(`.${MASK_CLASS}`) !== null;
}

export function applyOverlay(card: Element, opts: ApplyOptions): void {
  card.classList.add(CARD_CLASS);
  let mask = card.querySelector<HTMLDivElement>(`:scope > .${MASK_CLASS}`);
  let bar = card.querySelector<HTMLDivElement>(`:scope > .${BAR_CLASS}`);
  if (!mask) {
    mask = document.createElement('div');
    mask.className = MASK_CLASS;
    card.appendChild(mask);
  }
  if (!bar) {
    bar = document.createElement('div');
    bar.className = BAR_CLASS;
    card.appendChild(bar);
  }
  const label = labelFor(opts.videoHit, opts.uperHit);
  if (mask.textContent !== label) mask.textContent = label;
  const buttons: Array<{ text: string; onClick: () => void }> = [];
  if (opts.videoHit) buttons.push({ text: '不再屏蔽该视频', onClick: opts.onUnblockVideo });
  if (opts.uperHit) buttons.push({ text: '不再屏蔽该 UP 主', onClick: opts.onUnblockUper });
  const current = Array.from(bar.children).filter((el): el is HTMLButtonElement => el instanceof HTMLButtonElement);
  const sameSet =
    current.length === buttons.length &&
    buttons.every((b, i) => current[i]!.textContent === b.text);
  if (!sameSet) {
    bar.textContent = '';
    for (const b of buttons) bar.appendChild(makeButton(b.text, b.onClick));
  }
}

export function removeOverlay(card: Element): void {
  card.classList.remove(CARD_CLASS);
  card.querySelector(`:scope > .${MASK_CLASS}`)?.remove();
  card.querySelector(`:scope > .${BAR_CLASS}`)?.remove();
}
