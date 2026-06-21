import { defineMiddleware } from "astro:middleware";
import { getSession, isAdmin } from "./lib/auth";
import { DB_SCHEMA_VERSION, initDb } from "./lib/db";

let initializedSchemaVersion = 0;

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const FORM_CONTENT_TYPES = [
	"application/x-www-form-urlencoded",
	"multipart/form-data",
	"text/plain",
];

function firstForwardedValue(value: string | null): string | undefined {
	return value?.split(",", 1)[0]?.trim() || undefined;
}

function isAllowedFormOrigin(request: Request, requestUrl: URL): boolean {
	const origin = request.headers.get("origin");
	if (!origin) return false;

	let originUrl: URL;
	try {
		originUrl = new URL(origin);
	} catch {
		return false;
	}

	const forwardedHost = firstForwardedValue(
		request.headers.get("x-forwarded-host"),
	);
	const requestHost = request.headers.get("host");
	const allowedHosts = new Set(
		[requestUrl.host, forwardedHost, requestHost].filter(
			(host): host is string => Boolean(host),
		),
	);

	// Host comparison keeps the CSRF boundary intact while allowing HTTPS to be
	// terminated by a trusted reverse proxy before Astro receives the request.
	return allowedHosts.has(originUrl.host);
}

function shouldCheckFormOrigin(request: Request): boolean {
	if (SAFE_METHODS.has(request.method)) return false;

	const contentType = request.headers.get("content-type");
	return (
		!contentType ||
		FORM_CONTENT_TYPES.some((type) => contentType.toLowerCase().includes(type))
	);
}

export const onRequest = defineMiddleware(async (context, next) => {
	if (
		shouldCheckFormOrigin(context.request) &&
		!isAllowedFormOrigin(context.request, context.url)
	) {
		return new Response(
			`Cross-site ${context.request.method} form submissions are forbidden`,
			{ status: 403 },
		);
	}

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
