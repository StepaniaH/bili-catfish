export interface VideoRule {
  /** Bilibili aid（数字字符串），主键 */
  aid: string;
  bvid?: string;
  title?: string;
  upMid?: string;
  upName?: string;
  blockedAt: number;
}

export interface UperRule {
  /** Bilibili mid（数字字符串），主键 */
  mid: string;
  name?: string;
  blockedAt: number;
}

export interface BlockState {
  videos: Record<string, VideoRule>;
  upers: Record<string, UperRule>;
  paused: boolean;
  blockAds: boolean;
}

export function emptyState(): BlockState {
  return { videos: {}, upers: {}, paused: false, blockAds: false };
}
