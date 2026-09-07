import { createChromeStorage, loadState, setPaused } from '../shared/store';

const storage = createChromeStorage();

async function refresh(): Promise<void> {
  const state = await loadState(storage);
  const nVideos = Object.keys(state.videos).length;
  const nUpers = Object.keys(state.upers).length;
  document.getElementById('bcf-status')!.textContent = state.paused ? '已暂停' : '已启用';
  (document.getElementById('bcf-paused') as HTMLInputElement).checked = state.paused;
  document.getElementById('bcf-counts')!.textContent = `已屏蔽视频 ${nVideos} 个 · 已屏蔽 UP 主 ${nUpers} 位`;
}

document.getElementById('bcf-paused')!.addEventListener('change', async (e) => {
  await setPaused(storage, (e.target as HTMLInputElement).checked);
  await refresh();
});

document.getElementById('bcf-open-options')!.addEventListener('click', () => {
  void chrome.runtime.openOptionsPage();
});

void refresh();
