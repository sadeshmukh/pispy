import type { APIRoute } from "astro";
import { db } from "../../../lib/db";
import { getSession } from "../../../lib/auth";
import { parsePhoto } from "../../../lib/photos";
import { getAssignmentForHunter, computeScore } from "../../../lib/hunt";
import { notifyCaptureSubmitted } from "../../../lib/notify";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
	const session = getSession(cookies);
	if (!session) return redirect("/");

	const { rows } = await db.execute({
		sql: "SELECT onboarding_status FROM users WHERE slack_id = ?",
		args: [session.slack_id],
	});
	if (rows[0]?.onboarding_status !== "approved") return redirect("/");

	const assignment = await getAssignmentForHunter(session.slack_id);
	// Only an in-progress hunt can be submitted.
	if (!assignment || assignment.status !== "active") return redirect("/hunt");

	const formData = await request.formData();

	let blob: Uint8Array | null = null;
	let mime: string | null = null;

	const data = formData.get("capture_photo_data") as string;
	const file = formData.get("capture_photo_file") as File | null;
	if (data) {
		const parsed = parsePhoto(data);
		if (parsed) {
			blob = parsed.blob;
			mime = parsed.mime;
		}
	} else if (file && file.size > 0) {
		blob = new Uint8Array(await file.arrayBuffer());
		mime = file.type || "image/jpeg";
	}

	if (!blob) return redirect("/hunt?error=missing_photo");

	// Lock in the score at submission time: it reflects how long the hunt ran.
	// Points are awarded once an admin confirms the photo really is the target.
	const elapsed = assignment.started_at
		? Math.floor(Date.now() / 1000) - assignment.started_at
		: 0;
	const score = computeScore(elapsed);

	await db.execute({
		sql: `UPDATE assignments SET
            status = 'submitted',
            submitted_at = ?,
            score = ?,
            submission_photo = ?,
            submission_photo_mime = ?,
            review_note = NULL
          WHERE id = ?`,
		args: [Math.floor(Date.now() / 1000), score, blob, mime, assignment.id],
	});

	await notifyCaptureSubmitted(session.slack_id);

	return redirect("/hunt");
};
