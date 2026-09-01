import { integer, sqliteTable, text, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const rooms = sqliteTable(
  'rooms',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    hostPlayerId: text('host_player_id'),
    mode: text('mode').notNull().default('COMPETITIVE'),
    status: text('status').notNull().default('LOBBY'),
    cycleCount: integer('cycle_count').notNull().default(1),
    roundNumber: integer('round_number').notNull().default(0),
    masterPlayerId: text('master_player_id'),
    winnerPlayerId: text('winner_player_id'),
    teamScore: integer('team_score').notNull().default(100),
    revealedHintCount: integer('revealed_hint_count').notNull().default(0),
    settingsJson: text('settings_json').notNull(),
    lastEventText: text('last_event_text'),
    lastEventAt: integer('last_event_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [uniqueIndex('idx_rooms_code').on(table.code), index('idx_rooms_status').on(table.status)],
);

export const players = sqliteTable(
  'players',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
    sessionToken: text('session_token').notNull(),
    nickname: text('nickname').notNull(),
    score: integer('score').notNull().default(0),
    masterOrder: integer('master_order').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    yesCount: integer('yes_count').notNull().default(0),
    irrelevantCount: integer('irrelevant_count').notNull().default(0),
    framesCount: integer('frames_count').notNull().default(0),
    solvedCount: integer('solved_count').notNull().default(0),
    intuitionBonus: integer('intuition_bonus').notNull().default(0),
    joinedAt: integer('joined_at').notNull(),
    lastSeenAt: integer('last_seen_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_players_session_token').on(table.sessionToken),
    index('idx_players_room_order').on(table.roomId, table.masterOrder),
  ],
);

export const roundFrames = sqliteTable(
  'round_frames',
  {
    id: text('id').primaryKey(),
    roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    frameIndex: integer('frame_index').notNull(),
    discovered: integer('discovered', { mode: 'boolean' }).notNull().default(false),
    discoveredBy: text('discovered_by'),
    discoveredAt: integer('discovered_at'),
  },
  (table) => [uniqueIndex('idx_round_frames_unique').on(table.roomId, table.roundNumber, table.frameIndex)],
);

export const scoreEvents = sqliteTable(
  'score_events',
  {
    id: text('id').primaryKey(),
    idempotencyKey: text('idempotency_key').notNull(),
    roomId: text('room_id').notNull().references(() => rooms.id, { onDelete: 'cascade' }),
    roundNumber: integer('round_number').notNull(),
    playerId: text('player_id'),
    eventType: text('event_type').notNull(),
    pointsDelta: integer('points_delta').notNull(),
    createdBy: text('created_by').notNull(),
    metadataJson: text('metadata_json'),
    undone: integer('undone', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_score_events_idempotency').on(table.idempotencyKey),
    index('idx_score_events_room_round').on(table.roomId, table.roundNumber, table.createdAt),
  ],
);
