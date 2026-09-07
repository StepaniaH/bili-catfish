import { LOOKUP_CACHE_KEY } from '../content/lookup';
import type { CachedLookup, LookupInfo, LookupRequest, LookupResponse } from '../content/lookup';

const VIEW_API = 'https://api.bilibili.com/x/web-interface/view';
const FETCH_DELAY_MS = 150;

interface ViewApiData {
  code: number;
  data?: {
    aid: number;
    bvid: string;
    title: string;
    owner: { mid: number; name: string };
  };
}

async function fetchInfo(
  key: { bvid?: string; aid?: string },
  fetcher: typeof fetch,
): Promise<LookupInfo | null> {
  const params = new URLSearchParams();
  if (key.bvid) params.set('bvid', key.bvid);
  else if (key.aid) params.set('aid', key.aid);
  else return null;
  const res = await fetcher(`${VIEW_API}?${params.toString()}`);
  const json = (await res.json()) as ViewApiData;
  if (json.code !== 0 || !json.data) return null;
  return {
    aid: String(json.data.aid),
    bvid: json.data.bvid,
    title: json.data.title,
    mid: String(json.data.owner.mid),
    upName: json.data.owner.name,
  };
}

export async function handleLookup(
  keys: Array<{ bvid?: string; aid?: string }>,
  fetcher: typeof fetch,
): Promise<LookupResponse> {
  const out: LookupResponse = {};
  for (const key of keys) {
    const ck = key.bvid ? `bvid:${key.bvid}` : `aid:${key.aid}`;
    try {
      out[ck] = await fetchInfo(key, fetcher);
    } catch {
      out[ck] = null;
    }
    await new Promise((r) => setTimeout(r, FETCH_DELAY_MS));
  }
  return out;
}

export function mergeCacheEntries(
  existing: Record<string, CachedLookup>,
  res: LookupResponse,
  now: number,
): Record<string, CachedLookup> {
  const merged: Record<string, CachedLookup> = { ...existing };
  for (const [key, info] of Object.entries(res)) {
    merged[key] = { info, at: now };
  }
  return merged;
}

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  if (chrome.storage?.session?.setAccessLevel) {
    chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
  }
  chrome.runtime.onMessage.addListener((msg: LookupRequest, _sender, sendResponse) => {
    if (msg?.type !== 'bcf-lookup') return false;
    void (async () => {
      const res = await handleLookup(msg.keys ?? [], fetch);
      try {
        const o = await chrome.storage.session.get(LOOKUP_CACHE_KEY);
        const existing = (o?.[LOOKUP_CACHE_KEY] as Record<string, CachedLookup> | undefined) ?? {};
        await chrome.storage.session.set({ [LOOKUP_CACHE_KEY]: mergeCacheEntries(existing, res, Date.now()) });
      } catch {
        /* 写回失败不影响响应 */
      }
      sendResponse(res);
    })();
    return true; // 异步响应
  });
}
