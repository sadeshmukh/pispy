// ───────────────────────────────────────────────────────────────────────────
// Slack DM copy - EDIT FREELY.
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
	// Onboarding approved - they're now in the game, waiting on an assignment.
	onboardingApproved: () =>
		":white_check_mark: Signup/Onboarding complete + Approved! you have successfully handed your data to palantir, ty :earthquakeyeyes:",

	// Onboarding sent back - an admin requested changes before approval. `note`
	// is whatever the admin typed (may be empty).
	changesRequested: (note: string) =>
		`:warning: wergh you gotta fill out the form properly, theres been a problem:\n\n> ${
			note || "Open the app for details pwease."
		}`,

	// A hunt just went live. The hunter learns who they're after and sees every
	// clue in the app; the target only learns that *someone* is now hunting them.
	huntStartedHunter: (targetName: string) =>
		`:dart: GAME START YO Your hunt is live. the target is *${targetName}*.  Go get 'em. ... fast`,
	huntStartedTarget: () =>
		":fear: Someone has been assigned to hunt *you* . You don't get to know who. . :eyes: don't get killed (/silly) (DO NOT HIDE IN THE BATHROOM)",

	// The hunter submitted a capture photo; it's waiting on admin review.
	captureSubmittedHunter: () =>
		":hourglass_flowing_sand: Capture submitted! we'll check it and if its approved, you win and get points!!",

	// Capture confirmed - the find counts and the score is locked in. The hunter
	// gets the win; the target finds out they've been caught and by whom.
	captureApprovedHunter: (targetName: string, score: number) =>
		`:tada: Yippee!! ~Kill~ Confirmed - you caught *${targetName}*! *+${score}* points locked in. :trophy: yayy congrats :3`,
	captureCaughtTarget: (hunterName: string) =>
		`:o7: You've been caught, *${hunterName}* tracked you down. [insert sad lose game music here]`,

	// Capture rejected - not the target, or the photo was unclear. The hunt stays
	// live. `note` is the admin's reason (may be empty).
	captureRejectedHunter: (note: string) =>
		`:x: That capture didn't count, :loll: nice tryy!${
			note ? ` - ${note}` : "."
		} Your hunt is still live, so keep going. :mag: : `,
};
