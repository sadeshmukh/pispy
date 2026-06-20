import type { APIRoute } from 'astro';
import { db } from '../../lib/db';
import { getSession } from '../../lib/auth';
import { onboardingQuestions, requiredOnboardingQuestions } from '../../lib/onboardingQuestions';

function parsePhoto(dataUrl: string): { blob: Uint8Array; mime: string } | null {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null;
  const [header, b64] = dataUrl.split(',');
  if (!b64) return null;
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const blob = new Uint8Array(Buffer.from(b64, 'base64'));
  return { blob, mime };
}

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

  if (!badgeBlob) {
    return redirect('/onboard?error=missing_photo');
  }

  const answers = new Map<string, string>();
  for (const question of onboardingQuestions) {
    const answer = ((formData.get(`answer_${question.key}`) as string | null) ?? '').trim();
    if (answer) answers.set(question.key, answer);
  }

  const missingRequiredAnswer = requiredOnboardingQuestions.some(question => !answers.get(question.key));
  if (missingRequiredAnswer) {
    return redirect('/onboard?error=missing_answers');
  }

  await db.execute({
    sql: `UPDATE users SET
            onboarding_status = 'pending_review',
            review_note = NULL,
            badge_photo = ?,
            badge_photo_mime = ?
          WHERE slack_id = ?`,
    args: [badgeBlob, badgeMime, session.slack_id],
  });

  await db.execute({
    sql: 'DELETE FROM user_onboarding_answers WHERE slack_id = ?',
    args: [session.slack_id],
  });

  for (const [questionKey, answer] of answers) {
    await db.execute({
      sql: `INSERT INTO user_onboarding_answers (slack_id, question_key, answer, updated_at)
            VALUES (?, ?, ?, unixepoch())`,
      args: [session.slack_id, questionKey, answer],
    });
  }

  return redirect('/');
};
