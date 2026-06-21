import OpenAI from "openai";
import { fetchProfileFields, type ProfileField } from "./profile";

// AI clue generation runs against any OpenAI-compatible endpoint, configured
// entirely through env so the provider/model can be swapped without code change.
// Built lazily so missing config degrades to "no clues" (handled by the caller's
// try/catch) instead of throwing at import time and breaking onboarding.
function getClient(): OpenAI | null {
	const apiKey = import.meta.env.AI_API_KEY;
	if (!apiKey) return null;
	return new OpenAI({ baseURL: import.meta.env.AI_URL, apiKey });
}

export type GeneratedClue = {
	clue: string;
	difficulty: "hard" | "medium" | "easy";
};

const DIFFICULTIES = ["hard", "medium", "easy"] as const;

const SYSTEM_PROMPT = `You help run an in-person scavenger hunt where players try to find a specific other person at an event using clues. You are given two inputs about one person: a free-form self-description they wrote, and a set of verified profile facts (things like where they're from and their interests). Combine both into a short list of concrete, useful clues a hunter could use to recognize and locate them in a crowd.

Rules:
- Each clue must be one short, factual statement (appearance, where they're from, habits, where they hang out, hobbies, distinctive items, vibe).
- Treat the profile facts as true. Location is a strong clue — include it when present.
- Prefer specific, observable things over vague personality traits.
- Do not invent details that are not supported by the inputs. Ignore anything that wouldn't help recognize someone in person.
- Rate each clue's difficulty for narrowing down who it is: "easy" = very identifying, "medium" = somewhat, "hard" = barely narrows it down.
- Return 3 to 7 clues. If the inputs are thin, return as many good clues as you can.
- Respond ONLY with JSON of the form {"clues":[{"clue":"...","difficulty":"easy|medium|hard"}]}.`;

// Turn a free-form self-description plus verified profile facts into structured
// clues. Returns [] on any failure (network, bad key, malformed output) so
// onboarding never blocks on the AI — an admin can regenerate later.
export async function generateClues(
	aboutText: string,
	displayName: string,
	profile: ProfileField[] = [],
): Promise<GeneratedClue[]> {
	const text = aboutText.trim();
	// Nothing to work with — no self-description and no usable profile facts.
	if (!text && profile.length === 0) return [];

	const client = getClient();
	if (!client) {
		console.warn("generateClues skipped: AI_API_KEY is not set");
		return [];
	}

	const sections = [`Name: ${displayName}`];
	if (profile.length > 0) {
		sections.push(
			"Verified profile facts:\n" +
				profile.map((f) => `- ${f.label}: ${f.value}`).join("\n"),
		);
	}
	if (text) {
		sections.push("What they wrote about themselves:\n" + text);
	}

	try {
		const completion = await client.chat.completions.create({
			model: import.meta.env.AI_MODEL,
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{ role: "user", content: sections.join("\n\n") },
			],
			response_format: { type: "json_object" },
			temperature: 0.4,
		});

		const raw = completion.choices[0]?.message?.content;
		if (!raw) return [];

		const parsed = JSON.parse(raw) as { clues?: unknown };
		if (!Array.isArray(parsed.clues)) return [];

		return parsed.clues
			.map((c): GeneratedClue | null => {
				if (!c || typeof c !== "object") return null;
				const clue = String((c as Record<string, unknown>).clue ?? "").trim();
				if (!clue) return null;
				const rawDifficulty = String(
					(c as Record<string, unknown>).difficulty ?? "medium",
				);
				const difficulty = (DIFFICULTIES as readonly string[]).includes(
					rawDifficulty,
				)
					? (rawDifficulty as GeneratedClue["difficulty"])
					: "medium";
				return { clue, difficulty };
			})
			.filter((c): c is GeneratedClue => c !== null)
			.slice(0, 10);
	} catch (error) {
		console.error("generateClues failed:", error);
		return [];
	}
}

// Replace the AI-generated clues for a user with a freshly generated set, drawn
// from both their self-description and their verified profile fields. User-
// written custom clues (source = 'user') are left untouched.
export async function regenerateAiClues(
	db: import("@libsql/client").Client,
	slack_id: string,
	aboutText: string,
	displayName: string,
): Promise<number> {
	const profile = await fetchProfileFields(slack_id);
	const clues = await generateClues(aboutText, displayName, profile);
	await db.execute({
		sql: `DELETE FROM custom_clues WHERE slack_id = ? AND source = 'ai'`,
		args: [slack_id],
	});
	for (const { clue, difficulty } of clues) {
		await db.execute({
			sql: `INSERT INTO custom_clues (slack_id, clue, difficulty, source) VALUES (?, ?, ?, 'ai')`,
			args: [slack_id, clue, difficulty],
		});
	}
	return clues.length;
}
