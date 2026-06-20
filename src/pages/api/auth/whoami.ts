import type { APIRoute } from 'astro';
import { getSession, isAdmin } from '../../../lib/auth';

export const GET: APIRoute = ({ cookies }) => {
  const session = getSession(cookies);

  return new Response(JSON.stringify({
    logged_in: Boolean(session),
    slack_id: session?.slack_id ?? null,
    display_name: session?.display_name ?? null,
    is_admin: session ? isAdmin(session.slack_id) : false,
  }, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
};
