-- Internal Memo Tracker System (IMTS) - Database Schema

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE, -- 'Memo Creator', 'Line Manager', 'Reviewer', 'Recipient', 'Administrator'
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Memo System Users table (Link to hr_staff)
CREATE TABLE IF NOT EXISTS memo_system_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    staff_id VARCHAR(50) NOT NULL UNIQUE, -- StaffID from hr_staff
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(150) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    department VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- User Roles mapping
CREATE TABLE IF NOT EXISTS user_roles (
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES memo_system_users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

-- Memos table
CREATE TABLE IF NOT EXISTS memos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    reference_number VARCHAR(50) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    department VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    priority ENUM('Low', 'Medium', 'High') DEFAULT 'Medium',
    memo_type ENUM('Informational', 'Approval', 'Action') NOT NULL,
    status ENUM('Draft', 'Line Manager Review', 'Reviewer Approval', 'Distributed', 'Archived') DEFAULT 'Draft',
    expiry_date DATE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES memo_system_users(id)
);

-- Memo Approvals table (Sequential)
CREATE TABLE IF NOT EXISTS memo_approvals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    memo_id INT NOT NULL,
    approver_id INT NOT NULL,
    step_order INT NOT NULL, -- To enforce sequential approval
    status ENUM('Pending', 'Approved', 'Rejected') DEFAULT 'Pending',
    comments TEXT,
    processed_at TIMESTAMP NULL,
    FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE,
    FOREIGN KEY (approver_id) REFERENCES memo_system_users(id)
);

-- Memo Recipients table
CREATE TABLE IF NOT EXISTS memo_recipients (
    memo_id INT NOT NULL,
    recipient_id INT NOT NULL,
    read_at TIMESTAMP NULL,
    acknowledged_at TIMESTAMP NULL,
    action_completed_at TIMESTAMP NULL,
    PRIMARY KEY (memo_id, recipient_id),
    FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES memo_system_users(id)
);

-- Attachments table (if needed)
CREATE TABLE IF NOT EXISTS attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    memo_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size INT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE CASCADE
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    memo_id INT,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES memo_system_users(id) ON DELETE CASCADE,
    FOREIGN KEY (memo_id) REFERENCES memos(id) ON DELETE SET NULL
);

-- Audit Logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(50),
    record_id INT,
    old_value JSON,
    new_value JSON,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES memo_system_users(id)
);

-- Seed basic roles
INSERT IGNORE INTO roles (name, description) VALUES 
('Memo Creator', 'Can create and submit memos'),
('Line Manager', 'Reviews and approves memos from their department'),
('Reviewer', 'Specific reviewers for approval-based memos'),
('Recipient', 'Standard recipient of internal memos'),
('Administrator', 'Full system access and reporting');
