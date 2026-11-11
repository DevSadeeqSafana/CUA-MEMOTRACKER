-- Finance queue: beneficiary account details + automatic Payment Voucher (PV) numbers.
-- Safe to run more than once (every step checks before changing anything).
--
-- 1. memo_finance_processing gets bank_name, account_name, account_number.
-- 2. voucher_number becomes UNIQUE (NULLs allowed), so two memos can never share a PV.
-- 3. memo_voucher_sequences keeps one running counter per year for PV/CUA/<year>/<0001>.

SET @db := DATABASE();

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @db AND table_name = 'memo_finance_processing' AND column_name = 'bank_name') = 0,
  'ALTER TABLE memo_finance_processing ADD COLUMN bank_name VARCHAR(120) NULL AFTER voucher_number',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @db AND table_name = 'memo_finance_processing' AND column_name = 'account_name') = 0,
  'ALTER TABLE memo_finance_processing ADD COLUMN account_name VARCHAR(150) NULL AFTER bank_name',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @db AND table_name = 'memo_finance_processing' AND column_name = 'account_number') = 0,
  'ALTER TABLE memo_finance_processing ADD COLUMN account_number VARCHAR(20) NULL AFTER account_name',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.statistics
    WHERE table_schema = @db AND table_name = 'memo_finance_processing' AND index_name = 'uq_finance_voucher_number') = 0,
  'ALTER TABLE memo_finance_processing ADD UNIQUE INDEX uq_finance_voucher_number (voucher_number)',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS memo_voucher_sequences (
  year SMALLINT UNSIGNED NOT NULL PRIMARY KEY,
  last_number INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
