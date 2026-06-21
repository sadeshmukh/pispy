import { db } from "./db";
import { notifyHuntStarted } from "./notify";

// Scoring: a find starts from BASE_SCORE and loses points for how long the hunt
// took. All clues are shown up front, so speed is the whole game - find your
// target fastest to win.
export const BASE_SCORE = 1000;
export const POINTS_LOST_PER_SECOND = 1;
export const MIN_SCORE = 0;
export const SCORE_REMINDER_THRESHOLDS = [500, 250, 100] as const;

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
	id: number; // standard field id, negative custom_clues id, or 0 for the auto name clue
	prompt: string;
	answer: string;
	difficulty: "hard" | "medium" | "easy";
	custom: boolean;
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
		sql: `SELECT ${ASSIGNMENT_COLUMNS} FROM assignments
          WHERE hunter_id = ?
          ORDER BY CASE WHEN status = 'completed' THEN 1 ELSE 0 END, id DESC
          LIMIT 1`,
		args: [hunter_id],
	});
	return rowToAssignment(rows[0]);
}

// The target's clues (standard answers + custom/AI), ordered by difficulty.
// All of these are shown to the hunter at once.
export async function getTargetClues(target_id: string): Promise<Clue[]> {
	const [{ rows: standard }, { rows: custom }, { rows: users }] =
		await Promise.all([
			db.execute({
				sql: `SELECT cf.id, cf.prompt, uc.answer, cf.difficulty, cf.field_order
          FROM user_clues uc
          JOIN clue_fields cf ON cf.id = uc.field_id
          WHERE uc.slack_id = ?
          ORDER BY cf.field_order, cf.id`,
				args: [target_id],
			}),
			db.execute({
				sql: "SELECT id, clue, difficulty FROM custom_clues WHERE slack_id = ? ORDER BY id",
				args: [target_id],
			}),
			db.execute({
				sql: "SELECT display_name FROM users WHERE slack_id = ?",
				args: [target_id],
			}),
		]);
	const rank: Record<string, number> = { hard: 0, medium: 1, easy: 2 };
	const nameClue = users[0]
		? [
				{
					id: 0,
					prompt: "Name",
					answer: users[0].display_name as string,
					difficulty: "easy" as Clue["difficulty"],
					custom: false,
					order: -1,
				},
			]
		: [];
	return [
		...nameClue,
		...standard.map((r) => ({
			id: r.id as number,
			prompt: r.prompt as string,
			answer: r.answer as string,
			difficulty: r.difficulty as Clue["difficulty"],
			custom: false,
			order: r.field_order as number,
		})),
		...custom.map((r) => ({
			id: -(r.id as number),
			prompt: "Custom clue",
			answer: r.clue as string,
			difficulty: r.difficulty as Clue["difficulty"],
			custom: true,
			order: 1_000_000 + (r.id as number),
		})),
	]
		.sort(
			(a, b) =>
				(rank[a.difficulty] ?? 1) - (rank[b.difficulty] ?? 1) ||
				a.order - b.order ||
				a.id - b.id,
		)
		.map(({ order: _order, ...clue }) => clue);
}

// The score a find would earn right now given how long the hunt has been
// running. All clues are visible from the start, so only elapsed time matters.
export function computeScore(elapsedSeconds: number): number {
	const timePenalty =
		Math.floor(Math.max(0, elapsedSeconds)) * POINTS_LOST_PER_SECOND;
	return Math.max(MIN_SCORE, BASE_SCORE - timePenalty);
}

// Transition an 'assigned' hunt into 'active': stamp the start time. The hunter
// sees every clue at once from here. Safe to call from either the hunter or an
// admin force-start. No-op if the hunt is not in the 'assigned' state.
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

	const res = await db.execute({
		sql: `UPDATE assignments SET status = 'active', started_at = ?
          WHERE id = ? AND status = 'assigned'`,
		args: [now, assignmentId],
	});

	// Only DM when this call actually started the hunt, so repeated start clicks
	// or an admin force-start don't spam both players.
	if (res.rowsAffected > 0) {
		await db.execute({
			sql: "DELETE FROM hunt_threshold_notifications WHERE assignment_id = ?",
			args: [assignmentId],
		});
		await notifyHuntStarted(hunter, target);
	}
	return res.rowsAffected > 0;
}
