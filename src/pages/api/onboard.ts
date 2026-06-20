import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { getSession } from '../../lib/auth';
import { parsePhoto } from '../../lib/photos';

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const session = getSession(cookies);
  if (!session) return redirect('/');

  const { rows } = await db.execute({
    sql: 'SELECT onboarding_status FROM users WHERE slack_id = ?',
    args: [session.slack_id],
  });
  const status = rows[0]?.onboarding_status as string;
  if (status === 'approved' || status === 'pending_review') return redirect('/');

  const formData = await request.formData();

  // resolve badge photo
  let badgeBlob: Uint8Array | null = null;
  let badgeMime: string | null = null;

  const badgeData = formData.get('badge_photo_data') as string;
  const badgeFile = formData.get('badge_photo_file') as File | null;

  if (badgeData) {
    const parsed = parsePhoto(badgeData);
    if (parsed) { badgeBlob = parsed.blob; badgeMime = parsed.mime; }
  } else if (badgeFile && badgeFile.size > 0) {
    badgeBlob = new Uint8Array(await badgeFile.arrayBuffer());
    badgeMime = badgeFile.type || 'image/jpeg';
  }

  // resolve face photo
  let faceBlob: Uint8Array | null = null;
  let faceMime: string | null = null;

  const faceData = formData.get('face_photo_data') as string;
  const faceFile = formData.get('face_photo_file') as File | null;

  if (faceData) {
    const parsed = parsePhoto(faceData);
    if (parsed) { faceBlob = parsed.blob; faceMime = parsed.mime; }
  } else if (faceFile && faceFile.size > 0) {
    faceBlob = new Uint8Array(await faceFile.arrayBuffer());
    faceMime = faceFile.type || 'image/jpeg';
  }

  if (!badgeBlob || !faceBlob) {
    return redirect('/onboard?error=missing_photos');
  }

  await db.execute({
    sql: `UPDATE users SET
            onboarding_status = 'pending_review',
            review_note = NULL,
            badge_photo = ?,
            badge_photo_mime = ?,
            face_photo = ?,
            face_photo_mime = ?
          WHERE slack_id = ?`,
    args: [badgeBlob, badgeMime, faceBlob, faceMime, session.slack_id],
  });

  // upsert clue answers
  const fieldIds = [...formData.keys()]
    .filter(k => k.startsWith('clue_'))
    .map(k => parseInt(k.slice(5)));

  for (const fieldId of fieldIds) {
    const answer = (formData.get(`clue_${fieldId}`) as string)?.trim();
    if (!answer) continue;
    await db.execute({
      sql: `INSERT INTO user_clues (slack_id, field_id, answer) VALUES (?, ?, ?)
            ON CONFLICT (slack_id, field_id) DO UPDATE SET answer = excluded.answer`,
      args: [session.slack_id, fieldId, answer],
    });
  }

  return redirect('/');
};
