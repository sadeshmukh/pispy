import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { getSession, isAdmin } from '../../../lib/auth';

// Serves the photo a hunter submitted as proof they found their target.
// Viewable by an admin or by the hunter who submitted it.
export const GET: APIRoute = async ({ params, cookies }) => {
  const session = getSession(cookies);
  if (!session) return new Response(null, { status: 401 });

  const id = parseInt(params.id ?? '');
  if (!id) return new Response(null, { status: 400 });

  const { rows } = await db.execute({
    sql: 'SELECT hunter_id, submission_photo, submission_photo_mime FROM assignments WHERE id = ?',
    args: [id],
  });
  const row = rows[0];
  if (!row || !row.submission_photo) return new Response(null, { status: 404 });

  if (row.hunter_id !== session.slack_id && !isAdmin(session.slack_id)) {
    return new Response(null, { status: 403 });
  }

  const raw = row.submission_photo;
  const mime = (row.submission_photo_mime as string) ?? 'image/jpeg';
  const blob = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer);

  return new Response(blob.buffer as ArrayBuffer, {
    headers: { 'Content-Type': mime, 'Cache-Control': 'private, max-age=3600' },
  });
};
