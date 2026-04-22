#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import { parse as parseCsv } from "csv-parse/sync";
import { stringify as stringifyCsv } from "csv-stringify/sync";

import type { Record as BusinessRecord } from "../src/types.js";
import { dedupeRecordsTool } from "../src/tools/dedupe.js";
import { exportCleanDatasetTool, normalizeRecord } from "../src/tools/export.js";

function printUsage() {
  console.log(`dirtybiz usage:
  dirtybiz normalize <file>
  dirtybiz dedupe <file>
  dirtybiz clean <file> --out <file>
`);
}

function readDataset(filePath: string): BusinessRecord[] {
  const ext = path.extname(filePath).toLowerCase();
  const content = fs.readFileSync(filePath, "utf-8");

  if (ext === ".json") {
    const parsed = JSON.parse(content) as unknown;
    if (Array.isArray(parsed)) return parsed as BusinessRecord[];
    if (
      parsed &&
      typeof parsed === "object" &&
      Array.isArray((parsed as { records?: unknown }).records)
    ) {
      return (parsed as { records: BusinessRecord[] }).records;
    }
    throw new Error("JSON must be an array of records or an object with a 'records' array.");
  }

  if (ext === ".csv") {
    const rows = parseCsv(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as BusinessRecord[];
    return rows;
  }

  throw new Error(`Unsupported file type: ${ext}. Use .csv or .json`);
}

function writeOutput(filePath: string, data: unknown) {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".json") {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return;
  }

  if (ext === ".csv") {
    if (!Array.isArray(data)) {
      throw new Error("CSV output only supports array data. Try a .json output file.");
    }
    const csv = stringifyCsv(data as globalThis.Record<string, unknown>[], { header: true });
    fs.writeFileSync(filePath, csv);
    return;
  }

  throw new Error(`Unsupported output type: ${ext}. Use .csv or .json`);
}

function resolveOutPath(argv: string[]): string {
  const outIndex = argv.indexOf("--out");
  const outPath = outIndex >= 0 ? argv[outIndex + 1] : undefined;
  if (!outPath) {
    throw new Error("Missing --out <file>");
  }
  return outPath;
}

async function main() {
  const argv = process.argv.slice(2);
  const command = argv[0];

  if (!command || command === "--help" || command === "-h") {
    printUsage();
    process.exit(0);
  }

  try {
    if (command === "normalize") {
      const file = argv[1];
      if (!file) throw new Error("Missing input file.");
      const records = readDataset(file);
      const cleaned = records.map((record) => normalizeRecord(record));
      console.log(JSON.stringify(cleaned, null, 2));
      return;
    }

    if (command === "dedupe") {
      const file = argv[1];
      if (!file) throw new Error("Missing input file.");
      const records = readDataset(file).map((record) => normalizeRecord(record));
      const matches = dedupeRecordsTool({ records, min_score: 0.5 });
      console.log(JSON.stringify(matches, null, 2));
      return;
    }

    if (command === "clean") {
      const file = argv[1];
      if (!file) throw new Error("Missing input file.");
      const outPath = resolveOutPath(argv);
      const records = readDataset(file);
      const result = exportCleanDatasetTool({ records, dedupe_threshold: 0.85 });

      if (path.extname(outPath).toLowerCase() === ".csv") {
        writeOutput(outPath, result.cleaned_records as unknown);
      } else {
        writeOutput(outPath, result);
      }

      console.log(`Wrote cleaned output to ${outPath}`);
      return;
    }

    throw new Error(`Unknown command: ${command}`);
  } catch (error) {
    console.error((error as Error).message);
    printUsage();
    process.exit(1);
  }
}

main();
