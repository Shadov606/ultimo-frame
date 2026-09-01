import { env } from 'cloudflare:workers';
import { getCaseForRound, getCasesForSettings } from '@/server/cases';
import { partyScoreAfter, solutionAward } from '@/server/rules';

export const runtime = 'edge';

type Settings = {
  yesPoints: number;
  irrelevantPoints: number;
  framePoints: number;
  solutionPoints: number;
  earlyFrameBonus: number;
  teamStart: number;
  cycleCount: number;
  categories: string[];
  difficulties: string[];
  audio: boolean;
};

type RoomRow = {
  id: string;
  code: string;
  host_player_id: string;
  mode: 'COMPETITIVE' | 'PARTY';
  status: string;
  cycle_count: number;
  round_number: number;
  master_player_id: string | null;
  winner_player_id: string | null;
  team_score: number;
  revealed_hint_count: number;
  settings_json: string;
  last_event_text: string | null;
  last_event_at: number | null;
  created_at: number;
  updated_at: number;
};

type PlayerRow = {
  id: string;
  room_id: string;
  session_token: string;
  nickname: string;
  score: number;
  master_order: number;
  active: number;
  yes_count: number;
  irrelevant_count: number;
  frames_count: number;
  solved_count: number;
  intuition_bonus: number;
  joined_at: number;
  last_seen_at: number;
};

type FrameRow = {
  id: string;
  frame_index: number;
  discovered: number;
  discovered_by: string | null;
  discovered_at: number | null;
};

const DEFAULT_SETTINGS: Settings = {
  yesPoints: 10,
  irrelevantPoints: -5,
  framePoints: 30,
  solutionPoints: 100,
  earlyFrameBonus: 25,
  teamStart: 100,
  cycleCount: 1,
  categories: ['MIX'],
  difficulties: ['MIX'],
  audio: true,
};

function db() {
  if (!env.DB) throw new Error('Database non disponibile');
  return env.DB;
}

function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function fail(message: string, status = 400) {
  return json({ error: message }, status);
}

function cleanName(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 22);
}

function cleanCode(value: unknown) {
  return String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
}

function validToken(value: unknown) {
  const token = String(value ?? '');
  return token.length >= 16 && token.length <= 100 ? token : '';
}

function settingsOf(room: RoomRow): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(room.settings_json) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function id() {
  return crypto.randomUUID();
}

function clampInt(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, Math.round(number))) : fallback;
}

async function createRoom(body: Record<string, unknown>) {
  const nickname = cleanName(body.nickname);
  const sessionToken = validToken(body.sessionToken);
  const mode = body.mode === 'PARTY' ? 'PARTY' : 'COMPETITIVE';
  if (nickname.length < 2) return fail('Inserisci un nickname di almeno 2 caratteri.');
  if (!sessionToken) return fail('Sessione non valida.');

  let code = '';
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 12; attempt += 1) {
    code = Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    const found = await db().prepare('SELECT id FROM rooms WHERE code = ?').bind(code).first();
    if (!found) break;
  }

  const now = Date.now();
  const roomId = id();
  const playerId = id();
  const settings = { ...DEFAULT_SETTINGS };
  await db().batch([
    db().prepare(`INSERT INTO rooms
      (id, code, host_player_id, mode, status, cycle_count, round_number, team_score, revealed_hint_count, settings_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'LOBBY', 1, 0, 100, 0, ?, ?, ?)`)
      .bind(roomId, code, playerId, mode, JSON.stringify(settings), now, now),
    db().prepare(`INSERT INTO players
      (id, room_id, session_token, nickname, score, master_order, active, yes_count, irrelevant_count, frames_count, solved_count, intuition_bonus, joined_at, last_seen_at)
      VALUES (?, ?, ?, ?, 0, 0, 1, 0, 0, 0, 0, 0, ?, ?)`)
      .bind(playerId, roomId, sessionToken, nickname, now, now),
  ]);
  return json({ code, playerId });
}

