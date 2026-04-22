export type Record = {
  id?: string;
  name?: string;
  normalized_name?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
};

export type DedupeMatch = {
  record_i: number;
  record_j: number;
  score: number;
  matched_on: string[];
};

export type EntityCluster = {
  cluster_id: string;
  members: number[];
  confidence: number;
};

export type QualityScore = {
  record_index: number;
  score: number;
  missing_fields: string[];
  issues: string[];
};
