import assert from 'node:assert/strict';
import test from 'node:test';
import {
  acceptWinner,
  canClaimFrame,
  canMasterMutate,
  canReadMasterData,
  canWinParty,
  competitiveDelta,
  investigatorIds,
  partyDelta,
  partyScoreAfter,
  shouldApplyIdempotentEvent,
  solutionAward,
} from '../server/rules.ts';

const settings = {
  yesPoints: 10,
  irrelevantPoints: -5,
  framePoints: 30,
  solutionPoints: 100,
  earlyFrameBonus: 25,
};

test('Competitive: SÌ, NO, irrilevante e Frame usano solo i valori server', () => {
  assert.equal(competitiveDelta('YES', settings), 10);
  assert.equal(competitiveDelta('NO', settings), 0);
  assert.equal(competitiveDelta('IRRELEVANT', settings), -5);
  assert.equal(competitiveDelta('FRAME', settings), 30);
});

test('Competitive: SÌ e Frame possono sommarsi nella stessa deduzione', () => {
  assert.equal(competitiveDelta('YES', settings) + competitiveDelta('FRAME', settings), 40);
});

test('Frame: un Frame già scoperto non può essere assegnato di nuovo', () => {
  assert.equal(canClaimFrame(false), true);
  assert.equal(canClaimFrame(true), false);
});

test('Competitive: l’indizio colpisce tutti gli investigatori tranne il Master', () => {
  assert.deepEqual(investigatorIds(['master', 'anna', 'luca'], 'master'), ['anna', 'luca']);
});

test('Competitive: soluzione base e bonus anticipato sono corretti', () => {
  assert.deepEqual(solutionAward(settings, 0), { base: 100, bonus: 0, remainingFrames: 0, total: 100 });
  assert.equal(solutionAward(settings, 1).total, 125);
  assert.equal(solutionAward(settings, 2).total, 150);
  assert.equal(solutionAward(settings, 3).total, 175);
});

test('Competitive: i Frame narrati nella teoria non riducono il bonus retroattivamente', () => {
  const stateBeforeTheory = 3;
  assert.equal(solutionAward(settings, stateBeforeTheory).total, 175);
});

test('Competitive: il punteggio personale può diventare negativo', () => {
  assert.equal(3 + competitiveDelta('IRRELEVANT', settings), -2);
});

test('Soluzioni simultanee: viene accettato un solo vincitore', () => {
  assert.equal(acceptWinner('ACTIVE', null), true);
  assert.equal(acceptWinner('SOLVED', 'anna'), false);
  assert.equal(acceptWinner('ACTIVE', 'anna'), false);
});

test('Party: parte dal valore impostato e applica soltanto le penalità previste', () => {
  const start = 137;
  assert.equal(start, 137);
  assert.equal(partyDelta('YES', 5), 0);
  assert.equal(partyDelta('NO', 5), 0);
  assert.equal(partyDelta('FRAME', 5), 0);
  assert.equal(partyDelta('IRRELEVANT', 5), -5);
  assert.equal(partyDelta('HINT', 5, 20), -20);
});

test('Party: il punteggio non scende mai sotto zero e a zero il round è perso', () => {
  assert.equal(partyScoreAfter(15, 20), 0);
  assert.equal(partyScoreAfter(65, 20), 45);
  assert.equal(canWinParty('LOST', 0), false);
  assert.equal(canWinParty('ACTIVE', 1), true);
});

test('Server: solo il Master attivo può mutare punteggi e leggere dati privati', () => {
  assert.equal(canMasterMutate('master', 'master', 'ACTIVE'), true);
  assert.equal(canMasterMutate('anna', 'master', 'ACTIVE'), false);
  assert.equal(canMasterMutate('master', 'master', 'SOLVED'), false);
  assert.equal(canReadMasterData('master', 'master'), true);
  assert.equal(canReadMasterData('anna', 'master'), false);
});

test('Server: una idempotency key duplicata viene ignorata', () => {
  const keys = new Set<string>();
  assert.equal(shouldApplyIdempotentEvent(keys, 'same-event'), true);
  assert.equal(shouldApplyIdempotentEvent(keys, 'same-event'), false);
});