async function joinRoom(body: Record<string, unknown>) {
  const nickname = cleanName(body.nickname);
  const sessionToken = validToken(body.sessionToken);
  const code = cleanCode(body.code);
  if (nickname.length < 2 || code.length !== 5 || !sessionToken) return fail('Controlla nickname e codice stanza.');

  const room = await db().prepare('SELECT * FROM rooms WHERE code = ?').bind(code).first<RoomRow>();
  if (!room) return fail('Stanza non trovata.', 404);

  const existing = await db().prepare('SELECT * FROM players WHERE session_token = ?').bind(sessionToken).first<PlayerRow>();
  if (existing) {
    if (existing.room_id !== room.id) return fail('Questa sessione appartiene già a un’altra stanza.');
    return json({ code, playerId: existing.id });
  }
  if (room.status !== 'LOBBY') return fail('Partita già in corso.', 409);
  const players = await db().prepare('SELECT * FROM players WHERE room_id = ? AND active = 1 ORDER BY master_order').bind(room.id).all<PlayerRow>();
  if (players.results.length >= 6) return fail('La stanza è piena.', 409);
  if (players.results.some((player) => player.nickname.toLowerCase() === nickname.toLowerCase())) return fail('Questo nickname è già in uso.');

  const now = Date.now();
  const playerId = id();
  await db().prepare(`INSERT INTO players
    (id, room_id, session_token, nickname, score, master_order, active, yes_count, irrelevant_count, frames_count, solved_count, intuition_bonus, joined_at, last_seen_at)
    VALUES (?, ?, ?, ?, 0, ?, 1, 0, 0, 0, 0, 0, ?, ?)`)
    .bind(playerId, room.id, sessionToken, nickname, players.results.length, now, now).run();
  return json({ code, playerId });
}

async function context(code: string, token: string, touch = true) {
  const room = await db().prepare('SELECT * FROM rooms WHERE code = ?').bind(code).first<RoomRow>();
  if (!room) return null;
  const player = await db().prepare('SELECT * FROM players WHERE room_id = ? AND session_token = ? AND active = 1').bind(room.id, token).first<PlayerRow>();
  if (!player) return null;
  if (touch) await db().prepare('UPDATE players SET last_seen_at = ? WHERE id = ?').bind(Date.now(), player.id).run();
  const players = await db().prepare('SELECT * FROM players WHERE room_id = ? AND active = 1 ORDER BY master_order').bind(room.id).all<PlayerRow>();
  return { room, player, players: players.results };
}

async function readState(code: string, token: string, masterView: boolean) {
  const ctx = await context(code, token);
  if (!ctx) return fail('Sessione o stanza non valida.', 401);
  const { room, player, players } = ctx;
  if (masterView && room.master_player_id !== player.id) return fail('Solo il Master può leggere soluzione, Frame e indizi.', 403);
  const settings = settingsOf(room);
  const mystery = getCaseForRound(room.round_number, settings);
  const frameRows = room.status === 'LOBBY' || room.status === 'FINISHED'
    ? []
    : (await db().prepare('SELECT * FROM round_frames WHERE room_id = ? AND round_number = ? ORDER BY frame_index')
      .bind(room.id, room.round_number).all<FrameRow>()).results;
  const nicknameById = new Map(players.map((item) => [item.id, item.nickname]));
  const showSolution = ['SOLVED', 'REVEALED'].includes(room.status);
  const connectedAfter = Date.now() - 20_000;
  const totalRounds = players.length * room.cycle_count;

  const state: Record<string, unknown> = {
    room: {
      code: room.code,
      mode: room.mode,
      status: room.status,
      cycleCount: room.cycle_count,
      roundNumber: room.round_number,
      totalRounds,
      teamScore: room.team_score,
      hostPlayerId: room.host_player_id,
      masterPlayerId: room.master_player_id,
      winnerPlayerId: room.winner_player_id,
      revealedHintCount: room.revealed_hint_count,
      lastEventText: room.last_event_text,
      lastEventAt: room.last_event_at,
      settings,
    },
    me: { id: player.id, nickname: player.nickname, isHost: room.host_player_id === player.id, isMaster: room.master_player_id === player.id },
    players: players.map((item) => ({
      id: item.id,
      nickname: item.nickname,
      score: item.score,
      masterOrder: item.master_order,
      connected: item.last_seen_at >= connectedAfter,
      stats: { yes: item.yes_count, irrelevant: item.irrelevant_count, frames: item.frames_count, solved: item.solved_count, intuitionBonus: item.intuition_bonus },
    })),
    case: room.status === 'LOBBY' || room.status === 'FINISHED' ? null : {
      title: mystery.title,
      category: mystery.category,
      difficulty: mystery.difficulty,
      publicStory: mystery.publicStory,
      totalFrames: mystery.frames.length,
      foundFrames: frameRows.filter((frame) => Boolean(frame.discovered)).length,
      ...(showSolution ? {
        solution: mystery.solution,
        frames: mystery.frames.map((text, index) => ({
          text,
          discovered: Boolean(frameRows.find((frame) => frame.frame_index === index)?.discovered),
          discoveredBy: nicknameById.get(frameRows.find((frame) => frame.frame_index === index)?.discovered_by ?? '') ?? null,
        })),
      } : {}),
    },
  };

  if (masterView) {
    state.master = {
      solution: mystery.solution,
      frames: mystery.frames.map((text, index) => {
        const row = frameRows.find((frame) => frame.frame_index === index);
        return { index, text, discovered: Boolean(row?.discovered), discoveredBy: row?.discovered_by ?? null };
      }),
      hints: mystery.hints.slice(0, Math.min(mystery.hints.length, room.revealed_hint_count + 1)).map((hint, index) => ({
        index,
        text: hint.text,
        penalty: room.mode === 'PARTY' ? hint.partyPenalty : hint.competitivePenalty,
        used: index < room.revealed_hint_count,
        available: index === room.revealed_hint_count,
      })),
    };
  }
  return json(state);
}

