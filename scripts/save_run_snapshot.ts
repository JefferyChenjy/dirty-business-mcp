import fs from "node:fs";
import path from "node:path";

import { PATHS, ensureDir, ensureFile, utcTimestampForFolder } from "./_common.js";

const REQUIRED_LATEST_FILES = [
  "cleaned_records.csv",
  "quality_scores.csv",
  "clusters.json",
  "metrics.json",
  "error_cases.json",
  "eda_summary.json",
  "summary.md",
];

export function saveRunSnapshot(): void {
  for (const file of REQUIRED_LATEST_FILES) {
    ensureFile(path.join(PATHS.outputsLatest, file));
  }

  const timestamp = utcTimestampForFolder(new Date());
  const targetDir = path.join(PATHS.outputsHistory, timestamp);
  ensureDir(targetDir);

  for (const file of REQUIRED_LATEST_FILES) {
    fs.copyFileSync(path.join(PATHS.outputsLatest, file), path.join(targetDir, file));
  }

  console.log(`[snapshot] saved run snapshot: ${targetDir}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  saveRunSnapshot();
}
