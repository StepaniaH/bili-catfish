// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderList, formatImportSummary } from '../src/options/options';
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
