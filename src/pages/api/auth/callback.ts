import type { APIRoute } from 'astro';
import { db } from '../../../lib/db';

type CachetUser = {
  type: 'user';
  id: string;
  userId: string;
  displayName: string;
  pronouns: string | null;
  imageUrl: string | null;
  expiration: string;
};

export const GET: APIRoute = async ({ url, redirect, cookies }) => {
  const code = url.searchParams.get('code');
  if (!code) return redirect('/?error=no_code');

  const tokenRes = await fetch('https://auth.hackclub.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: import.meta.env.HCA_CLIENT_ID,
      client_secret: import.meta.env.HCA_CLIENT_SECRET,
      redirect_uri: import.meta.env.HCA_REDIRECT_URI,
    }),
  });

  if (!tokenRes.ok) return redirect('/?error=token_failed');
  const { access_token } = await tokenRes.json();

  const meRes = await fetch('https://auth.hackclub.com/api/v1/me', {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!meRes.ok) return redirect('/?error=me_failed');
  const { identity } = await meRes.json();
  const slackId: string = identity.slack_id;

  let display_name: string = slackId;
  try {
    const r = await fetch(`https://flaron.halceon.dev/user/${slackId}`);
    if (r.ok) {
      const d = await r.json();
      display_name = d.data?.user?.display_name ?? d.display_name ?? display_name;
    }
  } catch {}

  let avatar_url: string | null = null;
  try {
    const r = await fetch(`https://cachet.hackclub.com/users/${slackId}`);
    if (r.ok) {
      const d = (await r.json()) as Partial<CachetUser>;
      avatar_url =
        d.type === 'user' && d.userId === slackId && typeof d.imageUrl === 'string'
          ? d.imageUrl
          : null;
    }
  } catch {}

  await db.execute({
    sql: `INSERT INTO users (slack_id, display_name, avatar_url)
          VALUES (?, ?, ?)
          ON CONFLICT (slack_id) DO UPDATE SET
            display_name = excluded.display_name,
            avatar_url = excluded.avatar_url`,
    args: [slackId, display_name, avatar_url],
  });

  cookies.set(
    'session',
    JSON.stringify({ slack_id: slackId, display_name, avatar_url }),
    { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7 }
  );

  const { rows } = await db.execute({
    sql: 'SELECT onboarding_status FROM users WHERE slack_id = ?',
    args: [slackId],
  });
  const status = rows[0]?.onboarding_status as string;

  return status === 'approved' || status === 'pending_review'
    ? redirect('/')
    : redirect('/onboard');
};
