// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderSpaceBanner, removeSpaceBanner } from '../src/content/space-banner';

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
