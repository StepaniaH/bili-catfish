import { createChromeStorage, loadState, setBlockAds, setBlockCourses, setBlockPromos, setPaused } from '../shared/store';

const storage = createChromeStorage();

async function refresh(): Promise<void> {
  const state = await loadState(storage);
  const nVideos = Object.keys(state.videos).length;
  const nUpers = Object.keys(state.upers).length;
  document.getElementById('bcf-status')!.textContent = state.paused ? '已暂停' : '已启用';
  (document.getElementById('bcf-paused') as HTMLInputElement).checked = state.paused;
  (document.getElementById('bcf-block-ads') as HTMLInputElement).checked = state.blockAds;
  (document.getElementById('bcf-block-courses') as HTMLInputElement).checked = state.blockCourses;
  (document.getElementById('bcf-block-promos') as HTMLInputElement).checked = state.blockPromos;
  document.getElementById('bcf-counts')!.textContent = `已屏蔽视频 ${nVideos} 个 · 已屏蔽 UP 主 ${nUpers} 位`;
}

document.getElementById('bcf-block-ads')!.addEventListener('change', async (e) => {
  await setBlockAds(storage, (e.target as HTMLInputElement).checked);
  await refresh();
});

document.getElementById('bcf-block-courses')!.addEventListener('change', async (e) => {
  await setBlockCourses(storage, (e.target as HTMLInputElement).checked);
  await refresh();
});

document.getElementById('bcf-block-promos')!.addEventListener('change', async (e) => {
  await setBlockPromos(storage, (e.target as HTMLInputElement).checked);
  await refresh();
});

document.getElementById('bcf-paused')!.addEventListener('change', async (e) => {
  await setPaused(storage, (e.target as HTMLInputElement).checked);
  await refresh();
});

document.getElementById('bcf-open-options')!.addEventListener('click', () => {
  void chrome.runtime.openOptionsPage();
});

void refresh();
