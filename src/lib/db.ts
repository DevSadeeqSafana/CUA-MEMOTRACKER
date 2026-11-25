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
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  // The database is far from the app (~260 ms per round trip) and a new connection
  // costs ~2 s to open, so keep idle connections around for 5 minutes instead of 1.
  maxIdle: 10,
  idleTimeout: 300000,
  // The link to the database is slow for anything but tiny responses (measured: a 64 KB
  // result took 4.6 s uncompressed, 0.3 s compressed), so compress traffic both ways.
  compress: true,
});

if (process.env.NODE_ENV !== 'production') {
  (global as any).mysqlPool = pool;
}

export default pool;

export async function query(sql: string, params?: any[]) {
  try {
    // Text protocol (pool.query) with client-side escaping: one round trip per query.
    // pool.execute uses server-side prepared statements, which cost an extra
    // round trip the first time each statement runs on a connection.
    const [results] = await pool.query(sql, params || []);
    return results;
  } catch (error: any) {
    console.error('Database Query Error:', error.message);
    throw error;
  }
}
