import type { APIRoute } from "astro";
import { db } from "../../../../lib/db";
import { getSession, isAdmin } from "../../../../lib/auth";

export const GET: APIRoute = async ({ params, cookies }) => {
	const session = getSession(cookies);
	if (!session) return new Response(null, { status: 401 });

	const { slack_id, type } = params;
	if (type !== "badge" && type !== "face")
		return new Response(null, { status: 400 });

	if (slack_id !== session.slack_id && !isAdmin(session.slack_id)) {
		return new Response(null, { status: 403 });
	}

	const col = type === "badge" ? "badge_photo" : "face_photo";
	const mimeCol = type === "badge" ? "badge_photo_mime" : "face_photo_mime";

	const { rows } = await db.execute({
		sql: `SELECT ${col}, ${mimeCol} FROM users WHERE slack_id = ?`,
		args: [slack_id!],
	});

	const row = rows[0];
	if (!row || !row[col]) return new Response(null, { status: 404 });

	const raw = row[col];
	const mime = (row[mimeCol] as string) ?? "image/jpeg";
	const blob =
		raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer);

	return new Response(blob.buffer as ArrayBuffer, {
		headers: { "Content-Type": mime, "Cache-Control": "private, max-age=3600" },
	});
};