async function requireContext(body: Record<string, unknown>) {
  const code = cleanCode(body.code);
  const token = validToken(body.sessionToken);
  if (!code || !token) return null;
  return context(code, token, false);
}

function hostOnly(ctx: NonNullable<Awaited<ReturnType<typeof requireContext>>>) {
  return ctx.room.host_player_id === ctx.player.id;
}

function masterOnly(ctx: NonNullable<Awaited<ReturnType<typeof requireContext>>>) {
  return ctx.room.master_player_id === ctx.player.id;
}

function targetPlayer(ctx: NonNullable<Awaited<ReturnType<typeof requireContext>>>, value: unknown) {
  return ctx.players.find((player) => player.id === value && player.active && player.id !== ctx.room.master_player_id);
}

async function saveSettings(ctx: NonNullable<Awaited<ReturnType<typeof requireContext>>>, body: Record<string, unknown>) {
  if (!hostOnly(ctx) || ctx.room.status !== 'LOBBY') return fail('Solo l’Host può modificare una lobby aperta.', 403);
  const current = settingsOf(ctx.room);
  const categoriesAllowed = ['MIX', 'DARK', 'ASSURDO', 'RELATIONSHIP', 'SOCIAL', 'ONLINE', 'CRIME', 'MIND', 'PARANORMAL', 'TRASH'];
  const difficultiesAllowed = ['MIX', 'FACILE', 'MEDIO', 'DIFFICILE', 'ESTREMO'];
  const settings: Settings = {
    yesPoints: clampInt(body.yesPoints, 0, 100, current.yesPoints),
    irrelevantPoints: -clampInt(Math.abs(Number(body.irrelevantPoints)), 0, 100, Math.abs(current.irrelevantPoints)),
    framePoints: clampInt(body.framePoints, 0, 200, current.framePoints),
    solutionPoints: clampInt(body.solutionPoints, 10, 500, current.solutionPoints),
    earlyFrameBonus: clampInt(body.earlyFrameBonus, 0, 200, current.earlyFrameBonus),
    teamStart: clampInt(body.teamStart, 10, 500, current.teamStart),
    cycleCount: clampInt(body.cycleCount, 1, 2, current.cycleCount),
    categories: Array.isArray(body.categories) ? body.categories.map(String).filter((value) => categoriesAllowed.includes(value)).slice(0, 4) : current.categories,
    difficulties: Array.isArray(body.difficulties) ? body.difficulties.map(String).filter((value) => difficultiesAllowed.includes(value)).slice(0, 4) : current.difficulties,
    audio: body.audio !== false,
  };
  if (!settings.categories.length) settings.categories = ['MIX'];
  if (!settings.difficulties.length) settings.difficulties = ['MIX'];
  const mode = body.mode === 'PARTY' ? 'PARTY' : 'COMPETITIVE';
  await db().prepare('UPDATE rooms SET mode = ?, cycle_count = ?, settings_json = ?, team_score = ?, updated_at = ? WHERE id = ?')
    .bind(mode, settings.cycleCount, JSON.stringify(settings), settings.teamStart, Date.now(), ctx.room.id).run();
  return json({ ok: true });
}

