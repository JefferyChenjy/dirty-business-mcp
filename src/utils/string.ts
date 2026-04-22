const LEGAL_SUFFIX_RULES: Array<{ tokens: string[]; label: string }> = [
  { tokens: ["limited", "liability", "company"], label: "limited liability company" },
  { tokens: ["private", "limited"], label: "private limited" },
  { tokens: ["sendirian", "berhad"], label: "sendirian berhad" },
  { tokens: ["sdn", "bhd"], label: "sdn bhd" },
  { tokens: ["l", "l", "c"], label: "l l c" },
  { tokens: ["incorporated"], label: "incorporated" },
  { tokens: ["corporation"], label: "corporation" },
  { tokens: ["limited"], label: "limited" },
  { tokens: ["pte"], label: "pte" },
  { tokens: ["ltd"], label: "ltd" },
  { tokens: ["llc"], label: "llc" },
  { tokens: ["inc"], label: "inc" },
  { tokens: ["corp"], label: "corp" },
  { tokens: ["co"], label: "co" },
];

const TOKEN_NORMALIZATION_MAP: Record<string, string> = {
  intl: "international",
  svc: "services",
  svcs: "services",
  chn: "chain",
  pkg: "packaging",
  pkgrs: "packagers",
  solns: "solutions",
  analytx: "analytics",
  engrg: "engineering",
};

export function stripPunctuation(input: string): string {
  return input.replace(/[^\p{L}\p{N}\s]/gu, " ");
}

export function splitConcatenatedWords(input: string): string {
  // Split camel/pascal boundaries: "CrestviewEngineering" -> "Crestview Engineering"
  return input.replace(/([\p{Ll}\p{N}])([\p{Lu}])/gu, "$1 $2");
}

export function collapseWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function normalizeBasicText(input: string): string {
  return collapseWhitespace(stripPunctuation(splitConcatenatedWords(input)).toLowerCase());
}

function endsWithTokens(tokens: string[], suffixTokens: string[]): boolean {
  if (tokens.length < suffixTokens.length) return false;
  const offset = tokens.length - suffixTokens.length;
  for (let i = 0; i < suffixTokens.length; i += 1) {
    if (tokens[offset + i] !== suffixTokens[i]) {
      return false;
    }
  }
  return true;
}

export function removeLegalSuffixTokens(tokens: string[]): { tokens: string[]; removed: string[] } {
  const working = [...tokens];
  const removed: string[] = [];

  let changed = true;
  while (changed && working.length > 0) {
    changed = false;

    for (const rule of LEGAL_SUFFIX_RULES) {
      if (endsWithTokens(working, rule.tokens)) {
        working.splice(working.length - rule.tokens.length, rule.tokens.length);
        removed.push(rule.label);
        changed = true;
        break;
      }
    }
  }

  return { tokens: working, removed };
}

export function normalizeCompanyName(name: string): {
  original: string;
  normalized: string;
  removed_tokens: string[];
  confidence: number;
} {
  const base = normalizeBasicText(name);
  const rawTokens = base
    .split(" ")
    .filter(Boolean)
    .map((token) => TOKEN_NORMALIZATION_MAP[token] ?? token);
  const { tokens, removed } = removeLegalSuffixTokens(rawTokens);
  const normalized = tokens.join(" ");

  let confidence = 0;
  if (normalized.length > 0) {
    confidence = 0.55 + Math.min(normalized.length, 30) / 100;
    confidence += Math.min(removed.length * 0.05, 0.15);
    confidence = Math.min(confidence, 0.99);
  }

  return {
    original: name,
    normalized,
    removed_tokens: removed,
    confidence: Number(confidence.toFixed(4)),
  };
}

export function toCanonicalTokenSet(name: string): string {
  const normalized = normalizeBasicText(name);
  if (!normalized) return "";

  const tokens = normalized
    .split(" ")
    .filter(Boolean)
    .map((token) => TOKEN_NORMALIZATION_MAP[token] ?? token);

  const canonical = [...new Set(tokens)].sort((a, b) => a.localeCompare(b));
  return canonical.join(" ");
}
