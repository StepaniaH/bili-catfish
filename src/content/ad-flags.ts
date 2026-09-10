export type AdKind = 'ad' | 'promo';

export interface AdFlag {
  kind: AdKind;
  bvid?: string;
  aid?: string;
  creativeId?: string;
}

export const AD_FLAGS_TTL_MS = 30 * 60 * 1000;
export const AD_FLAGS_MAX_ENTRIES = 1000;
const MAX_WALK_DEPTH = 12;
const MAX_WALK_NODES = 20_000;

const BVID_RE = /^BV[0-9A-Za-z]{10}$/;

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : null;
}

function asStringId(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'string' && v.trim() !== '') return v.trim();
  return undefined;
}

function asBvid(v: unknown): string | undefined {
  const s = asStringId(v);
  return s && BVID_RE.test(s) ? s : undefined;
}

function asAid(v: unknown): string | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'string' && /^\d+$/.test(v)) return v;
  return undefined;
}

function isPromoType(o: Record<string, unknown>): boolean {
  return o.card_type === 82 || o.card_type === 'video_ad_82' || o.type === 'video_ad_82';
}

function isAdItem(o: Record<string, unknown>): boolean {
  if (o.is_ad === true || o.is_ad === 1) return true;
  if (o.goto === 'ad' || o.card_goto === 'ad') return true;
  if (isPromoType(o)) return true;
  const adContent = asRecord(o.ad_content);
  return adContent !== null && (adContent.creative_id !== undefined || adContent.ad_cb !== undefined);
}

function collectFlag(o: Record<string, unknown>): AdFlag | null {
  const biz = asRecord(o.biz_data);
  const candidates = [
    o,
    asRecord(o.archive),
    biz,
    biz ? asRecord(biz.archive) : null,
    biz ? asRecord(biz.ad_content) : null,
    asRecord(o.ad_content),
  ];
  let bvid: string | undefined;
  let aid: string | undefined;
  let creativeId: string | undefined;
  for (const c of candidates) {
    if (!c) continue;
    bvid ??= asBvid(c.bvid);
    aid ??= asAid(c.aid);
    creativeId ??= asStringId(c.creative_id);
  }
  if (!bvid && !aid && !creativeId) return null;
  return { kind: isPromoType(o) ? 'promo' : 'ad', bvid, aid, creativeId };
}

export function extractAdFlags(root: unknown): AdFlag[] {
  const out: AdFlag[] = [];
  let nodes = 0;
  const visit = (v: unknown, depth: number): void => {
    if (nodes++ > MAX_WALK_NODES || depth > MAX_WALK_DEPTH) return;
    if (Array.isArray(v)) {
      for (const item of v) visit(item, depth + 1);
      return;
    }
    const o = asRecord(v);
    if (!o) return;
    if (isAdItem(o)) {
      const flag = collectFlag(o);
      if (flag) out.push(flag);
    }
    for (const value of Object.values(o)) {
      if (typeof value === 'object' && value !== null) visit(value, depth + 1);
    }
  };
  visit(root, 0);
  return out;
}

export interface AdFlagKey {
  bvid?: string | null;
  aid?: string | null;
  creativeId?: string | null;
}

export interface AdFlagStore {
  ingest(url: string, text: string): boolean;
  locate(key: AdFlagKey): AdKind | null;
  size(): number;
}

export function createAdFlags(now: () => number = Date.now): AdFlagStore {
  const entries = new Map<string, { kind: AdKind; at: number }>();

  function set(key: string, kind: AdKind): boolean {
    const current = entries.get(key);
    if (current) {
      current.at = now();
      return false;
    }
    if (entries.size >= AD_FLAGS_MAX_ENTRIES) {
      const oldest = entries.keys().next().value;
      if (oldest !== undefined) entries.delete(oldest);
    }
    entries.set(key, { kind, at: now() });
    return true;
  }

  function ingest(_url: string, text: string): boolean {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return false;
    }
    let changed = false;
    for (const flag of extractAdFlags(json)) {
      if (flag.bvid && set(`bvid:${flag.bvid}`, flag.kind)) changed = true;
      if (flag.aid && set(`aid:${flag.aid}`, flag.kind)) changed = true;
      if (flag.creativeId && set(`cid:${flag.creativeId}`, flag.kind)) changed = true;
    }
    return changed;
  }

  function locate(key: AdFlagKey): AdKind | null {
    const keys: string[] = [];
    if (key.bvid) keys.push(`bvid:${key.bvid}`);
    if (key.aid) keys.push(`aid:${key.aid}`);
    if (key.creativeId) keys.push(`cid:${key.creativeId}`);
    const t = now();
    for (const k of keys) {
      const entry = entries.get(k);
      if (!entry) continue;
      if (t - entry.at > AD_FLAGS_TTL_MS) {
        entries.delete(k);
        continue;
      }
      return entry.kind;
    }
    return null;
  }

  return { ingest, locate, size: () => entries.size };
}
