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
	// A new item entered an admin review queue.
	adminOnboardingSubmitted: (displayName: string, slackId: string) =>
		`[ADMIN] :eyes: New onboarding submlission from *${displayName}* (<@${slackId}>) is ready to review in pispy.`,
	adminCaptureSubmitted: (
		hunterName: string,
		hunterId: string,
		targetName: string,
	) =>
		`[ADMIN] :camera_with_flash: New capture from *${hunterName}* (<@${hunterId}>) claiming *${targetName}* is ready to review in pispy.`,

	// Onboarding approved - they're now in the game, waiting on an assignment.
	onboardingApproved: () =>
		":white_check_mark: Signup/Onboarding complete + Approved! you have successfully handed your data to palantir, ty :earthquakeyeyes:",

	// Onboarding sent back - an admin requested changes before approval. `note`
	// is whatever the admin typed (may be empty).
	changesRequested: (note: string) =>
		`:warning: wergh you gotta fill out the form properly, theres been a problem:\n\n> ${
			note || "Open the app for details pwease."
		}`,

	// A target has been assigned, but the timer has not started yet. Only the
	// hunter receives this; the target is told once the hunt actually begins.
	huntReadyHunter: () =>
		":eyes: Your hunt is ready to start! Open pispy when you're ready to begin. The timer won't start until you press *Start hunt*.",

	// A hunt just went live. The hunter learns who they're after and sees every
	// clue in the app; the target only learns that *someone* is now hunting them.
	huntStartedHunter: (targetName: string) =>
		`:dart: GAME START YO Your hunt is live. the target is *${targetName}*.  Go get 'em. ... fast`,
	huntStartedTarget: () =>
		":fear: Someone has been assigned to hunt *you* . You don't get to know who. . :eyes: don't get killed (/silly) (DO NOT HIDE IN THE BATHROOM)",
	huntScoreThreshold: (points: number) => {
		if (points === 100) {
			return ":rotating_light: Only *100 points* remain. You have 100 seconds before this hunt is worth zero points - quickkk go go go!";
		}
		if (points === 250) {
			return ":warning: Your hunt is down to *250 points*. Time is disappearing fast. just find your target!";
		}
		return `:alarm_clock: Your hunt is down to *${points} points*. Half your starting score is gone - move it! come on`;
	},

	// The hunter submitted a capture photo; it's waiting on admin review.
	captureSubmittedHunter: () =>
		":eyes: Capture submitted! :bangbang: we'll check it and if its approved, you win and get points!!",

	// Capture confirmed - the find counts and the score is locked in. The hunter
	// gets the win; the target finds out they've been caught and by whom.
	captureApprovedHunter: (targetName: string, score: number) =>
		`:tada: Yippee!! ~Kill~ Confirmed - you caught *${targetName}*! *+${score}* points locked in. :trophy: yayy congrats :3`,
	captureCaughtTarget: (hunterName: string) =>
		`:o7: You've been caught, *${hunterName}* tracked you down. [insert sad lose game music here]`,

	// Capture rejected - not the target, or the photo was unclear. The hunt stays
	// live. `note` is the admin's reason (may be empty).
	captureRejectedHunter: (note: string) =>
		`:x: That capture didn't count, :loll: nice tryy! \n${
			note ? `>  ${note}` : "."
		} Your hunt is still live, so keep going. :mag: : `,
};
