import { extractMid, normalizeAid } from './bili-ids';

export interface DislikeCapture {
  kind: 'video' | 'upper';
  aid?: string;
  bvid?: string;
  mid?: string;
}

function parseForm(body: string): URLSearchParams {
  try {
    return new URLSearchParams(body);
  } catch {
    return new URLSearchParams();
  }
}

function parseJsonBody(body: string): URLSearchParams {
  try {
    const o = JSON.parse(body) as Record<string, unknown>;
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(o)) {
      if (v !== null && typeof v !== 'object') p.set(k, String(v));
    }
    return p;
  } catch {
    return new URLSearchParams();
  }
}

function collectParams(url: string, body: string | null): URLSearchParams {
  const merged = new URLSearchParams();
  try {
    const u = new URL(url, 'https://www.bilibili.com');
    u.searchParams.forEach((v, k) => merged.set(k, v));
  } catch {
    /* 非 URL 字符串，忽略 */
  }
  if (body) {
    for (const src of [parseForm(body), parseJsonBody(body)]) {
      src.forEach((v, k) => {
        if (!merged.has(k)) merged.set(k, v);
      });
    }
  }
  return merged;
}

function avFromId(raw: string | null): string | null {
  if (!raw) return null;
  const m = /^av(\d+)$/i.exec(raw.trim());
  return m ? String(Number(m[1])) : null;
}

export function extractDislike(url: string, body: string | null): DislikeCapture | null {
  if (!url || !/dislike|feedback/i.test(url)) return null;
  const p = collectParams(url, body);
  const aid = normalizeAid(p.get('aid')) ?? normalizeAid(p.get('id_Av')) ?? avFromId(p.get('id'));
  const bvid = p.get('bvid') && /BV[0-9A-Za-z]{10}/.test(p.get('bvid')!) ? p.get('bvid')! : undefined;
  const goto = p.get('goto') ?? '';
  const mid =
    extractMid(p.get('mid')) ?? extractMid(p.get('upId')) ?? (goto === 'up' ? extractMid(p.get('id')) : null);

  if (goto === 'up' || p.has('upId') || (mid && !aid && !bvid)) {
    return mid ? { kind: 'upper', mid } : null;
  }
  if (aid || bvid) return { kind: 'video', aid: aid ?? undefined, bvid, mid: mid ?? undefined };
  return null;
}
