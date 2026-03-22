/**
 * Central MySQL (IONOS) access layer.
 * Uses mysql2 connection pool + credentials from .env so secrets are never committed.
 */
const path = require('path');
// Load server/.env before reading DB_* (same path as index.js — keeps one source of truth for local deploys).
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mysql = require('mysql2/promise');

/**
 * Builds pool options from environment — required so host/user/password stay out of source control.
 */
function loadDbConfig() {
  const host = process.env.DB_HOST;
  const user = process.env.DB_USER;
  const database = process.env.DB_NAME;
  const password = process.env.DB_PASSWORD;
  if (!host || !user || database === undefined || database === '') {
    throw new Error(
      'Missing DB_* environment variables. Set DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (and optionally DB_PORT).'
    );
  }
  if (password === undefined) {
    throw new Error('DB_PASSWORD must be set in environment (can be empty string if your host allows it).');
  }
  return {
    host,
    user,
    password,
    database,
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    timezone: 'Z',
  };
}

// Single shared pool for all routes (required for concurrent API requests under load).
const pool = mysql.createPool(loadDbConfig());

/**
 * Verifies TCP + auth + DB selection without running migrations — call on process startup to fail fast.
 */
async function testConnection() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1 AS ok');
  } finally {
    conn.release();
  }
}

async function query(sql, params) {
  const [results] = await pool.execute(sql, params);
  return results;
}

async function init() {
  // Users: encrypted email in `email`, deterministic `email_hash` for lookups (see encryption.js).
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL, 
      email_hash VARCHAR(64) UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      stripe_customer_id VARCHAR(255),
      stripe_subscription_id VARCHAR(255),
      plan VARCHAR(50),
      failed_attempts INT DEFAULT 0,
      lockout_until DATETIME NULL,
      reset_token VARCHAR(255),
      reset_token_expires DATETIME NULL,
      is_verified TINYINT DEFAULT 0,
      verification_token VARCHAR(255)
    ) ENGINE=InnoDB;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS purchases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      spot_uid VARCHAR(255) NOT NULL,
      unlocked TINYINT DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_spot (user_id, spot_uid)
    ) ENGINE=InnoDB;
  `);

  await pool.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      type VARCHAR(50) NOT NULL,
      is_read TINYINT DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB;
  `);
}

/** Maps `lieux` rows to the shape expected by unlock.js / map UI (unchanged API contract). */
async function getLocationsFromDb() {
  try {
    const rows = await query('SELECT * FROM lieux');
    return rows.map((row) => ({
      id: row.id,
      uid: row.uid || String(row.id),
      name: row.titre || row.nom || `Lieu #${row.id}`,
      lat: Number(row.latitude),
      lng: Number(row.longitude),
      type: row.type || 'Exploration',
      stars: Number(row.etoiles || 3),
      description: row.description || '',
      accessibility: row.accessibilite || 'Facile',
      image: row.image || '',
      locked: true,
    }));
  } catch (error) {
    console.error('Error fetching locations from DB:', error.message);
    return [];
  }
}

module.exports = {
  pool,
  testConnection,
  query,
  init,
  getLocationsFromDb,
};
