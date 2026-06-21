import type { APIRoute } from "astro";
import { db } from "../../lib/db";
import { getSession } from "../../lib/auth";
import { parsePhoto } from "../../lib/photos";
import { regenerateAiClues } from "../../lib/ai";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
	const session = getSession(cookies);
	if (!session) return redirect("/");

	const { rows } = await db.execute({
		sql: "SELECT onboarding_status FROM users WHERE slack_id = ?",
		args: [session.slack_id],
	});
	const status = rows[0]?.onboarding_status as string;
	if (status === "approved" || status === "pending_review")
		return redirect("/");

	const formData = await request.formData();

	// resolve badge photo
	let badgeBlob: Uint8Array | null = null;
	let badgeMime: string | null = null;

	const badgeData = formData.get("badge_photo_data") as string;
	const badgeFile = formData.get("badge_photo_file") as File | null;

	if (badgeData) {
		const parsed = parsePhoto(badgeData);
		if (parsed) {
			badgeBlob = parsed.blob;
			badgeMime = parsed.mime;
		}
	} else if (badgeFile && badgeFile.size > 0) {
		badgeBlob = new Uint8Array(await badgeFile.arrayBuffer());
		badgeMime = badgeFile.type || "image/jpeg";
	}

	// resolve face photo
	let faceBlob: Uint8Array | null = null;
	let faceMime: string | null = null;

	const faceData = formData.get("face_photo_data") as string;
	const faceFile = formData.get("face_photo_file") as File | null;

	if (faceData) {
		const parsed = parsePhoto(faceData);
		if (parsed) {
			faceBlob = parsed.blob;
			faceMime = parsed.mime;
		}
	} else if (faceFile && faceFile.size > 0) {
		faceBlob = new Uint8Array(await faceFile.arrayBuffer());
		faceMime = faceFile.type || "image/jpeg";
	}

	if (!badgeBlob || !faceBlob) {
		return redirect("/onboard?error=missing_photos");
	}

	const aboutText = (formData.get("about_text") as string)?.trim() ?? "";

	await db.execute({
		sql: `UPDATE users SET
            onboarding_status = 'pending_review',
            review_note = NULL,
            badge_photo = ?,
            badge_photo_mime = ?,
            face_photo = ?,
            face_photo_mime = ?,
            about_text = ?
          WHERE slack_id = ?`,
		args: [
			badgeBlob,
			badgeMime,
			faceBlob,
			faceMime,
			aboutText || null,
			session.slack_id,
		],
	});

	// Upsert standard clue answers. Yes/no questions store a useful, readable
	// answer while only requiring elaboration for "yes".
	const { rows: fields } = await db.execute(
		"SELECT id, question_type FROM clue_fields",
	);

	for (const field of fields) {
		const fieldId = field.id as number;
		let answer = (formData.get(`clue_${fieldId}`) as string)?.trim() ?? "";
		if (field.question_type === "yes_no") {
			const choice = formData.get(`clue_choice_${fieldId}`);
			const detail = (
				formData.get(`clue_elaboration_${fieldId}`) as string
			)?.trim();
			answer =
				choice === "no"
					? "No"
					: choice === "yes" && detail
						? `Yes — ${detail}`
						: "";
		}
		if (answer) {
			await db.execute({
				sql: `INSERT INTO user_clues (slack_id, field_id, answer) VALUES (?, ?, ?)
              ON CONFLICT (slack_id, field_id) DO UPDATE SET answer = excluded.answer`,
				args: [session.slack_id, fieldId, answer],
			});
		} else {
			await db.execute({
				sql: "DELETE FROM user_clues WHERE slack_id = ? AND field_id = ?",
				args: [session.slack_id, fieldId],
			});
		}
	}

	// Replace only the user's own clues — AI-generated ones (source = 'ai') are
	// managed separately below. Re-inserting makes removals and reordering explicit.
	await db.execute({
		sql: "DELETE FROM custom_clues WHERE slack_id = ? AND source = 'user'",
		args: [session.slack_id],
	});
	const customKeys = [...formData.keys()].filter((k) =>
		/^custom_clue_\d+$/.test(k),
	);
	for (const key of customKeys) {
		const index = key.slice("custom_clue_".length);
		const clue = (formData.get(key) as string)?.trim();
		if (!clue) continue;
		const rawDifficulty = String(formData.get(`custom_difficulty_${index}`));
		const difficulty = ["hard", "medium", "easy"].includes(rawDifficulty)
			? rawDifficulty
			: "medium";
		await db.execute({
			sql: "INSERT INTO custom_clues (slack_id, clue, difficulty, source) VALUES (?, ?, ?, 'user')",
			args: [session.slack_id, clue, difficulty],
		});
	}

	// Turn the free-form description into clues for an admin to review. Fail-soft:
	// if the AI call fails, onboarding still completes and an admin can regenerate.
	await regenerateAiClues(
		db,
		session.slack_id,
		aboutText,
		session.display_name,
	);

	return redirect("/");
};
