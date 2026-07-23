# Critical Loop 13

## Critical finding

The candidate had two presentation defects that would reduce trust in a course demo:

- switching to English localized the shell but not the evidence center;
- the deployed chart looked like a static line, even though investors expect exact readings, time ranges and inspection controls.

## Changes

- Localized the complete course evidence center and all three live evaluation runners.
- Added locale-derived idle states to prevent Chinese copy from surviving an English hydration pass.
- Rebuilt the default stock chart as an inspectable research surface:
  - K-line and line modes;
  - MA5, MA20 and volume toggles;
  - 20/60/120-day windows;
  - compact, standard and wide layouts;
  - full-screen mode;
  - hover crosshair with date, daily change, OHLC, amplitude, moving averages and volume;
  - click-to-pin and keyboard day navigation;
  - filing marker and source linkage.

## Evidence

- Automated tests: **108/108 passed**.
- Browser hover on the 2026-06-12 point returned:
  - change +1.03%;
  - open 1243.16;
  - high 1266.98;
  - low 1236.99;
  - close 1263.89;
  - amplitude 2.42%;
  - MA5 1245.13;
  - MA20 1263.63;
  - volume 50,495.
- Click-to-pin persisted after the pointer left the chart.
- Full-screen chart measured 1568 × 868 in the test viewport and exited cleanly.
- Evaluation center English checks passed for all major sections; the page had no horizontal overflow.

## Score discipline

This improves demo clarity and research usability but does not add external user, retention or payment evidence. The unpublished engineering candidate remains **86/100**, rather than receiving an artificial score increase for localization or visual polish alone.
