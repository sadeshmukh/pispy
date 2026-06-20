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
    CREATE TABLE IF NOT EXISTS user_onboarding_answers (
      slack_id TEXT NOT NULL,
      question_key TEXT NOT NULL,
      answer TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (slack_id, question_key)
    );
  `);
}
