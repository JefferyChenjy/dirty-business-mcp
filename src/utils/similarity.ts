import { fuzzy } from "fast-fuzzy";

export function safeFuzzySimilarity(left?: string, right?: string): number {
  if (!left || !right) return 0;
  const a = left.trim();
  const b = right.trim();
  if (!a || !b) return 0;

  const score = fuzzy(a, b);
  if (typeof score === "number" && Number.isFinite(score)) {
    return clamp(score);
  }

  return 0;
}

function clamp(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return Number(value.toFixed(4));
}
