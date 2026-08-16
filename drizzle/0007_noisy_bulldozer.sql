CREATE TABLE `bot_reminders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskUid` varchar(65),
	`chatJid` varchar(191) NOT NULL,
	`senderJid` varchar(191) NOT NULL,
	`text` varchar(1000) NOT NULL,
	`status` enum('pending','sent','cancelled') NOT NULL DEFAULT 'pending',
	`dueAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bot_reminders_id` PRIMARY KEY(`id`),
	CONSTRAINT `bot_reminders_taskUid_unique` UNIQUE(`taskUid`)
);
