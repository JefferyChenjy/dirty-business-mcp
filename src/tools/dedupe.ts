import { z } from "zod";

import type { DedupeMatch, Record } from "../types.js";
import { toComparableDomain } from "../utils/domain.js";
import { safeFuzzySimilarity } from "../utils/similarity.js";
import { normalizeCompanyName, toCanonicalTokenSet } from "../utils/string.js";
import { normalizePhone } from "./normalizeContact.js";

export const recordSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  normalized_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
});

export const dedupeRecordsInputSchema = z.object({
  records: z.array(recordSchema),
  min_score: z.number().min(0).max(1).default(0.5),
  default_country: z.string().length(2).optional(),
});

export type DedupeRecordsInput = z.infer<typeof dedupeRecordsInputSchema>;

export function dedupeRecordsTool(input: DedupeRecordsInput): DedupeMatch[] {
  const output: DedupeMatch[] = [];
  const records = input.records;

  for (let i = 0; i < records.length; i += 1) {
    for (let j = i + 1; j < records.length; j += 1) {
      const left = records[i];
      const right = records[j];
      if (!left || !right) continue;

      const match = comparePair(left, right, input.default_country);
      if (match.score >= input.min_score) {
        output.push({
          record_i: i,
          record_j: j,
          score: Number(match.score.toFixed(4)),
          matched_on: match.matched_on,
        });
      }
    }
  }

  return output.sort((a, b) => b.score - a.score);
}

const QUALIFIER_TOKENS = new Set(["sg", "branch", "asia", "systems"]);
const MODIFIER_TOKENS = new Set([
  "engineering",
  "supplies",
  "systems",
  "services",
  "logistics",
  "analytics",
  "digital",
  "branch",
  "sg",
  "international",
  "asia",
]);

function tokenizeNormalizedName(name: string): string[] {
  return name
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function hasQualifierOnlyExpansion(leftName: string, rightName: string): boolean {
  const left = new Set(tokenizeNormalizedName(leftName));
  const right = new Set(tokenizeNormalizedName(rightName));
  if (left.size === 0 || right.size === 0) return false;

  const leftOnly = [...left].filter((token) => !right.has(token));
  const rightOnly = [...right].filter((token) => !left.has(token));

  const onlyLeftHasQualifiers = leftOnly.length > 0 && rightOnly.length === 0 && leftOnly.every((t) => QUALIFIER_TOKENS.has(t));
  const onlyRightHasQualifiers = rightOnly.length > 0 && leftOnly.length === 0 && rightOnly.every((t) => QUALIFIER_TOKENS.has(t));

  return onlyLeftHasQualifiers || onlyRightHasQualifiers;
}

function splitCoreAndModifierTokens(name: string): { core: Set<string>; modifier: Set<string> } {
  const tokens = tokenizeNormalizedName(name);
  const core = new Set<string>();
  const modifier = new Set<string>();
  for (const token of tokens) {
    if (MODIFIER_TOKENS.has(token)) {
      modifier.add(token);
    } else {
      core.add(token);
    }
  }
  return { core, modifier };
}

function comparePair(
  left: Record,
  right: Record,
  defaultCountry?: string,
): { score: number; matched_on: string[] } {
  const matched_on: string[] = [];

  const leftName = (left.normalized_name ?? normalizeCompanyName(left.name ?? "").normalized).trim();
  const rightName = (right.normalized_name ?? normalizeCompanyName(right.name ?? "").normalized).trim();
  const nameSimilarity = safeFuzzySimilarity(leftName, rightName);
  const leftTokenSet = toCanonicalTokenSet(leftName);
  const rightTokenSet = toCanonicalTokenSet(rightName);
  const tokenSetSimilarity = safeFuzzySimilarity(leftTokenSet, rightTokenSet);
  const effectiveNameSimilarity = Math.max(nameSimilarity, tokenSetSimilarity);

  if (nameSimilarity >= 0.85) {
    matched_on.push("name_fuzzy_high");
  } else if (nameSimilarity >= 0.65) {
    matched_on.push("name_fuzzy_medium");
  }
  if (tokenSetSimilarity >= 0.9) {
    matched_on.push("name_token_set_high");
  } else if (tokenSetSimilarity >= 0.75) {
    matched_on.push("name_token_set_medium");
  }

  const leftDomain = toComparableDomain(left.website);
  const rightDomain = toComparableDomain(right.website);
  const domainMatch = Boolean(leftDomain && rightDomain && leftDomain === rightDomain);
  if (domainMatch) {
    matched_on.push("domain_exact");
  }

  const leftPhone = normalizePhone(left.phone, defaultCountry).value;
  const rightPhone = normalizePhone(right.phone, defaultCountry).value;
  const phoneMatch = Boolean(leftPhone && rightPhone && leftPhone === rightPhone);
  if (phoneMatch) {
    matched_on.push("phone_exact");
  }
  const qualifierOnlyExpansion = hasQualifierOnlyExpansion(leftName, rightName);
  const leftSplit = splitCoreAndModifierTokens(leftName);
  const rightSplit = splitCoreAndModifierTokens(rightName);
  const coreOverlapCount = [...leftSplit.core].filter((token) => rightSplit.core.has(token)).length;
  const modifierOverlapCount = [...leftSplit.modifier].filter((token) => rightSplit.modifier.has(token)).length;
  const modifierDrivenSimilarity =
    coreOverlapCount <= 1 &&
    modifierOverlapCount >= 1 &&
    leftSplit.modifier.size > 0 &&
    rightSplit.modifier.size > 0;

  let score = effectiveNameSimilarity * 0.55;
  if (domainMatch) score += 0.3;
  if (phoneMatch) score += 0.25;

  // Recall fallback: when names are effectively exact, do not require contact evidence.
  const nameOnlyStrongMatch =
    leftName.length >= 10 &&
    rightName.length >= 10 &&
    (leftName === rightName || effectiveNameSimilarity >= 0.98 || leftTokenSet === rightTokenSet);
  if (nameOnlyStrongMatch) {
    matched_on.push("name_only_strong");
    score = Math.max(score, 0.86);
  }

  // Precision guard: avoid auto-merging when one side only adds weak qualifiers.
  if (qualifierOnlyExpansion && !domainMatch && !phoneMatch) {
    matched_on.push("qualifier_only_expansion_guard");
    score = Math.min(score, 0.84);
  }

  // Precision guard: if overlap is mostly generic business modifiers, require contact evidence.
  if (modifierDrivenSimilarity && !domainMatch && !phoneMatch) {
    matched_on.push("modifier_driven_similarity_guard");
    score = Math.min(score, 0.84);
  }

  if (domainMatch && phoneMatch) {
    score = Math.max(score, 0.95);
  }

  return {
    score: Math.min(score, 1),
    matched_on,
  };
}
