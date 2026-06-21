// ───────────────────────────────────────────────────────────────────────────
// Slack DM copy — EDIT FREELY.
//
// These are the exact messages players receive at each stage of a hunt. To
// reword a message, just change the text inside the quotes. The values shown as
// function arguments (targetName, score, note, …) are filled in automatically
// when the DM is sent, so keep the ${...} placeholders where you want them to
// appear.
//
// Slack formatting works here: *bold*, _italic_, `code`, :emoji:, line breaks
// with \n, and <@U0123ABCD> to @-mention a user by their Slack ID.
// ───────────────────────────────────────────────────────────────────────────

export const messages = {
	// Onboarding approved — they're now in the game, waiting on an assignment.
	onboardingApproved: () =>
		":white_check_mark: You're in! Sit tight — your target is coming soon. :eyes:",

	// Onboarding sent back — an admin requested changes before approval. `note`
	// is whatever the admin typed (may be empty).
	changesRequested: (note: string) =>
		`:warning: Your submission needs a few changes before you're in:\n\n> ${
			note || "Open the app for details."
		}`,

	// A hunt just went live. The hunter learns who they're after and sees every
	// clue in the app; the target only learns that *someone* is now hunting them.
	huntStartedHunter: (targetName: string) =>
		`:dart: Your hunt is live — your target is *${targetName}*. All their clues are in the app. The clock's ticking, and your score drops the longer it takes. Go get 'em. :camera_with_flash:`,
	huntStartedTarget: () =>
		":fear: Someone has been assigned to hunt *you*. You don't get to know who. Watch your back. :eyes:",

	// The hunter submitted a capture photo; it's waiting on admin review.
	captureSubmittedHunter: () =>
		":hourglass_flowing_sand: Capture submitted! An admin is reviewing your photo — you'll hear back right here.",

	// Capture confirmed — the find counts and the score is locked in. The hunter
	// gets the win; the target finds out they've been caught and by whom.
	captureApprovedHunter: (targetName: string, score: number) =>
		`:tada: Confirmed — you caught *${targetName}*! *+${score}* points locked in. :trophy:`,
	captureCaughtTarget: (hunterName: string) =>
		`:dizzy_face: You've been caught — *${hunterName}* tracked you down. Open the app for the reveal.`,

	// Capture rejected — not the target, or the photo was unclear. The hunt stays
	// live. `note` is the admin's reason (may be empty).
	captureRejectedHunter: (note: string) =>
		`:x: That capture didn't count${
			note ? ` — ${note}` : "."
		} Your hunt is still live, so keep going. :mag:`,
};
