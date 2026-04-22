import {
  normalizeCompanyNameTool,
  type NormalizeCompanyNameInput,
} from "./normalizeName.js";
import {
  normalizeContactFieldsTool,
  type NormalizeContactFieldsInput,
} from "./normalizeContact.js";
import {
  dedupeRecordsTool,
  type DedupeRecordsInput,
  recordSchema,
} from "./dedupe.js";
import {
  clusterEntitiesTool,
  type ClusterEntitiesInput,
} from "./cluster.js";
import { scoreRecordQualityTool } from "./quality.js";
import type { Record } from "../types.js";

export { recordSchema };
export type { Record };

export function normalize_company_name(input: NormalizeCompanyNameInput) {
  return normalizeCompanyNameTool(input);
}

export function normalize_contact_fields(input: NormalizeContactFieldsInput) {
  return normalizeContactFieldsTool(input);
}

export function dedupe_records(input: {
  records: Record[];
  min_score?: number;
  default_country?: string;
}) {
  const payload: DedupeRecordsInput = {
    records: input.records,
    min_score: input.min_score ?? 0.85,
    default_country: input.default_country,
  };
  return dedupeRecordsTool(payload);
}

export function cluster_entities(input: {
  records: Record[];
  threshold?: number;
  default_country?: string;
}) {
  const payload: ClusterEntitiesInput = {
    records: input.records,
    threshold: input.threshold ?? 0.85,
    default_country: input.default_country,
  };
  return clusterEntitiesTool(payload);
}

export function score_record_quality(input: {
  record: Record;
  record_index?: number;
  default_country?: string;
}) {
  return scoreRecordQualityTool({
    record: input.record,
    record_index: input.record_index ?? 0,
    default_country: input.default_country,
  });
}
