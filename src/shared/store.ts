import { emptyState, type BlockState, type UperRule, type VideoRule } from './types';

export const STORAGE_KEY = 'bcf-state';

export interface KVStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  onChange(cb: () => void): () => void;
}

export function createMemoryStorage(): KVStorage {
  const data = new Map<string, unknown>();
  const listeners = new Set<() => void>();
  return {
    async get(key) {
      return data.get(key);
    },
    async set(key, value) {
      data.set(key, value);
      listeners.forEach((l) => l());
    },
    async remove(key) {
      data.delete(key);
      listeners.forEach((l) => l());
    },
    onChange(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
  };
}

export function createChromeStorage(): KVStorage {
  return {
    async get(key) {
      const o = await chrome.storage.local.get(key);
      return o[key];
    },
    async set(key, value) {
      await chrome.storage.local.set({ [key]: value });
    },
    async remove(key) {
      await chrome.storage.local.remove(key);
    },
    onChange(cb) {
      const l = (changes: Record<string, unknown>, areaName: string) => {
        if (areaName === 'local' && STORAGE_KEY in changes) cb();
      };
      chrome.storage.onChanged.addListener(l);
      return () => chrome.storage.onChanged.removeListener(l);
    },
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export async function loadState(s: KVStorage): Promise<BlockState> {
  const raw = await s.get(STORAGE_KEY);
  if (!isRecord(raw) || !isRecord(raw.videos) || !isRecord(raw.upers)) return emptyState();
  const videos: Record<string, VideoRule> = {};
  for (const [k, v] of Object.entries(raw.videos)) {
    if (isRecord(v) && typeof v.aid === 'string') videos[k] = v as unknown as VideoRule;
  }
  const upers: Record<string, UperRule> = {};
  for (const [k, v] of Object.entries(raw.upers)) {
    if (isRecord(v) && typeof v.mid === 'string') upers[k] = v as unknown as UperRule;
  }
  return { videos, upers, paused: raw.paused === true };
}

export async function saveState(s: KVStorage, state: BlockState): Promise<void> {
  await s.set(STORAGE_KEY, state);
}

export async function addVideoRule(
  s: KVStorage,
  rule: Omit<VideoRule, 'blockedAt'>,
): Promise<boolean> {
  const state = await loadState(s);
  const existing = state.videos[rule.aid];
  if (existing) {
    const merged = { ...existing, ...Object.fromEntries(Object.entries(rule).filter(([, v]) => v !== undefined)) };
    if (JSON.stringify(merged) === JSON.stringify(existing)) return false;
    state.videos[rule.aid] = merged;
    await saveState(s, state);
    return false;
  }
  state.videos[rule.aid] = { ...rule, blockedAt: Date.now() };
  await saveState(s, state);
  return true;
}

export async function addUperRule(
  s: KVStorage,
  rule: Omit<UperRule, 'blockedAt'>,
): Promise<boolean> {
  const state = await loadState(s);
  const existing = state.upers[rule.mid];
  if (existing) {
    if (rule.name && !existing.name) {
      state.upers[rule.mid] = { ...existing, name: rule.name };
      await saveState(s, state);
    }
    return false;
  }
  state.upers[rule.mid] = { ...rule, blockedAt: Date.now() };
  await saveState(s, state);
  return true;
}

export async function removeVideoRule(s: KVStorage, id: string): Promise<boolean> {
  const state = await loadState(s);
  if (state.videos[id]) {
    delete state.videos[id];
    await saveState(s, state);
    return true;
  }
  const key = Object.values(state.videos).find((v) => v.bvid === id)?.aid;
  if (key) {
    delete state.videos[key];
    await saveState(s, state);
    return true;
  }
  return false;
}

export async function removeUperRule(s: KVStorage, mid: string): Promise<boolean> {
  const state = await loadState(s);
  if (!state.upers[mid]) return false;
  delete state.upers[mid];
  await saveState(s, state);
  return true;
}

export async function setPaused(s: KVStorage, paused: boolean): Promise<void> {
  const state = await loadState(s);
  state.paused = paused;
  await saveState(s, state);
}

export async function clearAll(s: KVStorage): Promise<void> {
  await saveState(s, emptyState());
}

export function onStateChange(s: KVStorage, cb: (state: BlockState) => void): () => void {
  return s.onChange(() => {
    void loadState(s).then(cb);
  });
}
