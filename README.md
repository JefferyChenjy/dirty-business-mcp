# dirty-business-mcp

`dirty-business-mcp` is a TypeScript project for cleaning and deduplicating messy business/company data.

It includes:
- MCP server tools
- CLI (`dirtybiz`)
- repeatable evaluation flywheel (pipeline + evaluate + EDA + report + snapshot)

## Stack
- Node.js >= 18
- TypeScript
- papaparse
- fast-fuzzy
- lodash
- libphonenumber-js
- tldts
- zod

Python is **not required** for the current Node/TypeScript flywheel.

## Directory Structure

```text
dirty-business-mcp/
  .github/
    workflows/
      eval-flywheel.yml

  data/
    raw/
      dirty_business_data_200.csv
      dirty_business_gold_200.csv

  outputs/
    latest/
      cleaned_records.csv
      quality_scores.csv
      clusters.json
      metrics.json
      error_cases.json
      eda_summary.json
      summary.md
    history/
      .gitkeep

  reports/
    templates/
      summary_template.md

  scripts/
    _common.ts
    run_pipeline.ts
    evaluate.ts
    eda.ts
    generate_report.ts
    save_run_snapshot.ts

  src/
    ... MCP + tools ...
```

## Quickstart

```bash
npm install
npm run flywheel
```

## Flywheel Commands

```bash
npm run pipeline
npm run evaluate
npm run eda
npm run report
npm run snapshot
npm run flywheel
npm run ci:flywheel
npm run regression:pairs
```

Command meanings:
- `pipeline`: clean + normalize + cluster; writes base artifacts
- `evaluate`: compare vs gold truth; writes `metrics.json` and `error_cases.json`
- `eda`: generate `eda_summary.json`
- `report`: generate `outputs/latest/summary.md`
- `snapshot`: copy latest outputs to `outputs/history/<UTC timestamp>/`
- `flywheel`: full local sequence (`pipeline -> evaluate -> eda -> report`)
- `ci:flywheel`: CI-safe full sequence
- `regression:pairs`: run fixed high-value dedupe pair checks

## Input Data

Required files:
- `data/raw/dirty_business_data_200.csv`
- `data/raw/dirty_business_gold_200.csv`

Scripts fail fast if required inputs are missing.

## Output Artifacts

After `npm run flywheel`, outputs are written to:

`outputs/latest/`
- `cleaned_records.csv`
- `quality_scores.csv`
- `clusters.json`
- `metrics.json`
- `error_cases.json`
- `eda_summary.json`
- `summary.md`

Snapshot command creates:

`outputs/history/YYYYMMDD_HHmmssZ/`
- full copy of all files from `outputs/latest`

## CI / GitHub Actions

Workflow: `.github/workflows/eval-flywheel.yml`

Triggers:
- push to `main`
- pull request
- manual dispatch

Workflow steps:
1. `npm ci`
2. `npm run ci:flywheel`
3. validate `outputs/latest/metrics.json`
4. print key metrics in logs
5. append compact metrics table to job summary
6. upload `outputs/latest` as artifact

Quality gate:
- CI fails if dedupe precision `< 0.70`
- configurable via env var `DEDUPE_PRECISION_GATE`

## Threshold Tuning

You can tune thresholds via env vars:

```bash
CLUSTER_THRESHOLD=0.88 DEDUPE_MIN_SCORE=0.88 npm run flywheel
```

Then inspect:
- `outputs/latest/metrics.json`
- `outputs/latest/error_cases.json`
- `outputs/latest/summary.md`

## Hard Benchmark Baseline (Current)

Reference run (`outputs/latest/metrics.json`, generated at `2026-04-22T01:02:16.694Z`):

- Dedupe precision: `0.8912`
- Dedupe recall: `0.9595`
- Dedupe F1: `0.9241`
- Clustering F1 (B-cubed): `0.9627`
- Normalization exact match: `0.8074`

This is the current hard-benchmark baseline for future changes.

## Current Rule Capabilities

Current matcher/normalizer behavior includes:

- legal suffix cleanup (`inc`, `corp`, `ltd`, `sendirian berhad`, etc.)
- abbreviation expansion (`intl`, `solns`, `engrg`, `pkg`, `pkgrs`, `analytx`, etc.)
- concatenated-word splitting (`CrestviewEngineering` style)
- token-set canonical comparison (order-robust name signal)
- qualifier-only expansion guard (`sg`, `branch`, `asia`, `systems`)
- modifier-driven similarity guard for generic business-word overlap

## Known Residual Error Patterns

Main remaining misses/collisions from hard benchmark:

- branch/region variants that may be true duplicate but are currently guarded as ambiguous
- join/split + synonym edge cases like:
  - `Nova Technology Solutions` vs `NovaTechSolutions`
  - `Silverline Motor Works` vs `Motorworks Silverline`
  - `Bluefin Digi Labs Corp` vs `Digital Labs Bluefin`
- family-overlap patterns where brand token is shared and business modifiers differ

## Next Directions (Planned, Not Implemented Yet)

To avoid scope creep, these are explicitly deferred:

- threshold tuning and calibration
- richer core-token weighting (beyond current minimal guard)
- hybrid scorer (rule + learned/LLM-assisted rerank)
- broader hard-benchmark expansion and class-balanced slices

Rationale: keep current baseline stable first, then iterate one controlled change at a time.

Detailed iteration-by-iteration decision log is tracked in:
- `reports/hard_benchmark_notes.md`

## MCP / CLI (existing)

Build and start MCP server:

```bash
npm run build
npm run start
```

CLI examples:

```bash
npm run cli -- normalize examples/sample.csv
npm run cli -- dedupe examples/sample.csv
npm run cli -- clean examples/sample.csv --out /tmp/cleaned.json
```
