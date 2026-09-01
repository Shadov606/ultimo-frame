CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`session_token` text NOT NULL,
	`nickname` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`master_order` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`yes_count` integer DEFAULT 0 NOT NULL,
	`irrelevant_count` integer DEFAULT 0 NOT NULL,
	`frames_count` integer DEFAULT 0 NOT NULL,
	`solved_count` integer DEFAULT 0 NOT NULL,
	`intuition_bonus` integer DEFAULT 0 NOT NULL,
	`joined_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_players_session_token` ON `players` (`session_token`);--> statement-breakpoint
CREATE INDEX `idx_players_room_order` ON `players` (`room_id`,`master_order`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`host_player_id` text,
	`mode` text DEFAULT 'COMPETITIVE' NOT NULL,
	`status` text DEFAULT 'LOBBY' NOT NULL,
	`cycle_count` integer DEFAULT 1 NOT NULL,
	`round_number` integer DEFAULT 0 NOT NULL,
	`master_player_id` text,
	`winner_player_id` text,
	`team_score` integer DEFAULT 100 NOT NULL,
	`revealed_hint_count` integer DEFAULT 0 NOT NULL,
	`settings_json` text NOT NULL,
	`last_event_text` text,
	`last_event_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_rooms_code` ON `rooms` (`code`);--> statement-breakpoint
CREATE INDEX `idx_rooms_status` ON `rooms` (`status`);--> statement-breakpoint
CREATE TABLE `round_frames` (
	`id` text PRIMARY KEY NOT NULL,
	`room_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`frame_index` integer NOT NULL,
	`discovered` integer DEFAULT false NOT NULL,
	`discovered_by` text,
	`discovered_at` integer,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_round_frames_unique` ON `round_frames` (`room_id`,`round_number`,`frame_index`);--> statement-breakpoint
CREATE TABLE `score_events` (
	`id` text PRIMARY KEY NOT NULL,
	`idempotency_key` text NOT NULL,
	`room_id` text NOT NULL,
	`round_number` integer NOT NULL,
	`player_id` text,
	`event_type` text NOT NULL,
	`points_delta` integer NOT NULL,
	`created_by` text NOT NULL,
	`metadata_json` text,
	`undone` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_score_events_idempotency` ON `score_events` (`idempotency_key`);--> statement-breakpoint
CREATE INDEX `idx_score_events_room_round` ON `score_events` (`room_id`,`round_number`,`created_at`);--> statement-breakpoint
PRAGMA optimize;
