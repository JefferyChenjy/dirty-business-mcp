import fs from "node:fs";
import path from "node:path";

import type { EvaluationResult } from "./types.js";

function topInsights(metrics: EvaluationResult): string[] {
  const insights: string[] = [];
  const dedupeF1 = metrics.dedupe.f1;
  const clusterF1 = metrics.clustering.f1;

  if (metrics.dedupe.fp > metrics.dedupe.fn) {
    insights.push("Over-merge tendency detected: false positives are higher than false negatives.");
  } else if (metrics.dedupe.fn > metrics.dedupe.fp) {
    insights.push("Under-merge tendency detected: false negatives are higher than false positives.");
  } else {
    insights.push("Merge behavior is balanced: false positives and false negatives are similar.");
  }

  if (dedupeF1 < 85) {
    insights.push("Dedupe quality is below target (<85 F1); threshold and matching signals need refinement.");
  }

  if (clusterF1 < dedupeF1) {
    insights.push("Cluster quality trails dedupe quality, indicating transitive merge issues.");
  }

  if (metrics.normalization.exact_match_rate < 80) {
    insights.push("Name normalization exact match is low; legal suffix and abbreviation handling should be expanded.");
  }

  return insights;
}

function recommendations(metrics: EvaluationResult): string[] {
  const recs: string[] = [];

  if (metrics.dedupe.precision < 90) {
    recs.push("Increase dedupe threshold (for example 0.88-0.92) to reduce false positives.");
    recs.push("Add stronger domain/phone consistency weighting before accepting duplicate pairs.");
  }

  if (metrics.dedupe.recall < 90) {
    recs.push("Add alias expansion and token normalization rules to improve recall on noisy names.");
    recs.push("Introduce secondary fallback matching for records missing domain/phone.");
  }

  recs.push("Add hard regression fixtures for top false-positive and false-negative pairs from this run.");
  recs.push("Track field-level normalization drift monthly using the same evaluation script and thresholds.");

  return recs;
}

export function generateSummaryReport(evaluation: EvaluationResult): string {
  const fieldsTable = evaluation.fields
    .map(
      (f) =>
        `| ${f.field} | ${f.before_exact_match_rate}% | ${f.after_exact_match_rate}% | ${f.improvement_exact_match_rate}% | ${f.missing_to_filled_rate}% |`,
    )
    .join("\n");

  const topFalsePositives = evaluation.errorAnalysis.falsePositivePairs
    .slice(0, 5)
    .map((p) => `- ${p.left_record_id} (${p.left_name}) vs ${p.right_record_id} (${p.right_name})`)
    .join("\n");

  const topFalseNegatives = evaluation.errorAnalysis.falseNegativePairs
    .slice(0, 5)
    .map((p) => `- ${p.left_record_id} (${p.left_name}) vs ${p.right_record_id} (${p.right_name})`)
    .join("\n");

  const suspiciousMerges = evaluation.errorAnalysis.suspiciousMerges
    .slice(0, 5)
    .map((c) => `- ${c.cluster_id}: truth_ids=${c.truth_entity_ids.join(",")} members=${c.members.length}`)
    .join("\n");

  const insightList = topInsights(evaluation).map((x) => `- ${x}`).join("\n");
  const recommendationList = recommendations(evaluation).map((x) => `- ${x}`).join("\n");

  return `# Summary Report

## Key Metrics

- Dedupe Precision: ${evaluation.dedupe.precision}%
- Dedupe Recall: ${evaluation.dedupe.recall}%
- Dedupe F1: ${evaluation.dedupe.f1}%
- Clustering F1 (B-cubed): ${evaluation.clustering.f1}%
- Normalization Exact Match: ${evaluation.normalization.exact_match_rate}%
- Normalization Fuzzy Similarity Avg: ${evaluation.normalization.fuzzy_similarity_avg}

## Clustering Details

- Cluster Precision (pairwise): ${evaluation.clustering.cluster_precision}%
- Cluster Recall (pairwise): ${evaluation.clustering.cluster_recall}%
- B-cubed Precision: ${evaluation.clustering.bcubed_precision}%
- B-cubed Recall: ${evaluation.clustering.bcubed_recall}%

## Field-level Accuracy

| Field | Before Exact | After Exact | Improvement | Missing->Filled |
|---|---:|---:|---:|---:|
${fieldsTable}

## Insights

${insightList}

## Error Analysis

### Top False Positives
${topFalsePositives || "- None"}

### Top False Negatives
${topFalseNegatives || "- None"}

### Suspicious Merges
${suspiciousMerges || "- None"}

## Recommendations

${recommendationList}
`;
}

export function writeSummaryReport(reportPath: string, content: string): void {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, content, "utf8");
}

