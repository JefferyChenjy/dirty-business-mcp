import { fuzzy } from "fast-fuzzy";
import _ from "lodash";

import { normalize_company_name, normalize_contact_fields } from "../tools/index.js";
import type { EvaluationResult, GoldRow, PairwiseMetrics, PipelineResult } from "./types.js";

function safeDiv(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

function f1(precision: number, recall: number): number {
  return precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
}

function pairKey(i: number, j: number): string {
  return i < j ? `${i}|${j}` : `${j}|${i}`;
}

function percent(value: number): number {
  return Number((value * 100).toFixed(2));
}

function normalizeComparable(value?: string): string {
  return (value ?? "").trim().toLowerCase();
}

function buildTruthPairSet(entityIds: string[]): Set<string> {
  const pairSet = new Set<string>();
  for (let i = 0; i < entityIds.length; i += 1) {
    for (let j = i + 1; j < entityIds.length; j += 1) {
      if (entityIds[i] === entityIds[j]) {
        pairSet.add(pairKey(i, j));
      }
    }
  }
  return pairSet;
}

function buildPredictedPairSetFromMatches(matches: Array<{ record_i: number; record_j: number }>): Set<string> {
  return new Set(matches.map((m) => pairKey(m.record_i, m.record_j)));
}

function buildPredictedPairSetFromClusters(clusterIds: string[]): Set<string> {
  const pairSet = new Set<string>();
  for (let i = 0; i < clusterIds.length; i += 1) {
    for (let j = i + 1; j < clusterIds.length; j += 1) {
      if (clusterIds[i] === clusterIds[j]) {
        pairSet.add(pairKey(i, j));
      }
    }
  }
  return pairSet;
}

function calculatePairwiseMetrics(predicted: Set<string>, truth: Set<string>): PairwiseMetrics {
  let tp = 0;
  for (const pair of predicted) {
    if (truth.has(pair)) tp += 1;
  }
  const fp = predicted.size - tp;
  const fn = truth.size - tp;

  const precision = safeDiv(tp, tp + fp);
  const recall = safeDiv(tp, tp + fn);

  return {
    tp,
    fp,
    fn,
    precision: percent(precision),
    recall: percent(recall),
    f1: percent(f1(precision, recall)),
  };
}

function calculateBCubed(entityTruth: string[], predictedClusters: string[]): {
  precision: number;
  recall: number;
} {
  const n = entityTruth.length;
  if (n === 0) return { precision: 0, recall: 0 };

  const predGroups = _.groupBy(predictedClusters.map((id, idx) => ({ id, idx })), (x) => x.id);
  const truthGroups = _.groupBy(entityTruth.map((id, idx) => ({ id, idx })), (x) => x.id);

  let precisionSum = 0;
  let recallSum = 0;

  for (let i = 0; i < n; i += 1) {
    const predId = predictedClusters[i] ?? "";
    const truthId = entityTruth[i] ?? "";

    const predMembers = (predGroups[predId] ?? []).map((x) => x.idx);
    const truthMembers = (truthGroups[truthId] ?? []).map((x) => x.idx);

    const predSet = new Set(predMembers);
    const truthSet = new Set(truthMembers);

    let intersection = 0;
    for (const idx of predSet) {
      if (truthSet.has(idx)) intersection += 1;
    }

    precisionSum += safeDiv(intersection, predSet.size);
    recallSum += safeDiv(intersection, truthSet.size);
  }

  return {
    precision: precisionSum / n,
    recall: recallSum / n,
  };
}

export function evaluateAgainstGold(result: PipelineResult): EvaluationResult {
  const truthEntityIds = result.dirtyRows.map((row) => row.entity_id_truth);
  const predictedClusterIds = result.cleanedRows.map((row) => row.predicted_cluster_id);

  const truthPairSet = buildTruthPairSet(truthEntityIds);
  const dedupePairSet = buildPredictedPairSetFromMatches(result.dedupeMatches);
  const clusterPairSet = buildPredictedPairSetFromClusters(predictedClusterIds);

  const dedupeMetrics = calculatePairwiseMetrics(dedupePairSet, truthPairSet);
  const clusterPairMetrics = calculatePairwiseMetrics(clusterPairSet, truthPairSet);

  const bcubed = calculateBCubed(truthEntityIds, predictedClusterIds);
  const clusteringF1 = f1(bcubed.precision, bcubed.recall);

  const goldByEntity = new Map<string, GoldRow>(
    result.goldRows.map((row) => [row.entity_id, row]),
  );

  let normalizationExact = 0;
  let normalizationCompared = 0;
  let normalizationSimilaritySum = 0;

  const fieldMetrics: EvaluationResult["fields"] = [];
  const fieldNames = ["email", "website", "phone"] as const;

  for (const row of result.cleanedRows) {
    const gold = goldByEntity.get(row.entity_id_truth);
    if (!gold) continue;

    const normalizedCanonical = normalize_company_name({ name: gold.canonical_name }).normalized;
    const normalizedPred = normalizeComparable(row.normalized_name);

    normalizationCompared += 1;
    if (normalizedCanonical === normalizedPred) normalizationExact += 1;
    normalizationSimilaritySum += fuzzy(normalizedCanonical, normalizedPred);
  }

  for (const field of fieldNames) {
    let comparableRows = 0;
    let beforeExact = 0;
    let afterExact = 0;
    let missingGoldAndDirty = 0;
    let filledAfter = 0;

    for (const row of result.cleanedRows) {
      const gold = goldByEntity.get(row.entity_id_truth);
      if (!gold) continue;

      const rawDirty = normalizeComparable(row[field]);
      const rawGold = normalizeComparable(gold[`gold_${field}` as const]);

      const normalizedAfter = field === "phone"
        ? normalizeComparable(row.cleaned_phone)
        : field === "email"
          ? normalizeComparable(row.cleaned_email)
          : normalizeComparable(row.cleaned_website);

      const normalizedGold = field === "phone"
        ? normalizeComparable(normalize_contact_fields({ phone: rawGold }).normalized.phone)
        : field === "email"
          ? normalizeComparable(normalize_contact_fields({ email: rawGold }).normalized.email)
          : normalizeComparable(normalize_contact_fields({ website: rawGold }).normalized.website);

      if (normalizedGold) {
        comparableRows += 1;
        if (rawDirty && rawDirty === normalizedGold) beforeExact += 1;
        if (normalizedAfter && normalizedAfter === normalizedGold) afterExact += 1;
      }

      if (!rawDirty && Boolean(normalizedGold)) {
        missingGoldAndDirty += 1;
        if (Boolean(normalizedAfter)) filledAfter += 1;
      }
    }

    const beforeRate = safeDiv(beforeExact, comparableRows);
    const afterRate = safeDiv(afterExact, comparableRows);

    fieldMetrics.push({
      field,
      before_exact_match_rate: percent(beforeRate),
      after_exact_match_rate: percent(afterRate),
      improvement_exact_match_rate: percent(afterRate - beforeRate),
      missing_to_filled_rate: percent(safeDiv(filledAfter, missingGoldAndDirty)),
    });
  }

  const falsePositivePairs = [...dedupePairSet]
    .filter((pair) => !truthPairSet.has(pair))
    .slice(0, 20)
    .map((pair) => {
      const parts = pair.split("|");
      const left = Number(parts[0] ?? -1);
      const right = Number(parts[1] ?? -1);
      const leftRow = result.dirtyRows[left];
      const rightRow = result.dirtyRows[right];
      return {
        left_record_id: leftRow?.record_id ?? "",
        right_record_id: rightRow?.record_id ?? "",
        left_name: leftRow?.name ?? "",
        right_name: rightRow?.name ?? "",
      };
    });

  const falseNegativePairs = [...truthPairSet]
    .filter((pair) => !dedupePairSet.has(pair))
    .slice(0, 20)
    .map((pair) => {
      const parts = pair.split("|");
      const left = Number(parts[0] ?? -1);
      const right = Number(parts[1] ?? -1);
      const leftRow = result.dirtyRows[left];
      const rightRow = result.dirtyRows[right];
      return {
        left_record_id: leftRow?.record_id ?? "",
        right_record_id: rightRow?.record_id ?? "",
        left_name: leftRow?.name ?? "",
        right_name: rightRow?.name ?? "",
      };
    });

  const suspiciousMerges = result.clusters
    .map((cluster) => {
      const truthIds = _.uniq(cluster.members.map((idx) => result.dirtyRows[idx]?.entity_id_truth ?? "").filter(Boolean));
      return {
        cluster_id: cluster.cluster_id,
        truth_entity_ids: truthIds,
        members: cluster.members,
      };
    })
    .filter((x) => x.truth_entity_ids.length > 1)
    .sort((a, b) => b.truth_entity_ids.length - a.truth_entity_ids.length)
    .slice(0, 20);

  return {
    dedupe: dedupeMetrics,
    clustering: {
      cluster_precision: clusterPairMetrics.precision,
      cluster_recall: clusterPairMetrics.recall,
      bcubed_precision: percent(bcubed.precision),
      bcubed_recall: percent(bcubed.recall),
      f1: percent(clusteringF1),
    },
    normalization: {
      exact_match_rate: percent(safeDiv(normalizationExact, normalizationCompared)),
      fuzzy_similarity_avg: Number((normalizationSimilaritySum / Math.max(normalizationCompared, 1)).toFixed(4)),
    },
    fields: fieldMetrics,
    errorAnalysis: {
      falsePositivePairs,
      falseNegativePairs,
      suspiciousMerges,
    },
  };
}
