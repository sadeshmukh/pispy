// @ts-check

import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";

export default defineConfig({
	output: "server",
	adapter: node({
		mode: "standalone",
	}),
	// The standalone Node adapter builds request URLs from the internal HTTP
	// socket, so Astro's built-in origin check sees http:// behind our HTTPS
	// reverse proxy. src/middleware.ts performs the equivalent proxy-aware check.
	security: {
		checkOrigin: false,
	},

	vite: {
		plugins: [tailwindcss()],
	},
});