async function startGame(ctx: NonNullable<Awaited<ReturnType<typeof requireContext>>>) {
  if (!hostOnly(ctx) || ctx.room.status !== 'LOBBY') return fail('Solo l’Host può iniziare la partita.', 403);
  if (ctx.players.length < 2) return fail('Servono almeno 2 giocatori.');
  const settings = settingsOf(ctx.room);
  const totalRounds = ctx.players.length * settings.cycleCount;
  const availableCases = getCasesForSettings(settings);
  if (availableCases.length < totalRounds) return fail(`Con questi filtri servono ${totalRounds} casi, ma ne sono disponibili ${availableCases.length}. Scegli Mix o riduci i cicli.`);
  const mystery = getCaseForRound(0, settings);
  const now = Date.now();
  const masterId = ctx.players[0].id;
  const operations = [
    db().prepare(`UPDATE rooms SET status = 'ACTIVE', round_number = 0, master_player_id = ?, winner_player_id = NULL,
      team_score = ?, revealed_hint_count = 0, last_event_text = 'Il caso è iniziato', last_event_at = ?, updated_at = ? WHERE id = ? AND status = 'LOBBY'`)
      .bind(masterId, settings.teamStart, now, now, ctx.room.id),
    ...mystery.frames.map((_, index) => db().prepare(`INSERT INTO round_frames
      (id, room_id, round_number, frame_index, discovered, discovered_by, discovered_at) VALUES (?, ?, 0, ?, 0, NULL, NULL)`)
      .bind(`${ctx.room.id}:0:${index}`, ctx.room.id, index)),
  ];
  await db().batch(operations);
  return json({ ok: true });
}

async function recordPlayerAction(ctx: NonNullable<Awaited<ReturnType<typeof requireContext>>>, body: Record<string, unknown>) {
  if (!masterOnly(ctx) || !['ACTIVE', 'ACTIVE_FUN'].includes(ctx.room.status)) return fail('Azione riservata al Master durante un round attivo.', 403);
  const target = targetPlayer(ctx, body.playerId);
  if (!target) return fail('Giocatore non valido.');
  const eventType = body.eventType === 'YES' ? 'YES' : body.eventType === 'IRRELEVANT' ? 'IRRELEVANT' : '';
  if (!eventType) return fail('Azione non valida.');
  const idempotencyKey = validToken(body.idempotencyKey);
  if (!idempotencyKey) return fail('Identificatore azione non valido.');
  const duplicate = await db().prepare('SELECT id FROM score_events WHERE idempotency_key = ?').bind(idempotencyKey).first();
  if (duplicate) return json({ ok: true, duplicate: true });
  const settings = settingsOf(ctx.room);
  const now = Date.now();

  if (eventType === 'YES') {
    if (ctx.room.mode === 'PARTY') return json({ ok: true });
    const delta = settings.yesPoints;
    await db().batch([
      db().prepare('UPDATE players SET score = score + ?, yes_count = yes_count + 1 WHERE id = ?').bind(delta, target.id),
      db().prepare(`INSERT INTO score_events (id, idempotency_key, room_id, round_number, player_id, event_type, points_delta, created_by, metadata_json, undone, created_at)
        VALUES (?, ?, ?, ?, ?, 'YES', ?, ?, NULL, 0, ?)`)
        .bind(id(), idempotencyKey, ctx.room.id, ctx.room.round_number, target.id, delta, ctx.player.id, now),
      db().prepare('UPDATE rooms SET last_event_text = ?, last_event_at = ?, updated_at = ? WHERE id = ?')
        .bind(`${target.nickname}: SÌ · +${delta}`, now, now, ctx.room.id),
    ]);
    return json({ ok: true });
  }

  const delta = settings.irrelevantPoints;
  if (ctx.room.mode === 'COMPETITIVE') {
    await db().batch([
      db().prepare('UPDATE players SET score = score + ?, irrelevant_count = irrelevant_count + 1 WHERE id = ?').bind(delta, target.id),
      db().prepare(`INSERT INTO score_events (id, idempotency_key, room_id, round_number, player_id, event_type, points_delta, created_by, metadata_json, undone, created_at)
        VALUES (?, ?, ?, ?, ?, 'IRRELEVANT', ?, ?, NULL, 0, ?)`)
        .bind(id(), idempotencyKey, ctx.room.id, ctx.room.round_number, target.id, delta, ctx.player.id, now),
      db().prepare('UPDATE rooms SET last_event_text = ?, last_event_at = ?, updated_at = ? WHERE id = ?')
        .bind(`${target.nickname}: IRRILEVANTE · ${delta}`, now, now, ctx.room.id),
    ]);
  } else {
    const nextScore = partyScoreAfter(ctx.room.team_score, Math.abs(delta));
    const nextStatus = nextScore === 0 ? 'LOST' : ctx.room.status;
    await db().batch([
      db().prepare('UPDATE players SET irrelevant_count = irrelevant_count + 1 WHERE id = ?').bind(target.id),
      db().prepare(`INSERT INTO score_events (id, idempotency_key, room_id, round_number, player_id, event_type, points_delta, created_by, metadata_json, undone, created_at)
        VALUES (?, ?, ?, ?, ?, 'IRRELEVANT', ?, ?, NULL, 0, ?)`)
        .bind(id(), idempotencyKey, ctx.room.id, ctx.room.round_number, target.id, delta, ctx.player.id, now),
      db().prepare('UPDATE rooms SET team_score = ?, status = ?, last_event_text = ?, last_event_at = ?, updated_at = ? WHERE id = ?')
        .bind(nextScore, nextStatus, `${target.nickname}: IRRILEVANTE · ${delta}`, now, now, ctx.room.id),
    ]);
  }
  return json({ ok: true });
}

