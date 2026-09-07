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
  mask.textContent = labelFor(opts.videoHit, opts.uperHit);
  bar.textContent = '';
  if (opts.videoHit) bar.appendChild(makeButton('不再屏蔽该视频', opts.onUnblockVideo));
  if (opts.uperHit) bar.appendChild(makeButton('不再屏蔽该 UP 主', opts.onUnblockUper));
}

export function removeOverlay(card: Element): void {
  card.classList.remove(CARD_CLASS);
  card.querySelector(`:scope > .${MASK_CLASS}`)?.remove();
  card.querySelector(`:scope > .${BAR_CLASS}`)?.remove();
}
