import mysql from 'mysql2/promise';

const pool = (global as any).mysqlPool || mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'memo_tracker',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 30000,
});

if (process.env.NODE_ENV !== 'production') {
  (global as any).mysqlPool = pool;
}

export default pool;

export async function query(sql: string, params?: any[]) {
  try {
    const [results] = await pool.execute(sql, params || []);
    return results;
  } catch (error: any) {
    console.error('Database Query Error:', error.message);
    throw error;
  }
}
