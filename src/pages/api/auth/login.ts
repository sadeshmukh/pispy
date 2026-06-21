import type { APIRoute } from "astro";

export const GET: APIRoute = ({ redirect }) => {
	const params = new URLSearchParams({
		client_id: import.meta.env.HCA_CLIENT_ID,
		redirect_uri: import.meta.env.HCA_REDIRECT_URI,
		response_type: "code",
		scope: "slack_id",
	});

	return redirect(`https://auth.hackclub.com/oauth/authorize?${params}`);
};