async function discoverFrame(ctx: NonNullable<Awaited<ReturnType<typeof requireContext>>>, body: Record<string, unknown>) {
  if (!masterOnly(ctx) || !['ACTIVE', 'ACTIVE_FUN'].includes(ctx.room.status)) return fail('Azione riservata al Master.', 403);
  const target = targetPlayer(ctx, body.playerId);
  const frameIndex = Number(body.frameIndex);
  const idempotencyKey = validToken(body.idempotencyKey);
  const settings = settingsOf(ctx.room);
  const mystery = getCaseForRound(ctx.room.round_number, settings);
  if (!target || !Number.isInteger(frameIndex) || frameIndex < 0 || frameIndex >= mystery.frames.length || !idempotencyKey) return fail('Frame o giocatore non valido.');
  const duplicate = await db().prepare('SELECT id FROM score_events WHERE idempotency_key = ?').bind(idempotencyKey).first();
  if (duplicate) return json({ ok: true, duplicate: true });
  const now = Date.now();
  const claimed = await db().prepare(`UPDATE round_frames SET discovered = 1, discovered_by = ?, discovered_at = ?
    WHERE room_id = ? AND round_number = ? AND frame_index = ? AND discovered = 0`)
    .bind(target.id, now, ctx.room.id, ctx.room.round_number, frameIndex).run();
  if (!claimed.meta.changes) return fail('Questo Frame è già stato assegnato.', 409);
  const delta = ctx.room.mode === 'COMPETITIVE' ? settings.framePoints : 0;
  await db().batch([
    db().prepare('UPDATE players SET score = score + ?, frames_count = frames_count + 1 WHERE id = ?').bind(delta, target.id),
    db().prepare(`INSERT INTO score_events (id, idempotency_key, room_id, round_number, player_id, event_type, points_delta, created_by, metadata_json, undone, created_at)
      VALUES (?, ?, ?, ?, ?, 'FRAME', ?, ?, ?, 0, ?)`)
      .bind(id(), idempotencyKey, ctx.room.id, ctx.room.round_number, target.id, delta, ctx.player.id, JSON.stringify({ frameIndex }), now),
    db().prepare('UPDATE rooms SET last_event_text = ?, last_event_at = ?, updated_at = ? WHERE id = ?')
      .bind(`FRAME TROVATO da ${target.nickname}${delta ? ` · +${delta}` : ''}`, now, now, ctx.room.id),
  ]);
  return json({ ok: true });
}

