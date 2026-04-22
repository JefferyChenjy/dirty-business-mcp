import path from "node:path";

import _ from "lodash";

import type { EntityCluster } from "../src/types.js";
import type { CleanedRow, DirtyRow } from "../src/evaluation/types.js";
import {
  PATHS,
  ensureFile,
  readCsvFile,
  readJsonFile,
  sortByNumericId,
  writeJsonFile,
} from "./_common.js";

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Number((numerator / denominator).toFixed(6));
}

function normalizeEmailDomain(value?: string): string {
  const email = (value ?? "").trim().toLowerCase();
  if (!email.includes("@")) return "missing";
  return email.split("@")[1] ?? "missing";
}

function topDataIssues(cleanedRows: CleanedRow[]): Array<{ issue: string; count: number }> {
  const allIssues = cleanedRows
    .flatMap((row) => (row.quality_issues ?? "").split("|").map((x) => x.trim()).filter(Boolean));
  return Object.entries(_.countBy(allIssues))
    .map(([issue, count]) => ({ issue, count: Number(count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

export function runEda(): void {
  const cleanedPath = path.join(PATHS.outputsLatest, "cleaned_records.csv");
  const qualityPath = path.join(PATHS.outputsLatest, "quality_scores.csv");
  const clustersPath = path.join(PATHS.outputsLatest, "clusters.json");

  ensureFile(PATHS.dirtyCsv);
  ensureFile(cleanedPath);
  ensureFile(qualityPath);
  ensureFile(clustersPath);

  console.log("[eda] loading raw + latest outputs...");
  const dirtyRows = sortByNumericId(readCsvFile<DirtyRow>(PATHS.dirtyCsv));
  const cleanedRows = sortByNumericId(readCsvFile<CleanedRow>(cleanedPath));
  const qualityRows = readCsvFile<{ score?: string; issues?: string; missing_fields?: string }>(qualityPath);
  const clusters = readJsonFile<EntityCluster[]>(clustersPath);

  const beforeMissing = {
    name: ratio(dirtyRows.filter((r) => !r.name?.trim()).length, dirtyRows.length),
    email: ratio(dirtyRows.filter((r) => !r.email?.trim()).length, dirtyRows.length),
    website: ratio(dirtyRows.filter((r) => !r.website?.trim()).length, dirtyRows.length),
    phone: ratio(dirtyRows.filter((r) => !r.phone?.trim()).length, dirtyRows.length),
  };

  const afterMissing = {
    normalized_name: ratio(cleanedRows.filter((r) => !r.normalized_name?.trim()).length, cleanedRows.length),
    cleaned_email: ratio(cleanedRows.filter((r) => !r.cleaned_email?.trim()).length, cleanedRows.length),
    cleaned_website: ratio(cleanedRows.filter((r) => !r.cleaned_website?.trim()).length, cleanedRows.length),
    cleaned_phone: ratio(cleanedRows.filter((r) => !r.cleaned_phone?.trim()).length, cleanedRows.length),
  };

  const uniqueBeforeNames = _.uniq(dirtyRows.map((r) => (r.name ?? "").trim().toLowerCase()).filter(Boolean)).length;
  const uniqueAfterNames = _.uniq(cleanedRows.map((r) => (r.normalized_name ?? "").trim().toLowerCase()).filter(Boolean)).length;

  const duplicateCountBefore = dirtyRows.length - uniqueBeforeNames;
  const duplicateCountAfter = cleanedRows.length - uniqueAfterNames;

  const emailDomains = {
    before: Object.entries(_.countBy(dirtyRows, (r) => normalizeEmailDomain(r.email)))
      .map(([domain, count]) => ({ domain, count: Number(count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 25),
    after: Object.entries(_.countBy(cleanedRows, (r) => normalizeEmailDomain(r.cleaned_email)))
      .map(([domain, count]) => ({ domain, count: Number(count) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 25),
  };

  const clusterSizeDistribution = Object.entries(
    _.countBy(clusters, (cluster) => String(cluster.members.length)),
  )
    .map(([cluster_size, count]) => ({ cluster_size: Number(cluster_size), count: Number(count) }))
    .sort((a, b) => a.cluster_size - b.cluster_size);

  const qualityScores = qualityRows
    .map((r) => Number(r.score ?? "0"))
    .filter((v) => Number.isFinite(v));

  const qualityScoreDistribution = {
    avg: Number((_.mean(qualityScores) || 0).toFixed(6)),
    min: Number((_.min(qualityScores) || 0).toFixed(6)),
    max: Number((_.max(qualityScores) || 0).toFixed(6)),
    buckets: {
      "0.0-0.2": qualityScores.filter((v) => v < 0.2).length,
      "0.2-0.4": qualityScores.filter((v) => v >= 0.2 && v < 0.4).length,
      "0.4-0.6": qualityScores.filter((v) => v >= 0.4 && v < 0.6).length,
      "0.6-0.8": qualityScores.filter((v) => v >= 0.6 && v < 0.8).length,
      "0.8-1.0": qualityScores.filter((v) => v >= 0.8).length,
    },
  };

  const summary = {
    generated_at_utc: new Date().toISOString(),
    missing_value_rates: {
      before: beforeMissing,
      after: afterMissing,
    },
    duplicate_counts: {
      before: duplicateCountBefore,
      after: duplicateCountAfter,
    },
    unique_normalized_names: uniqueAfterNames,
    email_domain_distribution: emailDomains,
    cluster_size_distribution: clusterSizeDistribution,
    quality_score_distribution: qualityScoreDistribution,
    top_data_issues: topDataIssues(cleanedRows),
  };

  writeJsonFile(path.join(PATHS.outputsLatest, "eda_summary.json"), summary);
  console.log("[eda] wrote outputs/latest/eda_summary.json");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runEda();
}
