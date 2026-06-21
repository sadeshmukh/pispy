// @ts-check

import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import node from "@astrojs/node";

export default defineConfig({
	output: "server",
	adapter: node({
		mode: "standalone",
	}),

	vite: {
		plugins: [tailwindcss()],
	},
});