async function useHint(ctx: NonNullable<Awaited<ReturnType<typeof requireContext>>>, body: Record<string, unknown>) {
  if (!masterOnly(ctx) || ctx.room.status !== 'ACTIVE') return fail('Solo il Master può usare un indizio durante il round.', 403);
  const idempotencyKey = validToken(body.idempotencyKey);
  if (!idempotencyKey) return fail('Identificatore azione non valido.');
  const duplicate = await db().prepare('SELECT id FROM score_events WHERE idempotency_key = ?').bind(idempotencyKey).first();
  if (duplicate) return json({ ok: true, duplicate: true });
  const settings = settingsOf(ctx.room);
  const mystery = getCaseForRound(ctx.room.round_number, settings);
  const hintIndex = ctx.room.revealed_hint_count;
  const hint = mystery.hints[hintIndex];
  if (!hint) return fail('Non ci sono altri indizi.');
  const penalty = ctx.room.mode === 'PARTY' ? hint.partyPenalty : hint.competitivePenalty;
  const now = Date.now();
  const eventId = id();
  const operations = [
    db().prepare(`INSERT INTO score_events (id, idempotency_key, room_id, round_number, player_id, event_type, points_delta, created_by, metadata_json, undone, created_at)
      VALUES (?, ?, ?, ?, NULL, 'HINT', ?, ?, ?, 0, ?)`)
      .bind(eventId, idempotencyKey, ctx.room.id, ctx.room.round_number, -penalty, ctx.player.id, JSON.stringify({ hintIndex }), now),
  ];
  if (ctx.room.mode === 'COMPETITIVE') {
    for (const investigator of ctx.players.filter((item) => item.id !== ctx.room.master_player_id)) {
      operations.push(db().prepare('UPDATE players SET score = score - ? WHERE id = ?').bind(penalty, investigator.id));
    }
    operations.push(db().prepare('UPDATE rooms SET revealed_hint_count = revealed_hint_count + 1, last_event_text = ?, last_event_at = ?, updated_at = ? WHERE id = ?')
      .bind(`INDIZIO UTILIZZATO · -${penalty} A TUTTI`, now, now, ctx.room.id));
  } else {
    const nextScore = partyScoreAfter(ctx.room.team_score, penalty);
    operations.push(db().prepare('UPDATE rooms SET team_score = ?, status = ?, revealed_hint_count = revealed_hint_count + 1, last_event_text = ?, last_event_at = ?, updated_at = ? WHERE id = ?')
      .bind(nextScore, nextScore === 0 ? 'LOST' : 'ACTIVE', `INDIZIO UTILIZZATO · -${penalty}`, now, now, ctx.room.id));
  }
  await db().batch(operations);
  return json({ ok: true, hint: hint.text, penalty });
}

async function solveRound(ctx: NonNullable<Awaited<ReturnType<typeof requireContext>>>, body: Record<string, unknown>) {
  if (!masterOnly(ctx) || ctx.room.status !== 'ACTIVE') return fail('Il round non può più essere risolto.', 409);
  const target = targetPlayer(ctx, body.playerId);
  const idempotencyKey = validToken(body.idempotencyKey);
  if (!target || !idempotencyKey) return fail('Giocatore o azione non validi.');
  const duplicate = await db().prepare('SELECT id FROM score_events WHERE idempotency_key = ?').bind(idempotencyKey).first();
  if (duplicate) return json({ ok: true, duplicate: true });
  const remaining = await db().prepare(`SELECT COUNT(*) AS count FROM round_frames
    WHERE room_id = ? AND round_number = ? AND discovered = 0`).bind(ctx.room.id, ctx.room.round_number).first<{ count: number }>();
  const remainingFrames = Number(remaining?.count ?? 0);
  const settings = settingsOf(ctx.room);
  const award = ctx.room.mode === 'COMPETITIVE'
    ? solutionAward(settings, remainingFrames)
    : { base: 0, bonus: 0, remainingFrames, total: 0 };
  const { base, bonus, total } = award;
  const now = Date.now();
  const closed = await db().prepare(`UPDATE rooms SET status = 'SOLVED', winner_player_id = ?, last_event_text = ?, last_event_at = ?, updated_at = ?
    WHERE id = ? AND status = 'ACTIVE' AND winner_player_id IS NULL`)
    .bind(target.id, `CASO RISOLTO DA ${target.nickname}${total ? ` · +${total}` : ''}`, now, now, ctx.room.id).run();
  if (!closed.meta.changes) return fail('Il caso è già stato chiuso.', 409);
  const operations = [
    db().prepare('UPDATE players SET score = score + ?, solved_count = solved_count + 1, intuition_bonus = intuition_bonus + ? WHERE id = ?').bind(total, bonus, target.id),
    db().prepare(`INSERT INTO score_events (id, idempotency_key, room_id, round_number, player_id, event_type, points_delta, created_by, metadata_json, undone, created_at)
      VALUES (?, ?, ?, ?, ?, 'SOLUTION', ?, ?, ?, 0, ?)`)
      .bind(id(), idempotencyKey, ctx.room.id, ctx.room.round_number, target.id, total, ctx.player.id, JSON.stringify({ base, bonus, remainingFrames }), now),
  ];
  await db().batch(operations);
  return json({ ok: true, award: { base, bonus, remainingFrames, total } });
}

