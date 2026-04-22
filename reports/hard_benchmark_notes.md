# Hard Benchmark Notes

Last updated: 2026-04-22

## Current Baseline

- Dedupe precision: `0.8912`
- Dedupe recall: `0.9595`
- Dedupe F1: `0.9241`
- Clustering F1 (B-cubed): `0.9627`
- Normalization exact match: `0.8074`

Source of truth:
- `outputs/latest/metrics.json`
- `outputs/latest/error_cases.json`
- `outputs/latest/summary.md`

## Decision Timeline

| Iteration | Change | Precision | Recall | F1 | Main effect | Tradeoff |
| --- | --- | ---: | ---: | ---: | --- | --- |
| 0 | hard-case expansion | 0.7887 | 0.8491 | 0.8178 | benchmark became realistic | exposed many FP/FN |
| 1 | token-set comparison | 0.7443 | 0.9505 | 0.8348 | large recall gain | precision dropped |
| 2 | qualifier guard | 0.7947 | 0.9505 | 0.8656 | reduced qualifier-driven FP | recall flat |
| 3 | abbreviation expansion | 0.7762 | 0.9685 | 0.8617 | fixed abbreviation-heavy FN | precision softened |
| 4 | modifier/core guard | 0.8912 | 0.9595 | 0.9241 | large FP reduction | small recall drop |

## What Is Working

- Order-robust token-set name matching improves recall on reordered names.
- Qualifier-only guard reduces false positives from `SG/Branch/Asia/Systems` expansions.
- Modifier-driven guard reduces false positives where overlap is mostly generic business words.
- Abbreviation expansion closes many short-form misses.

## Remaining Error Patterns

- Branch/region variants can still be ambiguous and occasionally under-merged.
- Some joined/split and morphological variants remain unresolved:
  - `Nova Technology Solutions` vs `NovaTechSolutions`
  - `Silverline Motor Works` vs `Motorworks Silverline`
  - `Bluefin Digi Labs Corp` vs `Digital Labs Bluefin`
- Family-overlap names with shared brand token still require careful scoring.

### Watchlist: Hard Positives Not Yet Auto-Merged (Current Threshold 0.85)

- `Bluefin Digital Corporation` vs `Bluefin Digital`
- `CrestviewEngineering` vs `Crestview Engineering Corporation`
- `Supplies Delta` vs `Delta Supplies`
- `Engineering Crestview` vs `Crestview Engineering`
- `Crestview Engrg Corp` vs `Engineering Crestview`

## Why We Stop Here (For Now)

This state is intentionally treated as a stable checkpoint:

- hard benchmark is strong enough to expose tradeoffs
- fixed regression pairs are in place for fast sanity checks
- next work should be incremental and measurable against this baseline

Checkpoint decision:
- This version is accepted as a practical frozen baseline because it preserves high recall while recovering precision to a deployable demo level.

## Next (Not Done Yet)

- threshold calibration experiments
- more explicit core-token weighting/scoring
- hybrid matching/reranking (if rule-based gains plateau)

Restart priority when work resumes:
1. GitHub packaging/release hygiene for reproducible baseline sharing.
2. Grey-zone adjudication layer for ambiguous pairs (human review or LLM-assisted rerank with strict guardrails).
3. Controlled threshold calibration against the same hard benchmark and regression pairs.
