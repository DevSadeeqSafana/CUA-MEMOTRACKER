-- Approver group: senior officers who, when approving a memo, may choose to
-- send it straight to the Accountant for processing.
-- Added at 2026-09-25

CREATE TABLE IF NOT EXISTS memo_approver_group (
    user_id INT NOT NULL PRIMARY KEY,
    added_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES memo_system_users(id) ON DELETE CASCADE
);

-- Seed: VC Carl Adams (both accounts), DVC Rislan Kanya, Registrar Mani Ibrahim.
-- The COO is added from Settings > Approvers Settings.
INSERT IGNORE INTO memo_approver_group (user_id)
SELECT id FROM memo_system_users WHERE staff_id IN ('E0004', 'E0008', 'E0001', 'E0002');
