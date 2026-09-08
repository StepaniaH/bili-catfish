import { extractMid, normalizeAid } from './bili-ids';

export interface DislikeCapture {
  kind: 'video' | 'upper';
  aid?: string;
  bvid?: string;
  mid?: string;
  cancel: boolean;
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
  const gate = /(^|\/)(dislike|feedback)/i;
  let path = url;
  try {
    path = new URL(url, 'https://www.bilibili.com').pathname;
  } catch {
    /* 无法解析 URL，退回用原始串匹配 */
  }
  if (!gate.test(path)) return null;
  if (/\/(log|report)(\/|$)/i.test(path)) return null;
  let isCancel = false;
  try {
    isCancel = /\/dislike\/cancel(\/|$)/i.test(new URL(url, 'https://www.bilibili.com').pathname);
  } catch {
    isCancel = /\/dislike\/cancel(\/|$)/i.test(url);
  }
  const p = collectParams(url, body);
  const goto = p.get('goto') ?? '';
  const aid =
    normalizeAid(p.get('aid')) ??
    normalizeAid(p.get('id_Av')) ??
    avFromId(p.get('id')) ??
    (goto === 'av' ? normalizeAid(p.get('id')) : null);
  const bvid = p.get('bvid') && /BV[0-9A-Za-z]{10}/.test(p.get('bvid')!) ? p.get('bvid')! : undefined;
  const mid =
    extractMid(p.get('mid')) ?? extractMid(p.get('upId')) ?? (goto === 'up' ? extractMid(p.get('id')) : null);
  const hasVideoId = aid !== null || bvid !== undefined;

  const reasonId = p.get('reason_id');
  if (reasonId === '1') {
    return hasVideoId ? { kind: 'video', aid: aid ?? undefined, bvid, mid: mid ?? undefined, cancel: isCancel } : null;
  }
  if (reasonId === '4') {
    return mid ? { kind: 'upper', mid, cancel: isCancel } : null;
  }
  if (reasonId) return null;

  if (goto === 'up' || (mid && !hasVideoId)) {
    return mid ? { kind: 'upper', mid, cancel: isCancel } : null;
  }
  if (hasVideoId) return { kind: 'video', aid: aid ?? undefined, bvid, mid: mid ?? undefined, cancel: isCancel };
  return null;
}
