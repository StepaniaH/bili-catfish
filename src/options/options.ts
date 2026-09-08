import {
  clearAll, createChromeStorage, loadState, removeUperRule, removeVideoRule, saveState, setBlockAds, setBlockCourses,
  setBlockPromos, setBlockedCategory, setPaused,
} from '../shared/store';
import { buildExport, mergeImport, parseImport, type ImportSummary } from '../shared/sync';
import { CATEGORY_KEYS, type BlockState } from '../shared/types';

const storage = createChromeStorage();

export interface ListItem {
  id: string;
  title: string;
  sub: string;
  extra: string;
  blockedAt: number;
}

export function formatImportSummary(s: ImportSummary): string {
  return `导入完成：新增屏蔽视频 ${s.videosAdded} 条，新增屏蔽 UP 主 ${s.upersAdded} 条，重复 ${s.duplicates} 条，无效 ${s.invalid} 条。`;
}

export function renderList(
  container: HTMLElement,
  items: ListItem[],
  onRemove: (id: string) => void,
): void {
  container.textContent = '';
  if (items.length === 0) {
    const p = document.createElement('p');
    p.className = 'bcf-empty';
    p.textContent = '暂无记录';
    container.appendChild(p);
    return;
  }
  for (const item of items) {
    const row = document.createElement('div');
    row.className = 'bcf-row';
    const main = document.createElement('div');
    main.className = 'bcf-row-main';
    const t = document.createElement('div');
    t.className = 'bcf-row-title';
    t.textContent = item.title || '（未知标题）';
    const meta = document.createElement('div');
    meta.className = 'bcf-row-meta';
    const idEl = document.createElement('code');
    idEl.className = 'bcf-row-id';
    idEl.textContent = item.sub;
    meta.appendChild(idEl);
    if (item.extra) {
      const up = document.createElement('span');
      up.className = 'bcf-row-up';
      up.textContent = item.extra;
      meta.appendChild(up);
    }
    main.append(t, meta);
    const time = document.createElement('span');
    time.className = 'bcf-row-time';
    time.textContent = item.blockedAt ? new Date(item.blockedAt).toLocaleDateString('zh-CN') : '';
    const btn = document.createElement('button');
    btn.textContent = '取消屏蔽';
    btn.addEventListener('click', () => onRemove(item.id));
    row.append(main, time, btn);
    container.appendChild(row);
  }
}

export function renderCategories(
  container: HTMLElement,
  checked: Record<string, boolean>,
  onChange: (key: string, on: boolean) => void,
): void {
  container.textContent = '';
  for (const key of CATEGORY_KEYS) {
    const label = document.createElement('label');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = checked[key] === true;
    box.addEventListener('change', () => onChange(key, box.checked));
    label.append(box, document.createTextNode(key));
    container.appendChild(label);
  }
}

function el<T extends HTMLElement>(id: string): T {
  const e = document.getElementById(id);
  if (!e) throw new Error(`missing #${id}`);
  return e as T;
}

function stateToLists(state: BlockState): { videos: ListItem[]; upers: ListItem[] } {
  return {
    videos: Object.values(state.videos)
      .sort((a, b) => b.blockedAt - a.blockedAt)
      .map((v) => ({
        id: v.aid,
        title: v.title ?? '',
        sub: [v.aid, v.bvid].filter(Boolean).join(' / '),
        extra: v.upName ? `UP：${v.upName}` : '',
        blockedAt: v.blockedAt,
      })),
    upers: Object.values(state.upers)
      .sort((a, b) => b.blockedAt - a.blockedAt)
      .map((u) => ({
        id: u.mid,
        title: u.name ?? '',
        sub: `UID：${u.mid}`,
        extra: '',
        blockedAt: u.blockedAt,
      })),
  };
}

async function refresh(): Promise<void> {
  const state = await loadState(storage);
  const { videos, upers } = stateToLists(state);
  const videosEl = el<HTMLDivElement>('bcf-videos');
  const upersEl = el<HTMLDivElement>('bcf-upers');
  el<HTMLSpanElement>('bcf-count').textContent = `已屏蔽视频 ${videos.length} 个 · 已屏蔽 UP 主 ${upers.length} 位`;
  renderList(videosEl, videos, async (id) => {
    await removeVideoRule(storage, id);
    await refresh();
  });
  renderList(upersEl, upers, async (mid) => {
    await removeUperRule(storage, mid);
    await refresh();
  });
  const pausedEl = el<HTMLInputElement>('bcf-paused');
  pausedEl.checked = state.paused;
  el<HTMLInputElement>('bcf-block-ads').checked = state.blockAds;
  el<HTMLInputElement>('bcf-block-courses').checked = state.blockCourses;
  el<HTMLInputElement>('bcf-block-promos').checked = state.blockPromos;
  renderCategories(el<HTMLSpanElement>('bcf-categories'), state.blockedCategories, async (key, on) => {
    await setBlockedCategory(storage, key, on);
    await refresh();
  });
  el<HTMLSpanElement>('bcf-status').textContent = state.paused ? '已暂停' : '已启用';
}

export function main(): void {
  void refresh();

  el<HTMLButtonElement>('bcf-export').addEventListener('click', async () => {
    const state = await loadState(storage);
    const data = JSON.stringify(buildExport(state), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bili-catfish-屏蔽列表-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  el<HTMLInputElement>('bcf-import-file').addEventListener('change', async (e) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const text = await file.text();
    const data = parseImport(text);
    const resultEl = el<HTMLParagraphElement>('bcf-import-result');
    if (!data) {
      resultEl.textContent = '导入失败：文件不是有效的 Bili Catfish 屏蔽数据。';
      input.value = '';
      return;
    }
    const state = await loadState(storage);
    const { state: merged, summary } = mergeImport(state, data);
    // 用合并后的整体状态覆盖保存
    await saveState(storage, merged);
    resultEl.textContent = formatImportSummary(summary);
    input.value = '';
    await refresh();
  });

  el<HTMLButtonElement>('bcf-clear').addEventListener('click', async () => {
    const ok = window.confirm('确定清空所有屏蔽记录吗？\n\n清空后，之前被屏蔽的视频和 UP 主可能重新出现在 Bilibili 中。');
    if (!ok) return;
    await clearAll(storage);
    await refresh();
  });

  el<HTMLInputElement>('bcf-block-ads').addEventListener('change', async (e) => {
    await setBlockAds(storage, (e.target as HTMLInputElement).checked);
    await refresh();
  });

  el<HTMLInputElement>('bcf-block-courses').addEventListener('change', async (e) => {
    await setBlockCourses(storage, (e.target as HTMLInputElement).checked);
    await refresh();
  });

  el<HTMLInputElement>('bcf-block-promos').addEventListener('change', async (e) => {
    await setBlockPromos(storage, (e.target as HTMLInputElement).checked);
    await refresh();
  });

  el<HTMLInputElement>('bcf-paused').addEventListener('change', async (e) => {
    await setPaused(storage, (e.target as HTMLInputElement).checked);
    await refresh();
  });
}

if (typeof document !== 'undefined' && document.getElementById('bcf-videos')) main();
