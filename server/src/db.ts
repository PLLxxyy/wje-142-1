import Database, { type Database as SqliteDatabase } from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(__dirname, '..', 'data', 'fire_inspection.db');

// Ensure data directory exists
import fs from 'fs';
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db: SqliteDatabase = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('inspector', 'responsible', 'admin')),
    display_name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    area TEXT NOT NULL,
    assigned_to INTEGER NOT NULL,
    scheduled_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'in_progress', 'completed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    completed_at TEXT,
    FOREIGN KEY (assigned_to) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS inspection_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unchecked' CHECK(status IN ('unchecked', 'normal', 'abnormal')),
    description TEXT,
    photo_url TEXT,
    checked_at TEXT,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS rectification_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    inspection_item_id INTEGER NOT NULL,
    description TEXT NOT NULL,
    photo_url TEXT,
    responsible_person INTEGER NOT NULL,
    deadline TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'processing', 'review', 'completed', 'rejected')),
    result_description TEXT,
    result_photo_url TEXT,
    processed_at TEXT,
    reviewed_at TEXT,
    reviewed_by INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (inspection_item_id) REFERENCES inspection_items(id),
    FOREIGN KEY (responsible_person) REFERENCES users(id),
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
  );
`);

export default db;
