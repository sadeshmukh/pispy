import { db } from "./db";
import {
	type Assignment,
	computeScore,
	SCORE_REMINDER_THRESHOLDS,
} from "./hunt";
import { notifyHuntScoreThreshold } from "./notify";

const POLL_INTERVAL_MS = 5_000;

type ReminderWorkerState = {
	timer: ReturnType<typeof setInterval> | null;
	running: boolean;
};

const globals = globalThis as typeof globalThis & {
	__pispyHuntReminderWorker?: ReminderWorkerState;
};

function state(): ReminderWorkerState {
	if (!globals.__pispyHuntReminderWorker) {
		globals.__pispyHuntReminderWorker = { timer: null, running: false };
	}
	return globals.__pispyHuntReminderWorker;
}

async function markCrossedThresholds(
	assignmentId: number,
	thresholds: number[],
): Promise<void> {
	for (const threshold of thresholds) {
		await db.execute({
			sql: `INSERT OR IGNORE INTO hunt_threshold_notifications
              (assignment_id, threshold) VALUES (?, ?)`,
			args: [assignmentId, threshold],
		});
	}
}

async function processAssignment(
	assignment: Pick<Assignment, "id" | "hunter_id" | "started_at">,
	now: number,
): Promise<void> {
	if (!assignment.started_at) return;

	const score = computeScore(now - assignment.started_at);
	const crossed = SCORE_REMINDER_THRESHOLDS.filter(
		(threshold) => score <= threshold,
	);
	if (crossed.length === 0) return;

	const { rows } = await db.execute({
		sql: `SELECT threshold FROM hunt_threshold_notifications
          WHERE assignment_id = ?`,
		args: [assignment.id],
	});
	const recorded = new Set(rows.map((row) => row.threshold as number));
	const unsent = crossed.filter((threshold) => !recorded.has(threshold));
	if (unsent.length === 0) return;

	// If the worker was unavailable across several thresholds, send only the
	// lowest/current reminder and record every crossed threshold to avoid a
	// burst of stale messages on following polls.
	const currentThreshold = Math.min(...unsent);
	const sent = await notifyHuntScoreThreshold(
		assignment.hunter_id,
		currentThreshold,
	);
	if (sent) await markCrossedThresholds(assignment.id, [...crossed]);
}

export async function runHuntReminderPass(): Promise<void> {
	const worker = state();
	if (worker.running) return;
	worker.running = true;

	try {
		const { rows } = await db.execute({
			sql: `SELECT id, hunter_id, started_at FROM assignments
            WHERE status = 'active' AND started_at IS NOT NULL`,
			args: [],
		});
		const now = Math.floor(Date.now() / 1000);
		for (const row of rows) {
			await processAssignment(
				{
					id: row.id as number,
					hunter_id: row.hunter_id as string,
					started_at: row.started_at as number,
				},
				now,
			);
		}
	} catch (error) {
		console.error("Hunt reminder worker failed:", error);
	} finally {
		worker.running = false;
	}
}

export function startHuntReminderWorker(): void {
	const worker = state();
	if (worker.timer) return;

	void runHuntReminderPass();
	worker.timer = setInterval(
		() => void runHuntReminderPass(),
		POLL_INTERVAL_MS,
	);
	worker.timer.unref?.();
}
