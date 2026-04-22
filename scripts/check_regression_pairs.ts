import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { dedupe_records } from "../src/tools/index.js";

type RegressionCase = {
  id: string;
  left_name: string;
  right_name: string;
  expected_duplicate: boolean;
  min_score?: number;
};

type RegressionFixture = {
  threshold: number;
  cases: RegressionCase[];
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..", "..");
const FIXTURE_PATH = path.join(ROOT_DIR, "data", "raw", "dedupe_regression_cases.json");

function loadFixture(filePath: string): RegressionFixture {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Regression fixture missing: ${filePath}`);
  }
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as RegressionFixture;
}

function runCase(testCase: RegressionCase, threshold: number): { passed: boolean; score: number } {
  const matches = dedupe_records({
    records: [
      { id: `${testCase.id}-L`, name: testCase.left_name },
      { id: `${testCase.id}-R`, name: testCase.right_name },
    ],
    min_score: threshold,
  });

  const direct = matches.find((m) => m.record_i === 0 && m.record_j === 1);
  const reverse = matches.find((m) => m.record_i === 1 && m.record_j === 0);
  const match = direct ?? reverse;
  const score = match?.score ?? 0;
  const minScore = testCase.min_score ?? threshold;
  const predictedDuplicate = score >= minScore;
  return { passed: predictedDuplicate === testCase.expected_duplicate, score };
}

function main() {
  const fixture = loadFixture(FIXTURE_PATH);
  const threshold = fixture.threshold;
  let failed = 0;

  console.log(`[regression] threshold=${threshold} cases=${fixture.cases.length}`);
  for (const testCase of fixture.cases) {
    const result = runCase(testCase, threshold);
    const marker = result.passed ? "PASS" : "FAIL";
    console.log(
      `[regression] ${marker} ${testCase.id} score=${result.score.toFixed(4)} expected_duplicate=${testCase.expected_duplicate}`,
    );
    if (!result.passed) {
      failed += 1;
    }
  }

  if (failed > 0) {
    throw new Error(`Regression pair check failed: ${failed} case(s)`);
  }

  console.log("[regression] all cases passed");
}

main();
