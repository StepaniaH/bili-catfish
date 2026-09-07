export const BANNER_ID = 'bcf-space-banner';

export function renderSpaceBanner(container: HTMLElement, onUnblock: () => void): void {
  if (document.getElementById(BANNER_ID)) return;
  const banner = document.createElement('div');
  banner.id = BANNER_ID;
  banner.className = 'bcf-space-banner';
  const text = document.createElement('span');
  text.textContent = 'Bili Catfish：该 UP 主已被屏蔽';
  const btn = document.createElement('button');
  btn.textContent = '不再屏蔽该 UP 主';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    onUnblock();
  });
  banner.append(text, btn);
  container.appendChild(banner);
}

export function removeSpaceBanner(): void {
  document.getElementById(BANNER_ID)?.remove();
}
