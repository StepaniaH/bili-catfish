import type { LookupInfo, LookupRequest, LookupResponse } from '../content/lookup';

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

if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg: LookupRequest, _sender, sendResponse) => {
    if (msg?.type !== 'bcf-lookup') return false;
    void handleLookup(msg.keys ?? [], fetch).then(sendResponse);
    return true; // 异步响应
  });
}
