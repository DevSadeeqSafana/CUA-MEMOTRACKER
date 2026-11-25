-- Email-style memo replies: each reply has its own To / CC / BCC recipients and can
-- answer an earlier reply (parent_id), so replies form threads like an email inbox.
-- The old one-to-one "thread_user_id" column is kept but no longer required.
-- Safe to run more than once.

SET @db := DATABASE();

-- 1. parent_id: the reply this message answers (NULL = reply to the memo itself)
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @db AND table_name = 'memo_replies' AND column_name = 'parent_id') = 0,
  'ALTER TABLE memo_replies ADD COLUMN parent_id INT NULL AFTER memo_id, ADD KEY idx_memo_replies_parent (parent_id), ADD CONSTRAINT fk_memo_replies_parent FOREIGN KEY (parent_id) REFERENCES memo_replies(id) ON DELETE CASCADE',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. thread_user_id becomes optional (recipients now live in memo_reply_recipients)
SET @sql := IF(
  (SELECT IS_NULLABLE FROM information_schema.columns
    WHERE table_schema = @db AND table_name = 'memo_replies' AND column_name = 'thread_user_id') = 'NO',
  'ALTER TABLE memo_replies MODIFY COLUMN thread_user_id INT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Recipients of each reply. BCC recipients are visible only to the author and themselves.
CREATE TABLE IF NOT EXISTS memo_reply_recipients (
  reply_id INT NOT NULL,
  user_id INT NOT NULL,
  recipient_type ENUM('To', 'CC', 'BCC') NOT NULL DEFAULT 'To',
  read_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (reply_id, user_id),
  KEY idx_reply_recipients_user (user_id, read_at),
  CONSTRAINT fk_reply_recipients_reply FOREIGN KEY (reply_id) REFERENCES memo_replies(id) ON DELETE CASCADE,
  CONSTRAINT fk_reply_recipients_user FOREIGN KEY (user_id) REFERENCES memo_system_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- 4. Convert replies written in the old one-to-one format. Each old message went
--    between the memo's creator and one reviewer (thread_user_id):
--    reviewer -> creator, or creator -> reviewer. Make that person its "To" recipient.
INSERT IGNORE INTO memo_reply_recipients (reply_id, user_id, recipient_type)
SELECT r.id, IF(r.author_id = m.created_by, r.thread_user_id, m.created_by), 'To'
FROM memo_replies r
JOIN memos m ON m.id = r.memo_id
WHERE r.thread_user_id IS NOT NULL
  AND IF(r.author_id = m.created_by, r.thread_user_id, m.created_by) <> r.author_id
  AND NOT EXISTS (SELECT 1 FROM memo_reply_recipients x WHERE x.reply_id = r.id);

--    Thread each old conversation: every message answers the one before it.
UPDATE memo_replies r
JOIN (
  SELECT id, LAG(id) OVER (PARTITION BY memo_id, thread_user_id ORDER BY created_at, id) AS prev_id
  FROM memo_replies WHERE thread_user_id IS NOT NULL
) t ON t.id = r.id
SET r.parent_id = t.prev_id
WHERE r.parent_id IS NULL AND t.prev_id IS NOT NULL;
