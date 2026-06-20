import { db } from "./db";

import { App } from "slack.ts";

const app = new App({
  token: import.meta.env.XOXB,
});

// Scoring: a find starts from BASE_SCORE and loses points for every clue the
// hunter revealed and for how long the hunt took. Earlier + fewer clues wins.
export const BASE_SCORE = 1000;
export const CLUE_PENALTY = 100; // points lost per clue revealed
export const TIME_PENALTY_PER_HOUR = 50; // points lost per hour since the hunt started
export const MIN_SCORE = 100; // a successful find always earns at least this

export type Assignment = {
  id: number;
  hunter_id: string;
  target_id: string;
  status: string; // 'assigned' | 'active' | 'submitted' | 'completed'
  started_at: number | null;
  submitted_at: number | null;
  score: number | null;
  review_note: string | null;
  created_at: number;
};

export type Clue = {
  id: number; // clue_fields.id
  prompt: string;
  answer: string;
};

function rowToAssignment(
  row: Record<string, unknown> | undefined,
): Assignment | null {
  if (!row) return null;
  return {
    id: row.id as number,
    hunter_id: row.hunter_id as string,
    target_id: row.target_id as string,
    status: row.status as string,
    started_at: (row.started_at as number | null) ?? null,
    submitted_at: (row.submitted_at as number | null) ?? null,
    score: (row.score as number | null) ?? null,
    review_note: (row.review_note as string | null) ?? null,
    created_at: row.created_at as number,
  };
}

const ASSIGNMENT_COLUMNS =
  "id, hunter_id, target_id, status, started_at, submitted_at, score, review_note, created_at";

export async function getAssignment(id: number): Promise<Assignment | null> {
  const { rows } = await db.execute({
    sql: `SELECT ${ASSIGNMENT_COLUMNS} FROM assignments WHERE id = ?`,
    args: [id],
  });
  return rowToAssignment(rows[0]);
}

export async function getAssignmentForHunter(
  hunter_id: string,
): Promise<Assignment | null> {
  const { rows } = await db.execute({
    sql: `SELECT ${ASSIGNMENT_COLUMNS} FROM assignments WHERE hunter_id = ?`,
    args: [hunter_id],
  });
  return rowToAssignment(rows[0]);
}

// The target's answered clues, in the order they should be revealed.
export async function getTargetClues(target_id: string): Promise<Clue[]> {
  const { rows } = await db.execute({
    sql: `SELECT cf.id, cf.prompt, uc.answer
          FROM user_clues uc
          JOIN clue_fields cf ON cf.id = uc.field_id
          WHERE uc.slack_id = ?
          ORDER BY cf.field_order, cf.id`,
    args: [target_id],
  });
  return rows.map((r) => ({
    id: r.id as number,
    prompt: r.prompt as string,
    answer: r.answer as string,
  }));
}

export async function getReleasedFieldIds(
  assignmentId: number,
): Promise<Set<number>> {
  const { rows } = await db.execute({
    sql: "SELECT field_id FROM clue_releases WHERE assignment_id = ?",
    args: [assignmentId],
  });
  return new Set(rows.map((r) => r.field_id as number));
}

// The score a find would earn right now given how many clues the hunter has
// revealed and how long the hunt has been running.
export function computeScore(
  cluesRevealed: number,
  elapsedSeconds: number,
): number {
  const timePenalty = Math.floor(
    (Math.max(0, elapsedSeconds) / 3600) * TIME_PENALTY_PER_HOUR,
  );
  const raw = BASE_SCORE - CLUE_PENALTY * cluesRevealed - timePenalty;
  return Math.max(MIN_SCORE, raw);
}

// Reveal the next clue (lowest reveal-order) the hunter hasn't seen yet.
// Returns the revealed field id, or null if there's nothing left to reveal.
export async function revealNextClue(
  assignment: Assignment,
): Promise<number | null> {
  if (assignment.status !== "active") return null;
  const clues = await getTargetClues(assignment.target_id);
  const released = await getReleasedFieldIds(assignment.id);
  const next = clues.find((c) => !released.has(c.id));
  if (!next) return null;
  await db.execute({
    sql: `INSERT INTO clue_releases (assignment_id, field_id) VALUES (?, ?)
          ON CONFLICT (assignment_id, field_id) DO NOTHING`,
    args: [assignment.id, next.id],
  });
  return next.id;
}

// Transition an 'assigned' hunt into 'active': stamp the start time. Clues are
// no longer handed out automatically — the hunter reveals them at their own
// pace. Safe to call from either the hunter or an admin force-start. No-op if
// the hunt is not in the 'assigned' state.
export async function startAssignment(assignmentId: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const { hunter_id: hunter, target_id: target } = rowToAssignment(
    (
      await db.execute({
        sql: "SELECT hunter_id, target_id FROM assignments WHERE id = ?",
        args: [assignmentId],
      })
    ).rows[0],
  )!;
  if (!hunter || !target) return false;
  await app.channel(hunter).send("goog");
  await app.channel(target).send(":fear: :uuh: :fear:");

  const res = await db.execute({
    sql: `UPDATE assignments SET status = 'active', started_at = ?
          WHERE id = ? AND status = 'assigned'`,
    args: [now, assignmentId],
  });
  return res.rowsAffected > 0;
}
