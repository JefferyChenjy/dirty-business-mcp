import { parse as parseDomain } from "tldts";

function ensureUrl(value: string): URL | null {
  try {
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    return new URL(withScheme);
  } catch {
    return null;
  }
}

export function normalizeWebsite(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return undefined;

  const url = ensureUrl(trimmed);
  if (!url) return undefined;

  const host = url.hostname.replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "");
  return path && path !== "/" ? `${host}${path}` : host;
}

export function toComparableDomain(value?: string): string | undefined {
  const normalized = normalizeWebsite(value);
  if (!normalized) return undefined;

  const domain = parseDomain(normalized).domain;
  return domain ?? normalized.split("/")[0];
}
