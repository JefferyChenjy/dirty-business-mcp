import path from "node:path";

import type { EntityCluster, QualityScore, Record as BusinessRecord } from "../src/types.js";
import {
  normalize_company_name,
  normalize_contact_fields,
  dedupe_records,
  cluster_entities,
  score_record_quality,
} from "../src/tools/index.js";
import type { CleanedRow, DirtyRow } from "../src/evaluation/types.js";
import {
  PATHS,
  ensureDir,
  readCsvFile,
  sortByNumericId,
  writeCsvFile,
  writeJsonFile,
} from "./_common.js";

const CLUSTER_THRESHOLD = Number(process.env.CLUSTER_THRESHOLD ?? "0.85");
const DEDUPE_MIN_SCORE = Number(process.env.DEDUPE_MIN_SCORE ?? "0.85");

function mapToToolRecord(row: DirtyRow): BusinessRecord {
  return {
    id: row.record_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    website: row.website,
    address: row.address,
  };
}

function prepareCleanedRows(dirtyRows: DirtyRow[]): {
  cleanedRows: CleanedRow[];
  toolRecords: BusinessRecord[];
  qualityScores: QualityScore[];
} {
  const toolRecords: BusinessRecord[] = [];
  const qualityScores: QualityScore[] = [];

  const cleanedRows = dirtyRows.map((row, idx) => {
    const normalizedName = normalize_company_name({ name: row.name ?? "" }).normalized;
    const normalizedContact = normalize_contact_fields({
      phone: row.phone,
      email: row.email,
      website: row.website,
      default_country: "SG",
    });

    const toolRecord: BusinessRecord = {
      ...mapToToolRecord(row),
      normalized_name: normalizedName,
      phone: normalizedContact.normalized.phone,
      email: normalizedContact.normalized.email,
      website: normalizedContact.normalized.website,
    };

    const quality = score_record_quality({
      record: toolRecord,
      record_index: idx,
      default_country: "SG",
    });

    toolRecords.push(toolRecord);
    qualityScores.push(quality);

    return {
      ...row,
      normalized_name: normalizedName,
      cleaned_phone: normalizedContact.normalized.phone,
      cleaned_email: normalizedContact.normalized.email,
      cleaned_website: normalizedContact.normalized.website,
      quality_score: quality.score,
      quality_missing_fields: quality.missing_fields.join("|"),
      quality_issues: quality.issues.join("|"),
      predicted_cluster_id: "",
    } satisfies CleanedRow;
  });

  return { cleanedRows, toolRecords, qualityScores };
}

function assignClusters(rows: CleanedRow[], clusters: EntityCluster[]): CleanedRow[] {
  const byMemberIndex = new Map<number, string>();
  for (const cluster of clusters) {
    for (const memberIdx of cluster.members) {
      byMemberIndex.set(memberIdx, cluster.cluster_id);
    }
  }

  return rows.map((row, idx) => ({
    ...row,
    predicted_cluster_id: byMemberIndex.get(idx) ?? `cluster_singleton_${idx + 1}`,
  }));
}

function sortClusters(clusters: EntityCluster[]): EntityCluster[] {
  return [...clusters].sort((a, b) => {
    const ai = Number((a.cluster_id.split("_")[1] ?? "0"));
    const bi = Number((b.cluster_id.split("_")[1] ?? "0"));
    return ai - bi;
  });
}

export function runPipeline(): void {
  ensureDir(PATHS.outputsLatest);

  console.log("[pipeline] reading dirty data from data/raw...");
  const dirtyRows = sortByNumericId(readCsvFile<DirtyRow>(PATHS.dirtyCsv));
  console.log(`[pipeline] loaded dirty rows: ${dirtyRows.length}`);

  const prepared = prepareCleanedRows(dirtyRows);

  console.log(`[pipeline] running dedupe with min_score=${DEDUPE_MIN_SCORE}...`);
  const dedupeMatches = dedupe_records({
    records: prepared.toolRecords,
    min_score: DEDUPE_MIN_SCORE,
    default_country: "SG",
  });
  console.log(`[pipeline] dedupe matches=${dedupeMatches.length}`);

  console.log(`[pipeline] clustering entities with threshold=${CLUSTER_THRESHOLD}...`);
  const clusters = sortClusters(
    cluster_entities({
      records: prepared.toolRecords,
      threshold: CLUSTER_THRESHOLD,
      default_country: "SG",
    }),
  );

  const cleanedRows = assignClusters(prepared.cleanedRows, clusters);

  const qualityRows = prepared.qualityScores.map((q, idx) => ({
    record_index: q.record_index,
    record_id: dirtyRows[idx]?.record_id ?? "",
    score: q.score,
    missing_fields: q.missing_fields.join("|"),
    issues: q.issues.join("|"),
  }));

  writeCsvFile(path.join(PATHS.outputsLatest, "cleaned_records.csv"), cleanedRows as unknown as Array<globalThis.Record<string, unknown>>);
  writeCsvFile(path.join(PATHS.outputsLatest, "quality_scores.csv"), qualityRows);
  writeJsonFile(path.join(PATHS.outputsLatest, "clusters.json"), clusters);

  console.log("[pipeline] wrote outputs/latest/cleaned_records.csv");
  console.log("[pipeline] wrote outputs/latest/quality_scores.csv");
  console.log("[pipeline] wrote outputs/latest/clusters.json");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPipeline();
}
