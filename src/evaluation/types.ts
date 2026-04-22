import type { DedupeMatch, EntityCluster, QualityScore } from "../types.js";

export type DirtyRow = {
  record_id: string;
  entity_id_truth: string;
  name: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  source_note?: string;
};

export type GoldRow = {
  entity_id: string;
  canonical_name: string;
  gold_name?: string;
  gold_phone?: string;
  gold_email?: string;
  gold_website?: string;
  gold_address?: string;
};

export type CleanedRow = DirtyRow & {
  normalized_name: string;
  cleaned_phone?: string;
  cleaned_email?: string;
  cleaned_website?: string;
  quality_score: number;
  quality_missing_fields: string;
  quality_issues: string;
  predicted_cluster_id: string;
};

export type PipelineResult = {
  dirtyRows: DirtyRow[];
  goldRows: GoldRow[];
  cleanedRows: CleanedRow[];
  dedupeMatches: DedupeMatch[];
  clusters: EntityCluster[];
  qualityScores: QualityScore[];
  thresholds: {
    dedupeMinScore: number;
    clusterThreshold: number;
  };
};

export type PairwiseMetrics = {
  tp: number;
  fp: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
};

export type ClusterMetrics = {
  cluster_precision: number;
  cluster_recall: number;
  bcubed_precision: number;
  bcubed_recall: number;
  f1: number;
};

export type NormalizationMetrics = {
  exact_match_rate: number;
  fuzzy_similarity_avg: number;
};

export type FieldMetrics = {
  field: "email" | "website" | "phone";
  before_exact_match_rate: number;
  after_exact_match_rate: number;
  improvement_exact_match_rate: number;
  missing_to_filled_rate: number;
};

export type EvaluationResult = {
  dedupe: PairwiseMetrics;
  clustering: ClusterMetrics;
  normalization: NormalizationMetrics;
  fields: FieldMetrics[];
  errorAnalysis: {
    falsePositivePairs: Array<{ left_record_id: string; right_record_id: string; left_name: string; right_name: string }>;
    falseNegativePairs: Array<{ left_record_id: string; right_record_id: string; left_name: string; right_name: string }>;
    suspiciousMerges: Array<{ cluster_id: string; truth_entity_ids: string[]; members: number[] }>;
  };
};
