-- ─────────────────────────────────────────────────────────────────────────────
-- Memo Consultation / Forwarding System
-- Run this against your database to enable the dynamic memo forwarding feature.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS memo_consultations (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    memo_id         INT NOT NULL,
    from_user_id    INT NOT NULL,               -- who sent the forward/reply
    to_user_id      INT NOT NULL,               -- who received it
    message         TEXT NOT NULL,              -- the question / input / response text
    parent_id       INT NULL,                   -- NULL = top-level forward; NOT NULL = reply or sub-forward
    type            ENUM('Forward', 'Response') NOT NULL DEFAULT 'Forward',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (memo_id)        REFERENCES memos(id)             ON DELETE CASCADE,
    FOREIGN KEY (from_user_id)   REFERENCES memo_system_users(id),
    FOREIGN KEY (to_user_id)     REFERENCES memo_system_users(id),
    FOREIGN KEY (parent_id)      REFERENCES memo_consultations(id) ON DELETE CASCADE
);
