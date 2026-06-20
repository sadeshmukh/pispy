import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const slack_id = (formData.get('slack_id') as string)?.trim();
  const action = formData.get('action') as string;
  if (!slack_id) return redirect('/admin/users');

  const back = `/admin/inspect/${slack_id}`;

  // Confirm the user exists before touching anything.
  const { rows } = await db.execute({ sql: 'SELECT slack_id FROM users WHERE slack_id = ?', args: [slack_id] });
  if (!rows[0]) return redirect('/admin/users');

  if (action === 'update_profile') {
    const display_name = (formData.get('display_name') as string)?.trim();
    const onboarding_status = (formData.get('onboarding_status') as string)?.trim();
    const review_note = (formData.get('review_note') as string)?.trim() || null;
    const allowed = ['pending_submission', 'pending_review', 'approved', 'changes_requested'];
    if (display_name && onboarding_status && allowed.includes(onboarding_status)) {
      await db.execute({
        sql: 'UPDATE users SET display_name = ?, onboarding_status = ?, review_note = ? WHERE slack_id = ?',
        args: [display_name, onboarding_status, review_note, slack_id],
      });
    }
    return redirect(back);
  }

  if (action === 'update_photos') {
    const badge = formData.get('badge_photo_file') as File | null;
    const face = formData.get('face_photo_file') as File | null;

    if (badge && badge.size > 0) {
      const blob = new Uint8Array(await badge.arrayBuffer());
      await db.execute({
        sql: 'UPDATE users SET badge_photo = ?, badge_photo_mime = ? WHERE slack_id = ?',
        args: [blob, badge.type || 'image/jpeg', slack_id],
      });
    }
    if (face && face.size > 0) {
      const blob = new Uint8Array(await face.arrayBuffer());
      await db.execute({
        sql: 'UPDATE users SET face_photo = ?, face_photo_mime = ? WHERE slack_id = ?',
        args: [blob, face.type || 'image/jpeg', slack_id],
      });
    }
    return redirect(back);
  }

  if (action === 'update_clues') {
    // Each clue_<fieldId> is upserted, or deleted when cleared.
    const fieldIds = [...formData.keys()]
      .filter(k => k.startsWith('clue_'))
      .map(k => parseInt(k.slice(5)))
      .filter(Boolean);

    for (const fieldId of fieldIds) {
      const answer = (formData.get(`clue_${fieldId}`) as string)?.trim();
      if (answer) {
        await db.execute({
          sql: `INSERT INTO user_clues (slack_id, field_id, answer) VALUES (?, ?, ?)
                ON CONFLICT (slack_id, field_id) DO UPDATE SET answer = excluded.answer`,
          args: [slack_id, fieldId, answer],
        });
      } else {
        await db.execute({
          sql: 'DELETE FROM user_clues WHERE slack_id = ? AND field_id = ?',
          args: [slack_id, fieldId],
        });
      }
    }
    return redirect(back);
  }

  return redirect(back);
};
