import { createClient } from "@libsql/client";

// Bump this whenever initDb gains a migration. Middleware uses it to rerun
// initialization after a hot reload instead of keeping a stale "ready" flag.
export const DB_SCHEMA_VERSION = 5;

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
      about_text TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS clue_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt TEXT NOT NULL,
      field_order INTEGER NOT NULL DEFAULT 0,
      difficulty TEXT NOT NULL DEFAULT 'medium',
      question_type TEXT NOT NULL DEFAULT 'text',
      placeholder TEXT NOT NULL DEFAULT '',
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
    CREATE TABLE IF NOT EXISTS custom_clues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slack_id TEXT NOT NULL,
      clue TEXT NOT NULL,
      difficulty TEXT NOT NULL DEFAULT 'medium',
      source TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS hunt_threshold_notifications (
      assignment_id INTEGER NOT NULL,
      threshold INTEGER NOT NULL,
      sent_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (assignment_id, threshold)
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
		`ALTER TABLE clue_fields ADD COLUMN difficulty TEXT NOT NULL DEFAULT 'medium'`,
		`ALTER TABLE clue_fields ADD COLUMN question_type TEXT NOT NULL DEFAULT 'text'`,
		`ALTER TABLE clue_fields ADD COLUMN placeholder TEXT NOT NULL DEFAULT ''`,
		`ALTER TABLE users ADD COLUMN about_text TEXT`,
		`ALTER TABLE custom_clues ADD COLUMN source TEXT NOT NULL DEFAULT 'user'`,
	];
	for (const sql of migrations) {
		try {
			await db.execute(sql);
		} catch (error) {
			// Ignore only the expected idempotency failure. A real migration error
			// must surface here instead of becoming a later "no such column" error.
			if (
				!(error instanceof Error) ||
				!error.message.includes("duplicate column name")
			) {
				throw error;
			}
		}
	}
}
