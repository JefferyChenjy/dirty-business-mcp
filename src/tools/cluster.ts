import { z } from "zod";

import type { DedupeMatch, EntityCluster } from "../types.js";
import { dedupeRecordsTool, recordSchema } from "./dedupe.js";

export const clusterEntitiesInputSchema = z.object({
  records: z.array(recordSchema),
  threshold: z.number().min(0).max(1).default(0.85),
  default_country: z.string().length(2).optional(),
});

export type ClusterEntitiesInput = z.infer<typeof clusterEntitiesInputSchema>;

class UnionFind {
  private parent: number[];
  private rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, i) => i);
    this.rank = Array.from({ length: size }, () => 0);
  }

  find(x: number): number {
    if (this.parent[x]! !== x) {
      this.parent[x] = this.find(this.parent[x]!);
    }
    return this.parent[x]!;
  }

  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);

    if (rootA === rootB) return;

    if (this.rank[rootA]! < this.rank[rootB]!) {
      this.parent[rootA] = rootB;
    } else if (this.rank[rootA]! > this.rank[rootB]!) {
      this.parent[rootB] = rootA;
    } else {
      this.parent[rootB] = rootA;
      this.rank[rootA] = this.rank[rootA]! + 1;
    }
  }
}

export function clusterEntitiesTool(input: ClusterEntitiesInput): EntityCluster[] {
  const uf = new UnionFind(input.records.length);

  const matches = dedupeRecordsTool({
    records: input.records,
    min_score: input.threshold,
    default_country: input.default_country,
  });

  for (const match of matches) {
    uf.union(match.record_i, match.record_j);
  }

  const grouped = new Map<number, number[]>();
  for (let i = 0; i < input.records.length; i += 1) {
    const root = uf.find(i);
    const members = grouped.get(root) ?? [];
    members.push(i);
    grouped.set(root, members);
  }

  const clusters = [...grouped.entries()].map(([root, members], index) => ({
    cluster_id: `cluster_${index + 1}`,
    members,
    confidence: computeClusterConfidence(members, matches, input.threshold),
    _root: root,
  }));

  return clusters
    .sort((a, b) => a._root - b._root)
    .map(({ _root: _ignored, ...cluster }) => cluster);
}

function computeClusterConfidence(
  members: number[],
  matches: DedupeMatch[],
  threshold: number,
): number {
  if (members.length <= 1) {
    return 1;
  }

  const memberSet = new Set(members);
  const inCluster = matches.filter(
    (m) => memberSet.has(m.record_i) && memberSet.has(m.record_j),
  );

  if (inCluster.length === 0) {
    return Number(threshold.toFixed(4));
  }

  const average = inCluster.reduce((sum, item) => sum + item.score, 0) / inCluster.length;
  return Number(average.toFixed(4));
}
