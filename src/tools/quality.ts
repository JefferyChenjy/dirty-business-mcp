import { z } from "zod";

import type { QualityScore, Record } from "../types.js";
import { toComparableDomain } from "../utils/domain.js";
import { normalizeCompanyName } from "../utils/string.js";
import { normalizePhone } from "./normalizeContact.js";
import { recordSchema } from "./dedupe.js";

const GENERIC_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "icloud.com",
  "proton.me",
]);

export const scoreRecordQualityInputSchema = z.object({
  record: recordSchema,
  record_index: z.number().int().min(0).default(0),
  default_country: z.string().length(2).optional(),
});

export const scoreRecordQualityBatchInputSchema = z.object({
  records: z.array(recordSchema),
  default_country: z.string().length(2).optional(),
});

export function scoreRecordQualityTool(input: z.infer<typeof scoreRecordQualityInputSchema>): QualityScore {
  return scoreSingleRecord(input.record, input.record_index, input.default_country);
}

export function scoreRecordQualityBatchTool(
  input: z.infer<typeof scoreRecordQualityBatchInputSchema>,
): QualityScore[] {
  return input.records.map((record, index) => scoreSingleRecord(record, index, input.default_country));
}

function scoreSingleRecord(record: Record, recordIndex: number, defaultCountry?: string): QualityScore {
  const missing: string[] = [];
  const issues: string[] = [];
  let score = 1;

  const normalizedName = (record.normalized_name ?? normalizeCompanyName(record.name ?? "").normalized).trim();
  if (!normalizedName) {
    missing.push("name");
    issues.push("missing_name");
    score -= 0.4;
  }

  const websiteDomain = toComparableDomain(record.website);
  if (!websiteDomain) {
    missing.push("website");
    issues.push("missing_website");
    score -= 0.15;
  }

  const email = record.email?.trim().toLowerCase();
  if (!email) {
    missing.push("email");
  } else {
    const domain = email.split("@")[1];
    if (!domain) {
      issues.push("invalid_email");
      score -= 0.15;
    } else if (GENERIC_EMAIL_DOMAINS.has(domain)) {
      issues.push("generic_email_domain");
      score -= 0.15;
    }
  }

  const phoneResult = normalizePhone(record.phone, defaultCountry);
  if (!record.phone) {
    missing.push("phone");
  } else if (!phoneResult.valid) {
    issues.push("invalid_phone");
    score -= 0.2;
  }

  score = Math.max(0, Math.min(1, score));

  return {
    record_index: recordIndex,
    score: Number(score.toFixed(4)),
    missing_fields: missing,
    issues,
  };
}
