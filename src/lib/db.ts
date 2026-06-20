import { createClient } from '@libsql/client';

export const db = createClient({
  url: import.meta.env.TURSO_URL,
  authToken: import.meta.env.TURSO_AUTH_TOKEN,
});

export async function initDb() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      slack_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      avatar_url TEXT,
      onboarding_status TEXT NOT NULL DEFAULT 'pending_submission',
      review_note TEXT,
      badge_photo BLOB,
      badge_photo_mime TEXT,
      face_photo BLOB,
      face_photo_mime TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS clue_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt TEXT NOT NULL,
      field_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS user_clues (
      slack_id TEXT NOT NULL,
      field_id INTEGER NOT NULL,
      answer TEXT NOT NULL,
      PRIMARY KEY (slack_id, field_id)
    );
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hunter_id TEXT NOT NULL UNIQUE,
      target_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'assigned',
      started_at INTEGER,
      submitted_at INTEGER,
      score INTEGER,
      submission_photo BLOB,
      submission_photo_mime TEXT,
      review_note TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS clue_releases (
      assignment_id INTEGER NOT NULL,
      field_id INTEGER NOT NULL,
      released_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (assignment_id, field_id)
    );
  `);

  // Idempotent migrations for databases created before the capture/score
  // columns existed. ALTER TABLE ADD COLUMN throws if the column is already
  // there, so each one is guarded individually.
  const migrations = [
    `ALTER TABLE assignments ADD COLUMN submitted_at INTEGER`,
    `ALTER TABLE assignments ADD COLUMN score INTEGER`,
    `ALTER TABLE assignments ADD COLUMN submission_photo BLOB`,
    `ALTER TABLE assignments ADD COLUMN submission_photo_mime TEXT`,
    `ALTER TABLE assignments ADD COLUMN review_note TEXT`,
  ];
  for (const sql of migrations) {
    try {
      await db.execute(sql);
    } catch {
      // column already exists — nothing to do
    }
  }
}
