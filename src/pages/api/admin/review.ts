import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const slack_id = formData.get('slack_id') as string;
  const action = formData.get('action') as string;

  if (!slack_id || !action) return redirect('/admin');

  if (action === 'approve') {
    await db.execute({
      sql: `UPDATE users SET onboarding_status = 'approved', review_note = NULL WHERE slack_id = ?`,
      args: [slack_id],
    });
  } else if (action === 'request_changes') {
    const note = (formData.get('note') as string)?.trim();
    await db.execute({
      sql: `UPDATE users SET onboarding_status = 'changes_requested', review_note = ? WHERE slack_id = ?`,
      args: [note ?? null, slack_id],
    });
  }

  return redirect('/admin');
};
