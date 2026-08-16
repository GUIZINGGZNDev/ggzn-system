ALTER TABLE `bot_groups` MODIFY COLUMN `rules` varchar(16383) NOT NULL DEFAULT '[]';--> statement-breakpoint
ALTER TABLE `bot_groups` MODIFY COLUMN `autoReplies` varchar(16383) NOT NULL DEFAULT '[]';