async function undoLast(ctx: NonNullable<Awaited<ReturnType<typeof requireContext>>>) {
  if (!masterOnly(ctx) || !['ACTIVE', 'ACTIVE_FUN', 'LOST'].includes(ctx.room.status)) return fail('Non è possibile annullare ora.', 403);
  const event = await db().prepare(`SELECT * FROM score_events WHERE room_id = ? AND round_number = ? AND created_by = ? AND undone = 0
    AND event_type IN ('YES','IRRELEVANT','FRAME','HINT') ORDER BY created_at DESC LIMIT 1`)
    .bind(ctx.room.id, ctx.room.round_number, ctx.player.id).first<Record<string, unknown>>();
  if (!event) return fail('Nessuna azione da annullare.');
  const type = String(event.event_type);
  const delta = Number(event.points_delta);
  const playerId = event.player_id ? String(event.player_id) : null;
  const settings = settingsOf(ctx.room);
  const now = Date.now();
  const operations = [db().prepare('UPDATE score_events SET undone = 1 WHERE id = ? AND undone = 0').bind(String(event.id))];
  if (type === 'YES' && playerId) operations.push(db().prepare('UPDATE players SET score = score - ?, yes_count = MAX(0, yes_count - 1) WHERE id = ?').bind(delta, playerId));
  if (type === 'IRRELEVANT' && playerId) {
    operations.push(db().prepare('UPDATE players SET irrelevant_count = MAX(0, irrelevant_count - 1) WHERE id = ?').bind(playerId));
    if (ctx.room.mode === 'COMPETITIVE') operations.push(db().prepare('UPDATE players SET score = score - ? WHERE id = ?').bind(delta, playerId));
    else operations.push(db().prepare(`UPDATE rooms SET team_score = MIN(?, team_score - ?), status = CASE WHEN status = 'LOST' THEN 'ACTIVE' ELSE status END WHERE id = ?`).bind(settings.teamStart, delta, ctx.room.id));
  }
  if (type === 'FRAME' && playerId) {
    const meta = event.metadata_json ? JSON.parse(String(event.metadata_json)) : {};
    operations.push(db().prepare('UPDATE players SET score = score - ?, frames_count = MAX(0, frames_count - 1) WHERE id = ?').bind(delta, playerId));
    operations.push(db().prepare('UPDATE round_frames SET discovered = 0, discovered_by = NULL, discovered_at = NULL WHERE room_id = ? AND round_number = ? AND frame_index = ?').bind(ctx.room.id, ctx.room.round_number, Number(meta.frameIndex)));
  }
  if (type === 'HINT') {
    const penalty = Math.abs(delta);
    if (ctx.room.mode === 'COMPETITIVE') {
      for (const investigator of ctx.players.filter((item) => item.id !== ctx.room.master_player_id)) operations.push(db().prepare('UPDATE players SET score = score + ? WHERE id = ?').bind(penalty, investigator.id));
      operations.push(db().prepare('UPDATE rooms SET revealed_hint_count = MAX(0, revealed_hint_count - 1) WHERE id = ?').bind(ctx.room.id));
    } else {
      operations.push(db().prepare(`UPDATE rooms SET team_score = MIN(?, team_score + ?), revealed_hint_count = MAX(0, revealed_hint_count - 1), status = CASE WHEN status = 'LOST' THEN 'ACTIVE' ELSE status END WHERE id = ?`).bind(settings.teamStart, penalty, ctx.room.id));
    }
  }
  operations.push(db().prepare('UPDATE rooms SET last_event_text = ?, last_event_at = ?, updated_at = ? WHERE id = ?').bind('ULTIMA AZIONE ANNULLATA', now, now, ctx.room.id));
  await db().batch(operations);
  return json({ ok: true });
}

