export interface LookupInfo {
  aid: string;
  bvid?: string;
  title?: string;
  mid?: string;
  upName?: string;
}

export interface LookupRequest {
  type: 'bcf-lookup';
  keys: Array<{ bvid?: string; aid?: string }>;
}

export type LookupResponse = Record<string, LookupInfo | null>;

export function cacheKey(k: { bvid?: string | null; aid?: string | null }): string {
  return k.bvid ? `bvid:${k.bvid}` : `aid:${k.aid}`;
}

const BATCH_DELAY_MS = 50;

export interface CachedLookup {
  info: LookupInfo | null;
  at: number;
}

export const LOOKUP_CACHE_KEY = 'bcf-lookup-cache';
export const POSITIVE_TTL_MS = 24 * 3600 * 1000;
export const NEGATIVE_TTL_MS = 3600 * 1000;

function isFresh(e: CachedLookup): boolean {
  const ttl = e.info ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS;
  return Date.now() - e.at < ttl;
}

export function createLookup(
  send: (msg: LookupRequest) => Promise<LookupResponse>,
  readCache?: (key: string) => Promise<CachedLookup | undefined>,
): {
  lookup: (keys: Array<{ bvid?: string | null; aid?: string | null }>) => Promise<Map<string, LookupInfo | null>>;
  peek: (key: string) => LookupInfo | null;
} {
  const cache = new Map<string, LookupInfo | null>();

  async function hydrate(keys: Array<{ bvid?: string | null; aid?: string | null }>): Promise<void> {
    if (!readCache) return;
    for (const k of keys) {
      const ck = cacheKey(k);
      if (cache.has(ck)) continue;
      try {
        const e = await readCache(ck);
        if (e && isFresh(e)) cache.set(ck, e.info);
      } catch {
        /* 缓存读取失败按未命中处理 */
      }
    }
  }

  async function flush(keys: Array<{ bvid?: string | null; aid?: string | null }>): Promise<void> {
    const fresh = keys.filter((k) => !cache.has(cacheKey(k)));
    const uniq = new Map<string, { bvid?: string | null; aid?: string | null }>();
    for (const k of fresh) uniq.set(cacheKey(k), k);
    if (uniq.size === 0) return;
    const res = await send({
      type: 'bcf-lookup',
      keys: Array.from(uniq.values(), (k) => ({ bvid: k.bvid ?? undefined, aid: k.aid ?? undefined })),
    });
    for (const key of uniq.keys()) cache.set(key, res[key] ?? null);
  }

  function schedule(keys: Array<{ bvid?: string | null; aid?: string | null }>): Promise<void> {
    return new Promise((resolve) => setTimeout(() => resolve(flush(keys)), BATCH_DELAY_MS));
  }

  return {
    async lookup(keys) {
      await hydrate(keys);
      const pending = keys.filter((k) => !cache.has(cacheKey(k)));
      await schedule(pending);
      const out = new Map<string, LookupInfo | null>();
      for (const k of keys) out.set(cacheKey(k), cache.get(cacheKey(k)) ?? null);
      return out;
    },
    peek(key) {
      return cache.get(key) ?? null;
    },
  };
}
