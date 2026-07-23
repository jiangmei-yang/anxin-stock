# Critical Loop 15

## Judge finding

The previous 90-second demonstration forced the participant to either reduce
the planned amount or delay the decision. It did not permit a neutral
“maintain the plan” outcome. This could artificially inflate the behavior-change
metric and would not survive a skeptical course review.

The pilot page also exposed the pricing experiment without first giving an
external participant one complete, measurable task.

## Changes

- Added “maintain the original plan” as an equal third outcome.
- Kept all three outcomes neutral and preserved their before/after values.
- Built a single pilot journey:
  - participant segment;
  - reproducible review task;
  - three short feedback steps;
  - separate pricing offer and waitlist action.
- Added anonymous session start, completion and abandonment records.
- Added explicit comprehension, risk restatement, repeat-intent and consent
  fields with no preselected answer.
- Separated the soft “view the price” answer from the behavioral waitlist
  event.
- Preserved the ban on names, contact details, brokerage credentials and real
  account data.

## Verification

- Production build completed.
- Automated tests: **110/110**.
- The existing interactive stock chart was browser-verified with real public
  market data:
  - hover returned date, OHLC, daily change, range, MA5, MA20, CSI 300 and volume;
  - the wide mode changed the rendered chart from roughly `840 × 336` to
    `1150 × 587`;
  - the chart retained event, source, benchmark and freshness context.

## Score discipline

This creates a valid external-testing funnel; it does not create external
evidence. The candidate remains below 95 until target users complete the task
and produce auditable comprehension, behavior and waitlist outcomes.

