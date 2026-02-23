const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const path = require('path');
const crypto = require('crypto');

// Load environment variables from .env.local (in the root directory)
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
};

async function seedAdmin() {
    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log('Connected to database.');

        const username = 'System Administrator';
        const email = 'admin@cosmopolitan.edu.ng';
        const password = 'CUAAdmin2026!';
        const department = 'Directorate of ICT';
        const staffId = 'ADMIN001';
        const userUuid = crypto.randomUUID();

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // 1. Insert User
        // Note: Table name is memo_system_users as per schema.sql
        // Added uuid and staff_id as they are NOT NULL
        const [userResult] = await connection.execute(
            'INSERT IGNORE INTO memo_system_users (uuid, staff_id, username, email, password_hash, department) VALUES (?, ?, ?, ?, ?, ?)',
            [userUuid, staffId, username, email, passwordHash, department]
        );

        let userId;
        if (userResult.affectedRows === 0) {
            console.log('Admin user already exists or could not be created.');
            // Try to find the existing user id
            const [rows] = await connection.execute('SELECT id FROM memo_system_users WHERE email = ?', [email]);
            if (rows.length > 0) {
                userId = rows[0].id;
                console.log(`Found existing admin user with ID: ${userId}`);
            } else {
                throw new Error('Could not find existing admin user despite INSERT IGNORE conflict.');
            }
        } else {
            userId = userResult.insertId;
            console.log(`Created admin user with ID: ${userId}`);
        }

        // 2. Get Administrator role ID
        const [roleRows] = await connection.execute('SELECT id FROM roles WHERE name = "Administrator"');
        if (roleRows.length === 0) {
            throw new Error('Administrator role not found in database. Please run schema.sql first.');
        }
        const roleId = roleRows[0].id;

        // 3. Assign Role
        await connection.execute(
            'INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)',
            [userId, roleId]
        );

        console.log('--------------------------------------------------');
        console.log('UNIVERSITY PORTAL DEFAULT CREDENTIALS:');
        console.log(`Email:    ${email}`);
        console.log(`Password: ${password}`);
        console.log('Role:     Administrator');
        console.log('--------------------------------------------------');
        console.log('Please change your password after initial login!');

    } catch (error) {
        console.error('Error seeding admin:', error);
    } finally {
        if (connection) await connection.end();
    }
}

seedAdmin();
