# Critical Loop 16

## Judge finding

The previous candidate had a usable pilot path but its evidence model was still
too easy to inflate:

- opening the pilot page counted as a started task;
- a new browser session generated a new tester code, so one account could appear
  to be several participants;
- internal testing and external testing were not separated;
- the soft “view the price offer” answer was presented too close to paid-test
  intent;
- pricing exposure itself could still be increased by team QA;
- the English journey switched back to Chinese at the price offer.

Those defects would make the product look stronger while weakening the
credibility of the course evidence.

## Changes

- A study session is created locally on page load but is not recorded until the
  participant clicks **Start the task**.
- Session states are now explicit:
  `started → task_completed → feedback_submitted`, with `abandoned` recorded
  only after a genuine start.
- Participants are deduplicated by a one-way hash of the authenticated account,
  not by the browser-generated tester code.
- Every session and feedback record carries `external` or `team_member`.
- External task and feedback metrics use an explicit database filter; internal
  records remain visible as an excluded count.
- The evaluation centre reports modified, maintained and delayed outcomes
  separately and neutrally.
- “Would view the price offer” is labelled as an attitude answer, not a
  waitlist or revenue event.
- Price-offer exposure and waitlist records now carry the same participant
  relation, and only external records enter conversion metrics.
- CSV exports now include relation, segment, task completion and feedback
  timestamps.
- The full behavioral price offer is localized in English.
- Failed feedback-state synchronization is surfaced rather than silently
  advancing the participant.

## Verification

- Production build completed.
- Automated tests: **111/111** after adding the English offer regression.
- Browser QA completed one full internal journey in English.
- Before clicking Start, the external funnel remained at zero.
- After the internal task and feedback:
  - external starts: `0`;
  - external completions: `0`;
  - external feedback: `0`;
  - internal feedback retained: `1`.
- A separate internal price-offer exposure produced:
  - external exposure: `0`;
  - external waitlist joins: `0`;
  - internal exposure: `1`.
- The rendered evaluation centre explicitly stated that the internal exposure
  and internal feedback were excluded.
- The final English screen showed the complete weekly review offer, trial terms,
  privacy boundary and waitlist action without Chinese fallback text.

## Score discipline

This iteration improves evidence integrity; it does not create external
evidence. The candidate remains below 95 until target users complete the same
flow and create auditable comprehension, repeat-use and waitlist outcomes.
