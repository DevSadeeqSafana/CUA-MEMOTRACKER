-- Migration to support search-select recipients, CC/BCC, and VC logic
-- Added at 2026-05-05

-- 1. Update memo_recipients to support types (To, CC, BCC)
ALTER TABLE memo_recipients ADD COLUMN recipient_type ENUM('To', 'CC', 'BCC') DEFAULT 'To' AFTER recipient_id;

-- 2. Ensure 'Approval' is in memo_type (it should be, but let's be safe)
ALTER TABLE memos MODIFY COLUMN memo_type ENUM('Informational', 'Approval', 'Action') NOT NULL;

-- 3. Add VC role if not exists
INSERT IGNORE INTO roles (name, description) VALUES ('VC', 'Vice Chancellor - receives a copy of all processed memos');
