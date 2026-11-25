-- Vendor Management in the Memo Application.
-- Vendors live in the Staff Portal's existing inventory_vendor table, so both systems
-- share one vendor list. This adds bank details and an active flag to that table, and
-- links memos and finance records to a vendor.
-- Only nullable columns are added, so the Staff Portal keeps working unchanged.
-- Safe to run more than once.

SET @db := DATABASE();

-- 1. Vendor bank details (used to pre-fill the Accountant's payment form) and an active flag
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @db AND table_name = 'inventory_vendor' AND column_name = 'bank_name') = 0,
  'ALTER TABLE inventory_vendor ADD COLUMN bank_name VARCHAR(120) NULL, ADD COLUMN account_name VARCHAR(150) NULL, ADD COLUMN account_number VARCHAR(20) NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @db AND table_name = 'inventory_vendor' AND column_name = 'is_active') = 0,
  'ALTER TABLE inventory_vendor ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. The vendor a memo concerns (chosen on the memo form)
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @db AND table_name = 'memos' AND column_name = 'vendor_id') = 0,
  'ALTER TABLE memos ADD COLUMN vendor_id INT NULL, ADD KEY idx_memos_vendor (vendor_id), ADD CONSTRAINT fk_memos_vendor FOREIGN KEY (vendor_id) REFERENCES inventory_vendor(vendor_id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. The vendor the Accountant actually pays (may differ from the memo's vendor)
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @db AND table_name = 'memo_finance_processing' AND column_name = 'vendor_id') = 0,
  'ALTER TABLE memo_finance_processing ADD COLUMN vendor_id INT NULL AFTER voucher_number, ADD KEY idx_finance_vendor (vendor_id), ADD CONSTRAINT fk_finance_vendor FOREIGN KEY (vendor_id) REFERENCES inventory_vendor(vendor_id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
