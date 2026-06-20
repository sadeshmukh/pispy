import { db } from './db';

// How often a hunter earns their next clue once a hunt is active.
export const CLUE_INTERVAL_SECONDS = 15 * 60;

export type Assignment = {
  id: number;
  hunter_id: string;
  target_id: string;
  status: string; // 'assigned' | 'active' | 'completed'
  started_at: number | null;
  created_at: number;
};

export type Clue = {
  id: number; // clue_fields.id
  prompt: string;
  answer: string;
};

function rowToAssignment(row: Record<string, unknown> | undefined): Assignment | null {
  if (!row) return null;
  return {
    id: row.id as number,
    hunter_id: row.hunter_id as string,
    target_id: row.target_id as string,
    status: row.status as string,
    started_at: (row.started_at as number | null) ?? null,
    created_at: row.created_at as number,
  };
}

export async function getAssignment(id: number): Promise<Assignment | null> {
  const { rows } = await db.execute({ sql: 'SELECT * FROM assignments WHERE id = ?', args: [id] });
  return rowToAssignment(rows[0]);
}

export async function getAssignmentForHunter(hunter_id: string): Promise<Assignment | null> {
  const { rows } = await db.execute({
    sql: 'SELECT * FROM assignments WHERE hunter_id = ?',
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
  return rows.map(r => ({ id: r.id as number, prompt: r.prompt as string, answer: r.answer as string }));
}

export async function getReleasedFieldIds(assignmentId: number): Promise<Set<number>> {
  const { rows } = await db.execute({
    sql: 'SELECT field_id FROM clue_releases WHERE assignment_id = ?',
    args: [assignmentId],
  });
  return new Set(rows.map(r => r.field_id as number));
}

// How many clues should be available given how long the hunt has run.
// The first clue lands the moment the hunt starts, then one per interval.
export function expectedReleaseCount(startedAt: number, now = Math.floor(Date.now() / 1000)): number {
  if (!startedAt) return 0;
  const elapsed = Math.max(0, now - startedAt);
  return Math.floor(elapsed / CLUE_INTERVAL_SECONDS) + 1;
}

// Seconds until the next clue is due, or null if all clues are out / not active.
export function secondsUntilNextClue(
  startedAt: number,
  totalClues: number,
  releasedCount: number,
  now = Math.floor(Date.now() / 1000),
): number | null {
  if (!startedAt || releasedCount >= totalClues) return null;
  const elapsed = Math.max(0, now - startedAt);
  return CLUE_INTERVAL_SECONDS - (elapsed % CLUE_INTERVAL_SECONDS);
}

// Bring the released-clue set up to where it should be given elapsed time.
// Only ever ADDS clues (lowest reveal-order first); admin revocations are not
// fought here beyond the time-based count. Returns the field ids newly released
// so a caller (e.g. a scheduled job) can fire notifications for them.
export async function syncClueReleases(assignment: Assignment): Promise<number[]> {
  if (assignment.status !== 'active' || !assignment.started_at) return [];

  const clues = await getTargetClues(assignment.target_id);
  if (clues.length === 0) return [];

  const released = await getReleasedFieldIds(assignment.id);
  const expected = Math.min(clues.length, expectedReleaseCount(assignment.started_at));
  const newlyReleased: number[] = [];

  for (const clue of clues) {
    if (released.size + newlyReleased.length >= expected) break;
    if (released.has(clue.id)) continue;
    await db.execute({
      sql: `INSERT INTO clue_releases (assignment_id, field_id) VALUES (?, ?)
            ON CONFLICT (assignment_id, field_id) DO NOTHING`,
      args: [assignment.id, clue.id],
    });
    newlyReleased.push(clue.id);
  }

  // TODO(slack): for each newly released clue, notify the hunter that a new
  // clue about their target is now available. (Drives the "every 15 minutes"
  // notification — call this from a scheduled job, see notes in this file.)
  return newlyReleased;
}

// Transition an 'assigned' hunt into 'active': stamp the start time and hand
// out the first clue. Safe to call from either the hunter ("start") or an admin
// force-start. No-op if the hunt is not in the 'assigned' state.
export async function startAssignment(assignmentId: number): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const res = await db.execute({
    sql: `UPDATE assignments SET status = 'active', started_at = ?
          WHERE id = ? AND status = 'assigned'`,
    args: [now, assignmentId],
  });
  if (res.rowsAffected === 0) return false;

  const assignment = await getAssignment(assignmentId);
  if (assignment) await syncClueReleases(assignment);

  // TODO(slack): notify the target that someone has started hunting them.
  // TODO(slack): notify the hunter that their hunt has begun (and include the
  // first clue released above).
  return true;
}
