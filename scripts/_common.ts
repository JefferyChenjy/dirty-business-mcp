import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Papa from "papaparse";

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);
export const ROOT = path.resolve(path.join(__dirname, "..", ".."));

export const PATHS = {
  dirtyCsv: path.join(ROOT, "data", "raw", "dirty_business_data_200.csv"),
  goldCsv: path.join(ROOT, "data", "raw", "dirty_business_gold_200.csv"),
  outputsLatest: path.join(ROOT, "outputs", "latest"),
  outputsHistory: path.join(ROOT, "outputs", "history"),
  reportsTemplate: path.join(ROOT, "reports", "templates", "summary_template.md"),
};

export function ensureFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file is missing: ${filePath}`);
  }
}

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function readCsvFile<T extends globalThis.Record<string, unknown>>(filePath: string): T[] {
  ensureFile(filePath);
  const text = fs.readFileSync(filePath, "utf8");
  const parsed = Papa.parse<T>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors.length > 0) {
    console.warn(`[warn] CSV parse had ${parsed.errors.length} errors for ${filePath}`);
  }

  return parsed.data;
}

export function writeCsvFile(filePath: string, rows: Array<globalThis.Record<string, unknown>>): void {
  ensureDir(path.dirname(filePath));
  const csv = Papa.unparse(rows, { quotes: false });
  fs.writeFileSync(filePath, csv, "utf8");
}

export function readJsonFile<T>(filePath: string): T {
  ensureFile(filePath);
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

export function writeJsonFile(filePath: string, data: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

export function writeTextFile(filePath: string, text: string): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, text, "utf8");
}

export function utcTimestampForFolder(date = new Date()): string {
  const iso = date.toISOString();
  // 2026-04-21T02:15:00.000Z -> 20260421_021500Z
  const compact = iso.replace(/[-:]/g, "").replace(".000", "");
  return `${compact.slice(0, 8)}_${compact.slice(9, 15)}Z`;
}

export function sortByNumericId<T extends { record_id?: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ai = Number(a.record_id ?? "0");
    const bi = Number(b.record_id ?? "0");
    if (Number.isFinite(ai) && Number.isFinite(bi)) {
      return ai - bi;
    }
    return String(a.record_id ?? "").localeCompare(String(b.record_id ?? ""));
  });
}
