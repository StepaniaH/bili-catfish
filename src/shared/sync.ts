import type { BlockState, UperRule, VideoRule } from './types';

export interface ExportVideo {
  aid: string;
  bvid?: string;
  title?: string;
  upMid?: string;
  upName?: string;
  blockedAt: number;
}

export interface ExportUper {
  mid: string;
  name?: string;
  blockedAt: number;
}

export interface ExportFile {
  app: 'bili-catfish';
  version: 1;
  exportedAt: string;
  videos: ExportVideo[];
  upers: ExportUper[];
}

export interface ImportSummary {
  videosAdded: number;
  upersAdded: number;
  duplicates: number;
  invalid: number;
}

export function buildExport(state: BlockState): ExportFile {
  return {
    app: 'bili-catfish',
    version: 1,
    exportedAt: new Date().toISOString(),
    videos: Object.values(state.videos).map((v: VideoRule) => ({
      aid: v.aid, bvid: v.bvid, title: v.title, upMid: v.upMid, upName: v.upName, blockedAt: v.blockedAt,
    })),
    upers: Object.values(state.upers).map((u: UperRule) => ({ mid: u.mid, name: u.name, blockedAt: u.blockedAt })),
  };
}

export function parseImport(text: string): ExportFile | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (o.app !== 'bili-catfish') return null;
  return {
    app: 'bili-catfish',
    version: 1,
    exportedAt: typeof o.exportedAt === 'string' ? o.exportedAt : new Date().toISOString(),
    videos: Array.isArray(o.videos) ? (o.videos as unknown[]) : [],
    upers: Array.isArray(o.upers) ? (o.upers as unknown[]) : [],
  } as ExportFile;
}

function toVideo(v: unknown): VideoRule | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.aid !== 'string' || !/^\d+$/.test(o.aid)) return null;
  return {
    aid: String(Number(o.aid)),
    bvid: typeof o.bvid === 'string' ? o.bvid : undefined,
    title: typeof o.title === 'string' ? o.title : undefined,
    upMid: typeof o.upMid === 'string' ? o.upMid : undefined,
    upName: typeof o.upName === 'string' ? o.upName : undefined,
    blockedAt: typeof o.blockedAt === 'number' ? o.blockedAt : Date.now(),
  };
}

function toUper(v: unknown): UperRule | null {
  if (typeof v !== 'object' || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.mid !== 'string' || !/^\d+$/.test(o.mid)) return null;
  return {
    mid: String(Number(o.mid)),
    name: typeof o.name === 'string' ? o.name : undefined,
    blockedAt: typeof o.blockedAt === 'number' ? o.blockedAt : Date.now(),
  };
}

export function mergeImport(
  state: BlockState,
  data: ExportFile,
): { state: BlockState; summary: ImportSummary } {
  const summary: ImportSummary = { videosAdded: 0, upersAdded: 0, duplicates: 0, invalid: 0 };
  for (const raw of data.videos) {
    const v = toVideo(raw);
    if (!v) {
      summary.invalid += 1;
      continue;
    }
    if (state.videos[v.aid]) {
      summary.duplicates += 1;
      continue;
    }
    state.videos[v.aid] = v;
    summary.videosAdded += 1;
  }
  for (const raw of data.upers) {
    const u = toUper(raw);
    if (!u) {
      summary.invalid += 1;
      continue;
    }
    if (state.upers[u.mid]) {
      summary.duplicates += 1;
      continue;
    }
    state.upers[u.mid] = u;
    summary.upersAdded += 1;
  }
  return { state, summary };
}
