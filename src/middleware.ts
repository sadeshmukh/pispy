import { defineMiddleware } from 'astro:middleware';
import { initDb } from './lib/db';
import { getSession, isAdmin } from './lib/auth';

let dbReady = false;

export const onRequest = defineMiddleware(async (context, next) => {
  if (!dbReady) {
    await initDb();
    dbReady = true;
  }

  const { pathname } = context.url;

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    const session = getSession(context.cookies);
    if (!session || !isAdmin(session.slack_id)) {
      return context.redirect('/');
    }
  }

  return next();
});
