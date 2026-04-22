```md
# dirty-business-mcp

Clean and deduplicate messy business data using a rule-based entity resolution system with a reproducible evaluation flywheel.

---

## 🧪 Example

Input:

- "CrestviewEngineering"
- "Engineering Crestview"
- "Crestview Engineering SG"

Output:

- "CrestviewEngineering" ↔ "Engineering Crestview" → **match**
- "Crestview Engineering SG" → **separate entity** (region qualifier)

→ clustered entities with confidence scoring

---

## 🚧 The problem

Business data is messy:

- duplicate companies across sources  
- inconsistent naming (Intl vs International)  
- token reordering (Engineering Crestview vs Crestview Engineering)  
- region/branch variants (SG, Asia, Branch)  
- near-collision names (Falcon Marine vs Falcon Marine Systems)  

Naive string matching fails.

---

## ⚙️ What this project does

This project implements a **rule-based entity resolution system** that:

- normalizes company names (suffix, abbreviation, token expansion)
- deduplicates records using token-aware matching
- clusters entities
- evaluates results against a **hard-case benchmark**
- iterates via a **reproducible evaluation flywheel**

---

## 🔁 Evaluation flywheel

```

raw data → normalize → dedupe → cluster → evaluate → error cases → improve → repeat

````

---

## ⚡ Quickstart

```bash
npm install
npm run flywheel
````

Outputs:

```
outputs/latest/
  metrics.json
  error_cases.json
  summary.md
```

---

## 🧪 Flywheel Commands

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

**Command meanings:**

* `pipeline`: clean + normalize + cluster
* `evaluate`: compare vs gold truth → metrics + error cases
* `eda`: generate dataset diagnostics
* `report`: human-readable summary
* `snapshot`: save run history
* `flywheel`: full loop (pipeline → evaluate → eda → report)
* `ci:flywheel`: CI-safe run
* `regression:pairs`: fixed high-value dedupe checks

---

## 📊 Hard Benchmark Baseline (Current)

Measured on a **hard synthetic dataset** including:

* abbreviation variants
* token reordering
* join/split forms
* adversarial negatives

| Metric              |  Value |
| ------------------- | -----: |
| Precision           | 0.8912 |
| Recall              | 0.9595 |
| F1                  | 0.9241 |
| Clustering F1       | 0.9627 |
| Normalization Match | 0.8074 |

Reference: `outputs/latest/metrics.json`

---

## 🧠 Key Techniques

* token-set canonical matching (order-robust)
* abbreviation & token expansion (`intl`, `solns`, `engrg`, etc.)
* concatenated-word splitting (`NovaTechSolutions`)
* qualifier guard (`sg`, `branch`, `asia`, `systems`)
* core-token vs modifier-token separation
* error-driven iteration via evaluation flywheel

---

## 📂 Project Structure

```
data/raw/          # dirty + gold datasets
scripts/           # pipeline / evaluate / eda / report
src/               # normalization + dedupe logic
outputs/           # generated artifacts (ignored in git)
reports/           # benchmark notes and analysis
```

---

## 📥 Input Data

Required:

```
data/raw/dirty_business_data_200.csv
data/raw/dirty_business_gold_200.csv
```

Scripts fail fast if missing.

---

## 📤 Output Artifacts

After `npm run flywheel`:

```
outputs/latest/
  cleaned_records.csv
  quality_scores.csv
  clusters.json
  metrics.json
  error_cases.json
  eda_summary.json
  summary.md
```

Snapshots:

```
outputs/history/<timestamp>/
```

---

## 🔄 CI / GitHub Actions

Workflow: `.github/workflows/eval-flywheel.yml`

* runs on push / PR
* executes full flywheel
* validates metrics schema
* uploads artifacts
* enforces quality gate

Quality gate:

```
dedupe precision >= 0.70
```

---

## ⚙️ Threshold Tuning

```bash
CLUSTER_THRESHOLD=0.88 DEDUPE_MIN_SCORE=0.88 npm run flywheel
```

Inspect:

* `metrics.json`
* `error_cases.json`
* `summary.md`

---

## 🧩 Current Rule Capabilities

* suffix normalization (`inc`, `corp`, `ltd`, etc.)
* abbreviation expansion
* token-set comparison
* qualifier guard
* modifier-token guard

---

## ⚠️ Known Residual Error Patterns

* branch/region ambiguity (SG / Asia)
* join/split + synonym edge cases
* brand overlap with different modifiers
* borderline cases intentionally left conservative

See:

```
reports/hard_benchmark_notes.md
```

---

## 🚀 Next Directions (Planned)

* LLM hybrid for grey-zone adjudication
* larger real-world datasets
* API / MCP integration
* threshold calibration

---

## 🧠 Why this project

Most demos stop at “it works”.

This project focuses on:

* hard-case evaluation
* precision vs recall tradeoffs
* repeatable iteration loop
* explainable rule-based baseline

---

## 🧪 MCP / CLI

```bash
npm run build
npm run start
```

CLI:

```bash
npm run cli -- normalize examples/sample.csv
npm run cli -- dedupe examples/sample.csv
npm run cli -- clean examples/sample.csv --out /tmp/cleaned.json
```

```
