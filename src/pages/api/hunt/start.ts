import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';
import { getSession } from '../../../lib/auth';
import { getAssignmentForHunter, startAssignment } from '../../../lib/hunt';

export const POST: APIRoute = async ({ cookies, redirect }) => {
  const session = getSession(cookies);
  if (!session) return redirect('/');

  // Only approved users may hunt.
  const { rows } = await db.execute({
    sql: 'SELECT onboarding_status FROM users WHERE slack_id = ?',
    args: [session.slack_id],
  });
  if (rows[0]?.onboarding_status !== 'approved') return redirect('/');

  const assignment = await getAssignmentForHunter(session.slack_id);
  if (!assignment || assignment.status !== 'assigned') return redirect('/hunt');

  await startAssignment(assignment.id);

  return redirect('/hunt');
};
