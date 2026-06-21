import { App } from "slack.ts";
import { db } from "./db";
import { messages } from "./messages";

// Same Slack wiring already used here: an App authed with the XOXB bot token,
// DMing a user via app.channel(slackId).send(text). All message copy lives in
// ./messages - this module only decides who gets told what, and when.
const app = new App({
	token: import.meta.env.XOXB,
});

// Send a DM, but never let a Slack hiccup break the game flow that triggered it
// - a failed notification must not roll back a score, status change, etc.
async function dm(slackId: string, text: string): Promise<void> {
	try {
		await app.channel(slackId).send(text);
	} catch (error) {
		console.error(`Slack DM to ${slackId} failed:`, error);
	}
}

async function displayName(slackId: string): Promise<string> {
	const { rows } = await db.execute({
		sql: "SELECT display_name FROM users WHERE slack_id = ?",
		args: [slackId],
	});
	return (rows[0]?.display_name as string | undefined) ?? "someone";
}

export async function notifyOnboardingApproved(slackId: string): Promise<void> {
	await dm(slackId, messages.onboardingApproved());
}

export async function notifyChangesRequested(
	slackId: string,
	note: string,
): Promise<void> {
	await dm(slackId, messages.changesRequested(note));
}

export async function notifyHuntStarted(
	hunterId: string,
	targetId: string,
): Promise<void> {
	const targetName = await displayName(targetId);
	await dm(hunterId, messages.huntStartedHunter(targetName));
	await dm(targetId, messages.huntStartedTarget());
}

export async function notifyCaptureSubmitted(hunterId: string): Promise<void> {
	await dm(hunterId, messages.captureSubmittedHunter());
}

export async function notifyCaptureApproved(
	hunterId: string,
	targetId: string,
	score: number,
): Promise<void> {
	const [hunterName, targetName] = await Promise.all([
		displayName(hunterId),
		displayName(targetId),
	]);
	await dm(hunterId, messages.captureApprovedHunter(targetName, score));
	await dm(targetId, messages.captureCaughtTarget(hunterName));
}

export async function notifyCaptureRejected(
	hunterId: string,
	note: string,
): Promise<void> {
	await dm(hunterId, messages.captureRejectedHunter(note));
}
