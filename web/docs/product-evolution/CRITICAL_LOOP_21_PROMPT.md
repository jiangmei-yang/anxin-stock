# Critical Loop 21 — Complete the bilingual research dossier

## Judge finding

The English stock-research route looks complete at the shell level, but four of its six research views still expose Chinese-only controls, labels and system explanations. This is a product-integrity problem, not a cosmetic one: an English user can enter the route but cannot reliably understand the financial, quantitative or decision workflow.

## Required correction

1. Audit all six research views in English, including loading, empty, error and expanded states.
2. Translate interface controls, rule explanations, status labels, accessibility names and decision actions.
3. Preserve company names, filing titles and source excerpts in their original language when no verified translation exists.
4. Clearly distinguish source-language content from English system interpretation.
5. Keep missing data visible as unavailable; do not manufacture translated conclusions or peer rankings.
6. Verify every tab in a real browser and check for horizontal overflow.
7. Add regression assertions for the financial, quantitative, overview and open-question surfaces.

## Acceptance criteria

- Every research tab is discoverable and operable in English.
- Financial checks explain formulas, thresholds and limitations in English.
- Quant verification distinguishes demo samples from live market data.
- Overview and open questions no longer revert to Chinese interface text.
- Original source content remains attributable.
- Existing Chinese behaviour and all automated tests remain intact.
