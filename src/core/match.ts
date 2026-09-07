import type { BlockState, VideoRule, UperRule } from '../shared/types';

export interface CardIdentity {
  aid?: string | null;
  bvid?: string | null;
  mid?: string | null;
}

export interface MatchResult {
  video: VideoRule | null;
  uper: UperRule | null;
}

export function matchCard(state: BlockState, card: CardIdentity): MatchResult {
  let video: VideoRule | null = null;
  if (card.aid && state.videos[card.aid]) {
    video = state.videos[card.aid];
  } else if (card.bvid) {
    for (const v of Object.values(state.videos)) {
      if (v.bvid === card.bvid) {
        video = v;
        break;
      }
    }
  }
  const uper = card.mid && state.upers[card.mid] ? state.upers[card.mid] : null;
  return { video, uper };
}
