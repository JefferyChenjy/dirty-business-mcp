import { z } from "zod";

import type { Record } from "../types.js";
import { clusterEntitiesTool } from "./cluster.js";
import { dedupeRecordsTool, recordSchema } from "./dedupe.js";
import { normalizeContactFieldsTool } from "./normalizeContact.js";
import { normalizeCompanyNameTool } from "./normalizeName.js";
import { scoreRecordQualityBatchTool } from "./quality.js";

export const exportCleanDatasetInputSchema = z.object({
  records: z.array(recordSchema),
  dedupe_threshold: z.number().min(0).max(1).default(0.85),
  default_country: z.string().length(2).optional(),
});

export type ExportCleanDatasetInput = z.infer<typeof exportCleanDatasetInputSchema>;

export function exportCleanDatasetTool(input: ExportCleanDatasetInput) {
  const cleanedRecords = input.records.map((record) => normalizeRecord(record, input.default_country));

  const dedupeMatches = dedupeRecordsTool({
    records: cleanedRecords,
    min_score: 0,
    default_country: input.default_country,
  });

  const clusters = clusterEntitiesTool({
    records: cleanedRecords,
    threshold: input.dedupe_threshold,
    default_country: input.default_country,
  });

  const qualityScores = scoreRecordQualityBatchTool({
    records: cleanedRecords,
    default_country: input.default_country,
  });

  return {
    cleaned_records: cleanedRecords,
    dedupe_matches: dedupeMatches,
    clusters,
    quality_scores: qualityScores,
  };
}

export function normalizeRecord(record: Record, defaultCountry?: string): Record {
  const normalizedName = normalizeCompanyNameTool({ name: record.name ?? "" });
  const normalizedContacts = normalizeContactFieldsTool({
    phone: record.phone,
    email: record.email,
    website: record.website,
    default_country: defaultCountry,
  });

  return {
    ...record,
    normalized_name: normalizedName.normalized || record.normalized_name,
    phone: normalizedContacts.normalized.phone,
    email: normalizedContacts.normalized.email,
    website: normalizedContacts.normalized.website,
  };
}
