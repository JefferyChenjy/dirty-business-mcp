import path from "node:path";

import { fuzzy } from "fast-fuzzy";

import type { EntityCluster, Record as BusinessRecord } from "../src/types.js";
import { dedupe_records, normalize_company_name } from "../src/tools/index.js";
import { evaluateAgainstGold } from "../src/evaluation/metrics.js";
import type { CleanedRow, DirtyRow, GoldRow, PipelineResult } from "../src/evaluation/types.js";
import {
  PATHS,
  ensureFile,
  readCsvFile,
  readJsonFile,
  sortByNumericId,
  writeJsonFile,
} from "./_common.js";

const DEDUPE_MIN_SCORE = Number(process.env.DEDUPE_MIN_SCORE ?? "0.85");
const DEDUPE_PRECISION_GATE = Number(process.env.DEDUPE_PRECISION_GATE ?? "0.70");
const ERROR_CASE_LIMIT = Number(process.env.ERROR_CASE_LIMIT ?? "20");

function toToolRecord(row: CleanedRow): BusinessRecord {
  return {
    id: row.record_id,
    name: row.name,
    normalized_name: row.normalized_name,
    phone: row.cleaned_phone,
    email: row.cleaned_email,
    website: row.cleaned_website,
    address: row.address,
  };
}

function pctToRatio(valuePct: number): number {
  return Number((valuePct / 100).toFixed(6));
}

function fieldAfterRate(fields: Array<{ field: string; after_exact_match_rate: number }>, key: string): number {
  const found = fields.find((f) => f.field === key);
  return pctToRatio(found?.after_exact_match_rate ?? 0);
}

function buildWorstNormalizationCases(cleanedRows: CleanedRow[], goldRows: GoldRow[]) {
  const goldMap = new Map(goldRows.map((g) => [g.entity_id, g]));

  const worst = cleanedRows
    .map((row) => {
      const gold = goldMap.get(row.entity_id_truth);
      const canonical = normalize_company_name({ name: gold?.canonical_name ?? "" }).normalized;
      const pred = normalize_company_name({ name: row.normalized_name ?? row.name ?? "" }).normalized;
      const similarity = fuzzy(canonical, pred);
      return {
        record_id: row.record_id,
        entity_id_truth: row.entity_id_truth,
        raw_name: row.name,
        normalized_name: row.normalized_name,
        canonical_name: canonical,
        similarity: Number(similarity.toFixed(4)),
      };
    })
    .sort((a, b) => a.similarity - b.similarity)
    .slice(0, ERROR_CASE_LIMIT);

  return worst;
}

export function runEvaluate(): void {
  const cleanedPath = path.join(PATHS.outputsLatest, "cleaned_records.csv");
  const clustersPath = path.join(PATHS.outputsLatest, "clusters.json");

  ensureFile(PATHS.dirtyCsv);
  ensureFile(PATHS.goldCsv);
  ensureFile(cleanedPath);
  ensureFile(clustersPath);

  console.log("[evaluate] loading datasets...");
  const dirtyRows = sortByNumericId(readCsvFile<DirtyRow>(PATHS.dirtyCsv));
  const goldRows = readCsvFile<GoldRow>(PATHS.goldCsv);
  const cleanedRows = sortByNumericId(readCsvFile<CleanedRow>(cleanedPath));
  const clusters = readJsonFile<EntityCluster[]>(clustersPath);

  const dedupeMatches = dedupe_records({
    records: cleanedRows.map(toToolRecord),
    min_score: DEDUPE_MIN_SCORE,
    default_country: "SG",
  });

  const pipelineResult: PipelineResult = {
    dirtyRows,
    goldRows,
    cleanedRows,
    dedupeMatches,
    clusters,
    qualityScores: [],
    thresholds: {
      dedupeMinScore: DEDUPE_MIN_SCORE,
      clusterThreshold: Number(process.env.CLUSTER_THRESHOLD ?? "0.85"),
    },
  };

  const evaluation = evaluateAgainstGold(pipelineResult);

  const metrics = {
    dedupe: {
      precision: pctToRatio(evaluation.dedupe.precision),
      recall: pctToRatio(evaluation.dedupe.recall),
      f1: pctToRatio(evaluation.dedupe.f1),
    },
    clustering: {
      bcubed_precision: pctToRatio(evaluation.clustering.bcubed_precision),
      bcubed_recall: pctToRatio(evaluation.clustering.bcubed_recall),
      f1: pctToRatio(evaluation.clustering.f1),
    },
    normalization: {
      exact_match_rate: pctToRatio(evaluation.normalization.exact_match_rate),
      avg_similarity: Number(evaluation.normalization.fuzzy_similarity_avg.toFixed(6)),
    },
    fields: {
      email_exact_match_rate: fieldAfterRate(evaluation.fields, "email"),
      website_exact_match_rate: fieldAfterRate(evaluation.fields, "website"),
      phone_exact_match_rate: fieldAfterRate(evaluation.fields, "phone"),
    },
    run_meta: {
      record_count: dirtyRows.length,
      generated_at_utc: new Date().toISOString(),
    },
  };

  const errorCases = {
    false_positives: evaluation.errorAnalysis.falsePositivePairs.slice(0, ERROR_CASE_LIMIT),
    false_negatives: evaluation.errorAnalysis.falseNegativePairs.slice(0, ERROR_CASE_LIMIT),
    suspicious_clusters: evaluation.errorAnalysis.suspiciousMerges.slice(0, ERROR_CASE_LIMIT),
    worst_normalization_cases: buildWorstNormalizationCases(cleanedRows, goldRows),
  };

  writeJsonFile(path.join(PATHS.outputsLatest, "metrics.json"), metrics);
  writeJsonFile(path.join(PATHS.outputsLatest, "error_cases.json"), errorCases);

  console.log("[evaluate] wrote outputs/latest/metrics.json");
  console.log("[evaluate] wrote outputs/latest/error_cases.json");
  console.log(`[evaluate] dedupe precision=${metrics.dedupe.precision} recall=${metrics.dedupe.recall} f1=${metrics.dedupe.f1}`);

  const isCi = process.env.CI === "true";
  if (isCi && metrics.dedupe.precision < DEDUPE_PRECISION_GATE) {
    throw new Error(
      `Quality gate failed: dedupe precision ${metrics.dedupe.precision} < ${DEDUPE_PRECISION_GATE}`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runEvaluate();
}
