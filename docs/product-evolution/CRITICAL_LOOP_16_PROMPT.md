# Critical Loop 16 Prompt

Act as a skeptical HKUST course judge and evidence auditor. Do not add product
features. Audit whether the current evaluation centre can be manipulated by
opening pages repeatedly, using a fresh browser session, submitting internal
team feedback, or answering a soft pricing question.

Required changes:

1. Opening the pilot page must not count as starting the task.
2. A task starts only after the participant explicitly clicks the start action.
3. Task completion and feedback submission must be separate events.
4. The same authenticated account must not become multiple participants by
   receiving a fresh session code.
5. Every task, feedback and pricing record must distinguish external
   participants from team or internal tests.
6. Authoritative course metrics must include external records only, while
   retaining a visible count of excluded internal records.
7. Maintaining, modifying and delaying a decision must be equally valid
   outcomes.
8. “Would view a price offer” is an attitude answer, not waitlist or revenue
   evidence.
9. Pricing exposure and waitlist actions must also exclude internal tests.
10. The complete pilot and price offer must work in Chinese and English.
11. Exported CSV files must preserve relation, segment and event timestamps for
    manual audit.
12. Add regression coverage, run the complete suite, and verify one end-to-end
    internal browser journey without allowing it to change external metrics.

Do not claim external validation when the external sample is zero.
