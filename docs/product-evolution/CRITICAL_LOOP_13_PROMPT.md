# Critical Loop 13 — Evidence language and research-chart usability

Act as a critical HKUST AI Startup Course judge and a real desktop investor.

Do not add another financial feature. Inspect two trust-breaking defects:

1. English navigation and headings must not lead into a Chinese-only evidence body.
2. The default stock chart must behave like a research tool, not a static illustration.

Required changes:

- localize the evaluation baseline, model evaluation, Agent evaluation, data-source sampling, funnel, user evidence, pricing experiment and next-step evidence gates;
- keep raw Chinese model output and Chinese source proper names only where they are the underlying evidence;
- derive initial runner messages from the current locale so hydration cannot leave a stale Chinese message;
- add chart crosshair and daily OHLC, change, amplitude, MA5, MA20 and volume values;
- support click-to-pin, keyboard day navigation, K-line/line mode, 20/60/120-day ranges, three chart sizes and a full-screen view;
- keep event markers and official-source links connected to the chart;
- do not claim this work proves retention or payment.

Acceptance:

- browser verification in Chinese and English;
- no horizontal overflow;
- real mouse hover produces exact values;
- full-screen view can enter and exit;
- complete automated test suite passes.