async function nextRound(ctx: NonNullable<Awaited<ReturnType<typeof requireContext>>>) {
  if (!hostOnly(ctx) || !['SOLVED', 'REVEALED'].includes(ctx.room.status)) return fail('Solo l’Host può passare al prossimo caso.', 403);
  const next = ctx.room.round_number + 1;
  const total = ctx.players.length * ctx.room.cycle_count;
  const now = Date.now();
  if (next >= total) {
    await db().prepare(`UPDATE rooms SET status = 'FINISHED', master_player_id = NULL, updated_at = ?, last_event_text = 'PARTITA COMPLETATA', last_event_at = ? WHERE id = ?`)
      .bind(now, now, ctx.room.id).run();
    return json({ ok: true, finished: true });
  }
  const settings = settingsOf(ctx.room);
  const mystery = getCaseForRound(next, settings);
  const masterId = ctx.players[next % ctx.players.length].id;
  const operations = [
    db().prepare(`UPDATE rooms SET status = 'ACTIVE', round_number = ?, master_player_id = ?, winner_player_id = NULL,
      team_score = ?, revealed_hint_count = 0, last_event_text = 'NUOVO CASO', last_event_at = ?, updated_at = ? WHERE id = ?`)
      .bind(next, masterId, settings.teamStart, now, now, ctx.room.id),
    ...mystery.frames.map((_, index) => db().prepare(`INSERT INTO round_frames
      (id, room_id, round_number, frame_index, discovered, discovered_by, discovered_at) VALUES (?, ?, ?, ?, 0, NULL, NULL)`)
      .bind(`${ctx.room.id}:${next}:${index}`, ctx.room.id, next, index)),
  ];
  await db().batch(operations);
  return json({ ok: true });
}

async function terminalAction(ctx: NonNullable<Awaited<ReturnType<typeof requireContext>>>, action: string) {
  if (!hostOnly(ctx) && !masterOnly(ctx)) return fail('Azione riservata a Host o Master.', 403);
  const now = Date.now();
  if (action === 'continue_fun' && ctx.room.status === 'LOST') {
    await db().prepare(`UPDATE rooms SET status = 'ACTIVE_FUN', last_event_text = 'CONTINUA PER DIVERTIMENTO', last_event_at = ?, updated_at = ? WHERE id = ? AND status = 'LOST'`).bind(now, now, ctx.room.id).run();
    return json({ ok: true });
  }
  if (action === 'show_solution' && ['LOST', 'ACTIVE_FUN', 'ACTIVE'].includes(ctx.room.status)) {
    await db().prepare(`UPDATE rooms SET status = 'REVEALED', last_event_text = 'SOLUZIONE RIVELATA', last_event_at = ?, updated_at = ? WHERE id = ?`).bind(now, now, ctx.room.id).run();
    return json({ ok: true });
  }
  return fail('Azione non disponibile.');
}

async function handleAction(body: Record<string, unknown>) {
  const ctx = await requireContext(body);
  if (!ctx) return fail('Sessione non valida.', 401);
  const action = String(body.action ?? '');
  if (action === 'settings') return saveSettings(ctx, body);
  if (action === 'start') return startGame(ctx);
  if (action === 'player_event') return recordPlayerAction(ctx, body);
  if (action === 'frame') return discoverFrame(ctx, body);
  if (action === 'hint') return useHint(ctx, body);
  if (action === 'solve') return solveRound(ctx, body);
  if (action === 'undo') return undoLast(ctx);
  if (action === 'next') return nextRound(ctx);
  if (action === 'continue_fun' || action === 'show_solution') return terminalAction(ctx, action);
  return fail('Azione sconosciuta.');
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return readState(cleanCode(url.searchParams.get('code')), validToken(url.searchParams.get('token')), url.searchParams.get('view') === 'master');
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('Richiesta non valida.');
  }
  if (body.action === 'create') return createRoom(body);
  if (body.action === 'join') return joinRoom(body);
  return handleAction(body);
}
