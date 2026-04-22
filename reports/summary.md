# Summary Report

## Key Metrics

- Dedupe Precision: 100%
- Dedupe Recall: 47.33%
- Dedupe F1: 64.25%
- Clustering F1 (B-cubed): 79.34%
- Normalization Exact Match: 61.5%
- Normalization Fuzzy Similarity Avg: 0.9725

## Clustering Details

- Cluster Precision (pairwise): 100%
- Cluster Recall (pairwise): 54.33%
- B-cubed Precision: 100%
- B-cubed Recall: 65.75%

## Field-level Accuracy

| Field | Before Exact | After Exact | Improvement | Missing->Filled |
|---|---:|---:|---:|---:|
| email | 57.5% | 57.5% | 0% | 0% |
| website | 22.5% | 80% | 57.5% | 0% |
| phone | 10.47% | 61.63% | 51.16% | 0% |

## Insights

- Under-merge tendency detected: false negatives are higher than false positives.
- Dedupe quality is below target (<85 F1); threshold and matching signals need refinement.
- Name normalization exact match is low; legal suffix and abbreviation handling should be expanded.

## Error Analysis

### Top False Positives
- None

### Top False Negatives
- 1 (Alpha Trading Corp) vs 3 (Alpha Trading Corp)
- 2 (Alpha  Trading) vs 3 (Alpha Trading Corp)
- 3 (Alpha Trading Corp) vs 4 (Alpha Trading Corp)
- 9 (CrestviewEngineering) vs 10 (CRESTVIEW ENGINEERING CORPORATION)
- 9 (CrestviewEngineering) vs 11 (crestview engineering corporation)

### Suspicious Merges
- None

## Recommendations

- Add alias expansion and token normalization rules to improve recall on noisy names.
- Introduce secondary fallback matching for records missing domain/phone.
- Add hard regression fixtures for top false-positive and false-negative pairs from this run.
- Track field-level normalization drift monthly using the same evaluation script and thresholds.
