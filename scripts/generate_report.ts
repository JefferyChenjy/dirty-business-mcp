import path from "node:path";

import { PATHS, readJsonFile, writeTextFile } from "./_common.js";

type Metrics = {
  dedupe: { precision: number; recall: number; f1: number };
  clustering: { bcubed_precision: number; bcubed_recall: number; f1: number };
  normalization: { exact_match_rate: number; avg_similarity: number };
  fields: {
    email_exact_match_rate: number;
    website_exact_match_rate: number;
    phone_exact_match_rate: number;
  };
  run_meta: { record_count: number; generated_at_utc: string };
};

type ErrorCases = {
  false_positives: Array<{ left_record_id: string; right_record_id: string; left_name: string; right_name: string }>;
  false_negatives: Array<{ left_record_id: string; right_record_id: string; left_name: string; right_name: string }>;
  suspicious_clusters: Array<{ cluster_id: string; truth_entity_ids: string[]; members: number[] }>;
  worst_normalization_cases: Array<{ record_id: string; raw_name: string; canonical_name: string; similarity: number }>;
};

type EdaSummary = {
  missing_value_rates: {
    before: Record<string, number>;
    after: Record<string, number>;
  };
  duplicate_counts: {
    before: number;
    after: number;
  };
  unique_normalized_names: number;
  top_data_issues: Array<{ issue: string; count: number }>;
};

function pct(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function tableRows(rows: string[][]): string {
  const first = rows[0];
  if (!first) return "_No data_";
  const header = "| " + first.join(" | ") + " |";
  const sep = "| " + first.map(() => "---").join(" | ") + " |";
  const body = rows.slice(1).map((r) => "| " + r.join(" | ") + " |").join("\n");
  return `${header}\n${sep}\n${body}`;
}

export function generateReport(): void {
  const metricsPath = path.join(PATHS.outputsLatest, "metrics.json");
  const errorsPath = path.join(PATHS.outputsLatest, "error_cases.json");
  const edaPath = path.join(PATHS.outputsLatest, "eda_summary.json");

  const metrics = readJsonFile<Metrics>(metricsPath);
  const errors = readJsonFile<ErrorCases>(errorsPath);
  const eda = readJsonFile<EdaSummary>(edaPath);

  const metricsTable = tableRows([
    ["Metric", "Value"],
    ["Dedupe Precision", pct(metrics.dedupe.precision)],
    ["Dedupe Recall", pct(metrics.dedupe.recall)],
    ["Dedupe F1", pct(metrics.dedupe.f1)],
    ["Clustering B-cubed Precision", pct(metrics.clustering.bcubed_precision)],
    ["Clustering B-cubed Recall", pct(metrics.clustering.bcubed_recall)],
    ["Clustering F1", pct(metrics.clustering.f1)],
    ["Normalization Exact Match", pct(metrics.normalization.exact_match_rate)],
    ["Normalization Avg Similarity", metrics.normalization.avg_similarity.toFixed(4)],
  ]);

  const beforeAfterTable = tableRows([
    ["Signal", "Before", "After"],
    ["Missing email", pct(eda.missing_value_rates.before.email ?? 0), pct(eda.missing_value_rates.after.cleaned_email ?? 0)],
    ["Missing website", pct(eda.missing_value_rates.before.website ?? 0), pct(eda.missing_value_rates.after.cleaned_website ?? 0)],
    ["Missing phone", pct(eda.missing_value_rates.before.phone ?? 0), pct(eda.missing_value_rates.after.cleaned_phone ?? 0)],
    ["Duplicate count", String(eda.duplicate_counts.before), String(eda.duplicate_counts.after)],
  ]);

  const topFp = errors.false_positives.slice(0, 5)
    .map((x) => `- ${x.left_record_id} (${x.left_name}) vs ${x.right_record_id} (${x.right_name})`)
    .join("\n") || "- None";

  const topFn = errors.false_negatives.slice(0, 5)
    .map((x) => `- ${x.left_record_id} (${x.left_name}) vs ${x.right_record_id} (${x.right_name})`)
    .join("\n") || "- None";

  const worstNorm = errors.worst_normalization_cases.slice(0, 5)
    .map((x) => `- ${x.record_id}: raw=\`${x.raw_name}\`, canonical=\`${x.canonical_name}\`, similarity=${x.similarity}`)
    .join("\n") || "- None";

  const topIssues = (eda.top_data_issues ?? []).slice(0, 5)
    .map((x) => `- ${x.issue}: ${x.count}`)
    .join("\n") || "- None";

  const interpretation = [
    metrics.dedupe.precision < metrics.dedupe.recall
      ? "- System tends to over-merge less than under-merge."
      : "- System tends to under-merge more than over-merge.",
    metrics.normalization.exact_match_rate < 0.8
      ? "- Name normalization still misses common alias/abbreviation patterns."
      : "- Name normalization is reasonably stable on current sample.",
  ].join("\n");

  const recommendations = [
    "- Add normalization rules for top worst-normalization cases.",
    "- Tune dedupe threshold and/or add fallback signals for missed true duplicates.",
    "- Convert top false negatives into regression fixtures.",
    "- Re-run `npm run flywheel` after every rule update.",
  ].join("\n");

  const md = `# Evaluation Flywheel Summary\n\n## Overview\n- Records: ${metrics.run_meta.record_count}\n- Generated at (UTC): ${metrics.run_meta.generated_at_utc}\n\n## Key Metrics\n${metricsTable}\n\n## Before vs After Data Quality\n${beforeAfterTable}\n\n### Field-level Exact Match\n- Email: ${pct(metrics.fields.email_exact_match_rate)}\n- Website: ${pct(metrics.fields.website_exact_match_rate)}\n- Phone: ${pct(metrics.fields.phone_exact_match_rate)}\n\n### Top Data Issues\n${topIssues}\n\n## Top Error Cases\n### False Positives\n${topFp}\n\n### False Negatives\n${topFn}\n\n### Worst Normalization Cases\n${worstNorm}\n\n## Interpretation\n${interpretation}\n\n## Recommended Next Changes\n${recommendations}\n`;

  writeTextFile(path.join(PATHS.outputsLatest, "summary.md"), md);
  console.log("[report] wrote outputs/latest/summary.md");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateReport();
}
