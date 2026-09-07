// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderSpaceBanner, removeSpaceBanner, shouldRenderBanner, BANNER_ID } from '../src/content/space-banner';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('renderSpaceBanner', () => {
  it('renders banner with unblock button', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onUnblock = vi.fn();
    renderSpaceBanner(container, onUnblock);
    expect(container.querySelector('.bcf-space-banner')!.textContent).toContain('Bili Catfish：该 UP 主已被屏蔽');
    const btn = container.querySelector('.bcf-space-banner button') as HTMLButtonElement;
    expect(btn.textContent).toBe('不再屏蔽该 UP 主');
    btn.click();
    expect(onUnblock).toHaveBeenCalledTimes(1);
  });

  it('is idempotent', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    renderSpaceBanner(container, vi.fn());
    renderSpaceBanner(container, vi.fn());
    expect(container.querySelectorAll('.bcf-space-banner')).toHaveLength(1);
  });

  it('removeSpaceBanner removes it', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    renderSpaceBanner(container, vi.fn());
    removeSpaceBanner();
    expect(container.querySelector('.bcf-space-banner')).toBeNull();
  });
});

describe('shouldRenderBanner', () => {
  it('renders when banner missing even for same mid', () => {
    expect(shouldRenderBanner('A', 'A', false)).toBe(true);
  });

  it('skips re-render when banner present and same mid', () => {
    expect(shouldRenderBanner('A', 'A', true)).toBe(false);
  });

  it('re-renders when mid changed (SPA navigation A → B)', () => {
    expect(shouldRenderBanner('B', 'A', true)).toBe(true);
  });

  it('never renders without a mid', () => {
    expect(shouldRenderBanner(null, 'A', true)).toBe(false);
    expect(shouldRenderBanner(null, null, false)).toBe(false);
  });

  it('re-renders after banner node deleted by SPA re-render', () => {
    expect(shouldRenderBanner('A', 'A', true)).toBe(false);
    expect(shouldRenderBanner('A', 'A', false)).toBe(true);
  });
});

describe('banner mid switch (render A → render B replaces, no duplicates)', () => {
  it('replacing banner for a new mid leaves exactly one banner bound to new mid', () => {
    const host = document.body;
    renderSpaceBanner(host, () => {});
    const firstBtn = document.querySelector<HTMLButtonElement>(`#${BANNER_ID} button`)!;
    renderSpaceBanner(host, () => {}); // 同 mid 幂等
    expect(document.querySelectorAll(`#${BANNER_ID}`)).toHaveLength(1);
    removeSpaceBanner();
    renderSpaceBanner(host, () => {}); // 换 mid：先 remove 再 render
    expect(document.querySelectorAll(`#${BANNER_ID}`)).toHaveLength(1);
    expect(document.getElementById(BANNER_ID)).not.toBe(firstBtn.closest(`#${BANNER_ID}`));
  });

  it('re-render after DOM deletion re-renders', () => {
    renderSpaceBanner(document.body, () => {});
    document.getElementById(BANNER_ID)!.remove();
    renderSpaceBanner(document.body, () => {});
    expect(document.querySelectorAll(`#${BANNER_ID}`)).toHaveLength(1);
  });
});
