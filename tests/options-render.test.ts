// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { renderList, formatImportSummary, renderCategories } from '../src/options/options';
import { CATEGORY_KEYS } from '../src/shared/types';
import type { ImportSummary } from '../src/shared/sync';

describe('renderList', () => {
  it('renders rows with unblock buttons and empty hint', () => {
    const c = document.createElement('div');
    renderList(c, [], () => {});
    expect(c.textContent).toContain('暂无记录');
    renderList(
      c,
      [{ id: '1', title: '标题 A', sub: 'BV1A', extra: 'UP：老番茄', blockedAt: 1767225600000 }],
      () => {},
    );
    expect(c.textContent).toContain('标题 A');
    expect(c.textContent).toContain('2026');
    const btn = c.querySelector('button')!;
    expect(btn.textContent).toBe('取消屏蔽');
  });

  it('click unblock invokes callback with id', () => {
    const c = document.createElement('div');
    const onRemove = vi.fn();
    renderList(c, [{ id: '42', title: 'T', sub: 'S', extra: '', blockedAt: 0 }], onRemove);
    (c.querySelector('button') as HTMLButtonElement).click();
    expect(onRemove).toHaveBeenCalledWith('42');
  });
});

describe('formatImportSummary', () => {
  it('formats counts in Chinese', () => {
    const s: ImportSummary = { videosAdded: 2, upersAdded: 1, duplicates: 3, invalid: 1 };
    expect(formatImportSummary(s)).toContain('新增屏蔽视频 2 条');
    expect(formatImportSummary(s)).toContain('新增屏蔽 UP 主 1 条');
    expect(formatImportSummary(s)).toContain('重复 3 条');
    expect(formatImportSummary(s)).toContain('无效 1 条');
  });
});

describe('settings toggles html', () => {
  it('options and popup expose course/promo toggles', () => {
    const optionsHtml = readFileSync(resolve(process.cwd(), 'src/options/options.html'), 'utf8');
    expect(optionsHtml).toContain('id="bcf-block-courses"');
    expect(optionsHtml).toContain('屏蔽课堂');
    expect(optionsHtml).toContain('id="bcf-block-promos"');
    expect(optionsHtml).toContain('屏蔽推广');
    const popupHtml = readFileSync(resolve(process.cwd(), 'src/popup/popup.html'), 'utf8');
    expect(popupHtml).toContain('id="bcf-block-courses"');
    expect(popupHtml).toContain('id="bcf-block-promos"');
  });
});

describe('renderCategories', () => {
  it('renders one toggle per category and reports changes', () => {
    const c = document.createElement('div');
    const onChange = vi.fn();
    document.body.appendChild(c);
    renderCategories(c, { 番剧: true }, onChange);
    const boxes = c.querySelectorAll('input[type="checkbox"]');
    expect(boxes).toHaveLength(CATEGORY_KEYS.length);
    const bangumi = [...boxes].find((b) => (b.parentElement?.textContent ?? '').includes('番剧')) as HTMLInputElement;
    expect(bangumi.checked).toBe(true);
    bangumi.click();
    expect(onChange).toHaveBeenCalledWith('番剧', false);
  });
});
