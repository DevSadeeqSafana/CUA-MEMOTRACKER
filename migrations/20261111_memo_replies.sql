-- Memo replies: a reviewer (line manager / approver / final approver, or a recipient
-- who has not acknowledged yet) can reply to the memo's creator before deciding.
-- Each conversation is private between the creator and one reviewer (thread_user_id).
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS memo_replies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  memo_id INT NOT NULL,
  thread_user_id INT NOT NULL,      -- the reviewer this conversation is with
  author_id INT NOT NULL,           -- who wrote this message (the reviewer or the creator)
  message TEXT NOT NULL,            -- sanitized rich text (HTML)
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_memo_replies_thread (memo_id, thread_user_id, created_at),
  CONSTRAINT fk_memo_replies_memo FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE,
  CONSTRAINT fk_memo_replies_thread_user FOREIGN KEY (thread_user_id) REFERENCES memo_system_users(id),
  CONSTRAINT fk_memo_replies_author FOREIGN KEY (author_id) REFERENCES memo_system_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
