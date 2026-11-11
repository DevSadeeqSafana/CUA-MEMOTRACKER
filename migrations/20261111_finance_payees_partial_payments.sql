-- Finance queue: payee details + part payments.
-- Example: a memo asks the university to pay a vendor NGN 700,000; the university
-- pays 400,000 now (one payment, one PV) and 300,000 later (another payment, another PV).
-- Safe to run more than once.

SET @db := DATABASE();

-- 1. Payee (vendor / company / organisation) and the total amount owed
SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @db AND table_name = 'memo_finance_processing' AND column_name = 'payee_name') = 0,
  'ALTER TABLE memo_finance_processing ADD COLUMN payee_name VARCHAR(200) NULL AFTER voucher_number',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @db AND table_name = 'memo_finance_processing' AND column_name = 'payee_address') = 0,
  'ALTER TABLE memo_finance_processing ADD COLUMN payee_address VARCHAR(500) NULL AFTER payee_name',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @sql := IF(
  (SELECT COUNT(*) FROM information_schema.columns
    WHERE table_schema = @db AND table_name = 'memo_finance_processing' AND column_name = 'total_amount') = 0,
  'ALTER TABLE memo_finance_processing ADD COLUMN total_amount DECIMAL(15,2) NULL AFTER payee_address',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. New automatic status for memos paid in part
SET @sql := IF(
  (SELECT COLUMN_TYPE FROM information_schema.columns
    WHERE table_schema = @db AND table_name = 'memo_finance_processing' AND column_name = 'status') NOT LIKE '%Partially Paid%',
  'ALTER TABLE memo_finance_processing MODIFY COLUMN status ENUM(''Pending Processing'',''In Progress'',''Partially Paid'',''Processed'',''Rejected'') DEFAULT ''Pending Processing''',
  'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. One row per payment made against a memo (each gets its own PV number)
CREATE TABLE IF NOT EXISTS memo_finance_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  processing_id INT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  voucher_number VARCHAR(100) NOT NULL,
  payment_note VARCHAR(500) NULL,
  recorded_by INT NOT NULL,
  paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_finance_payment_voucher (voucher_number),
  KEY idx_finance_payments_processing (processing_id, paid_at),
  CONSTRAINT fk_finance_payments_processing FOREIGN KEY (processing_id) REFERENCES memo_finance_processing(id) ON DELETE CASCADE,
  CONSTRAINT fk_finance_payments_recorded_by FOREIGN KEY (recorded_by) REFERENCES memo_system_users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
