import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { regenerateAiClues } from "../../../lib/ai";
import {
	notifyChangesRequested,
	notifyOnboardingApproved,
} from "../../../lib/notify";

export const POST: APIRoute = async ({ request, redirect }) => {
	const formData = await request.formData();
	const slack_id = formData.get("slack_id") as string;
	const action = formData.get("action") as string;

	if (!slack_id || !action) return redirect("/admin");

	if (action === "approve") {
		await db.execute({
			sql: `UPDATE users SET onboarding_status = 'approved', review_note = NULL WHERE slack_id = ?`,
			args: [slack_id],
		});
		await notifyOnboardingApproved(slack_id);
	} else if (action === "save_custom_clues") {
		const ids = [...formData.keys()]
			.filter((key) => /^custom_clue_\d+$/.test(key))
			.map((key) => Number(key.slice(12)));
		for (const id of ids) {
			if (formData.get(`delete_custom_${id}`)) {
				await db.execute({
					sql: "DELETE FROM custom_clues WHERE id = ? AND slack_id = ?",
					args: [id, slack_id],
				});
				continue;
			}
			const clue = (formData.get(`custom_clue_${id}`) as string)?.trim();
			const rawDifficulty = String(formData.get(`custom_difficulty_${id}`));
			const difficulty = ["hard", "medium", "easy"].includes(rawDifficulty)
				? rawDifficulty
				: "medium";
			if (clue)
				await db.execute({
					sql: "UPDATE custom_clues SET clue = ?, difficulty = ? WHERE id = ? AND slack_id = ?",
					args: [clue, difficulty, id, slack_id],
				});
		}
		return redirect(`/admin/review/${slack_id}`);
	} else if (action === "regenerate_clues") {
		const { rows } = await db.execute({
			sql: "SELECT display_name, about_text FROM users WHERE slack_id = ?",
			args: [slack_id],
		});
		const aboutText = (rows[0]?.about_text as string | null) ?? "";
		const displayName = (rows[0]?.display_name as string | null) ?? "";
		await regenerateAiClues(db, slack_id, aboutText, displayName);
		return redirect(`/admin/review/${slack_id}`);
	} else if (action === "request_changes") {
		const note = (formData.get("note") as string)?.trim();
		await db.execute({
			sql: `UPDATE users SET onboarding_status = 'changes_requested', review_note = ? WHERE slack_id = ?`,
			args: [note ?? null, slack_id],
		});
		await notifyChangesRequested(slack_id, note ?? "");
	}

	return redirect("/admin");
};
