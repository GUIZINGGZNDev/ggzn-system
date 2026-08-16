CREATE TABLE `bot_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jid` varchar(191) NOT NULL,
	`name` varchar(191) NOT NULL DEFAULT 'Grupo sem nome',
	`activePrefix` varchar(8) NOT NULL DEFAULT '!',
	`prefixes` text NOT NULL DEFAULT ('! ,/ ,# ,.'),
	`disabledCommands` text NOT NULL DEFAULT ('[]'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bot_groups_id` PRIMARY KEY(`id`),
	CONSTRAINT `bot_groups_jid_unique` UNIQUE(`jid`)
);
--> statement-breakpoint
CREATE TABLE `bot_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupJid` varchar(191) NOT NULL,
	`userJid` varchar(191) NOT NULL,
	`role` enum('owner','admin','moderator','member') NOT NULL DEFAULT 'member',
	`displayName` varchar(191),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bot_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bot_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(32) NOT NULL,
	`status` enum('disconnected','connecting','connected','needs_pairing') NOT NULL DEFAULT 'disconnected',
	`lastConnectedAt` timestamp,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bot_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `bot_sessions_phone_unique` UNIQUE(`phone`)
);
