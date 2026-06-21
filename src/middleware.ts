import { defineMiddleware } from "astro:middleware";
import { getSession, isAdmin } from "./lib/auth";
import { DB_SCHEMA_VERSION, initDb } from "./lib/db";

let initializedSchemaVersion = 0;

export const onRequest = defineMiddleware(async (context, next) => {
	if (initializedSchemaVersion !== DB_SCHEMA_VERSION) {
		await initDb();
		initializedSchemaVersion = DB_SCHEMA_VERSION;
	}

	const { pathname } = context.url;

	if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
		const session = getSession(context.cookies);
		if (!session || !isAdmin(session.slack_id)) {
			return context.redirect("/");
		}
	}

	return next();
});
