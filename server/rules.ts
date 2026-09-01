export type RuleSettings = {
  yesPoints: number;
  irrelevantPoints: number;
  framePoints: number;
  solutionPoints: number;
  earlyFrameBonus: number;
};

export type CompetitiveEvent = 'YES' | 'NO' | 'IRRELEVANT' | 'FRAME';
export type PartyEvent = CompetitiveEvent | 'HINT';

export function competitiveDelta(event: CompetitiveEvent, settings: RuleSettings) {
  if (event === 'YES') return settings.yesPoints;
  if (event === 'IRRELEVANT') return settings.irrelevantPoints;
  if (event === 'FRAME') return settings.framePoints;
  return 0;
}

export function solutionAward(settings: RuleSettings, remainingFramesBeforeTheory: number) {
  const remainingFrames = Math.max(0, Math.floor(remainingFramesBeforeTheory));
  const base = settings.solutionPoints;
  const bonus = remainingFrames * settings.earlyFrameBonus;
  return { base, bonus, remainingFrames, total: base + bonus };
}

export function partyScoreAfter(score: number, penalty: number) {
  return Math.max(0, score - Math.max(0, penalty));
}

export function partyDelta(event: PartyEvent, irrelevantPenalty: number, hintPenalty = 0) {
  if (event === 'IRRELEVANT') return -Math.abs(irrelevantPenalty);
  if (event === 'HINT') return -Math.abs(hintPenalty);
  return 0;
}

export function canMasterMutate(actorId: string, masterId: string | null, status: string) {
  return actorId === masterId && ['ACTIVE', 'ACTIVE_FUN'].includes(status);
}

export function canReadMasterData(actorId: string, masterId: string | null) {
  return actorId === masterId;
}

export function canClaimFrame(discovered: boolean) {
  return !discovered;
}

export function investigatorIds(playerIds: string[], masterId: string) {
  return playerIds.filter((id) => id !== masterId);
}

export function acceptWinner(status: string, winnerId: string | null) {
  return status === 'ACTIVE' && winnerId === null;
}

export function canWinParty(status: string, teamScore: number) {
  return status === 'ACTIVE' && teamScore > 0;
}

export function shouldApplyIdempotentEvent(seenKeys: Set<string>, key: string) {
  if (seenKeys.has(key)) return false;
  seenKeys.add(key);
  return true;
}
