# Critical Loop 20

## Judge finding

The shared navigation was bilingual, but the stock-research workflow reverted to
Chinese at the exact point where an English evaluator needed to interpret
market data, inspect a chart and continue into a pre-trade review. This was a
task-completion defect, not a cosmetic translation gap.

## Changes

- Localized the stock-research header, global search, live-source status and new
  review action.
- Localized the stock rail, its filters and no-result states.
- Localized the research question, verification path, source status and six
  research tabs.
- Localized the market metric band, chart controls, time ranges, empty states,
  keyboard labels, OHLC hover payload and legend.
- Localized the event-price bridge, original-source action, holding impact and
  non-causality boundary.
- Localized the right-side action panel and the evidence view.
- Preserved Chinese company names, sectors, filing titles and filing summaries
  as source data instead of presenting an invented translation.
- Added a dedicated regression test for the English research and evidence path.

## Browser verification

The English path for `600519` was tested in the real local product:

- the default view exposed English research labels and six English tabs;
- the live metric band showed `1M return`, `vs CSI 300`, `Max drawdown`,
  `Annualized volatility`, `Latest volume` and `Located events`;
- moving over the chart produced a dated tooltip with Open/High, Low/Close,
  Daily change, CSI 300 and Volume;
- switching to 3M changed the data window from 22 to 66 trading days and
  recomputed all metrics;
- expanding the chart changed the component to its expanded state;
- the evidence view exposed English interface controls while retaining the
  original Chinese filing content;
- at a 1600 px viewport, document width remained 1581 px and did not overflow.

## Verification

- Production build completed.
- Automated tests: **112/112**.
- No mock price curve, translated filing or generated financial fact was added.

## Score discipline

This removes a P0 evaluator and international-user blocker. It does not add
external task-completion, retention or willingness-to-pay evidence. The honest
candidate score remains **86/100**.
