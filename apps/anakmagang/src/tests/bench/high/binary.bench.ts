// Compiled binary optimization benchmarks — codifies the measurement methodology from rounds 1-8.
//
// Safety: uses --version for all measurements. Effect CLI handles --version before Config
// resolution, so it never walks up to find .anakmagang/config.yaml or touch real session data.
import { describe, test, expect } from "bun:test";
import { join } from "node:path";
import { existsSync } from "node:fs";

const BINARY_PATH = join(import.meta.dir, "..", "..", "..", "..", "anakmagang");
const CWD = join(import.meta.dir, "..", "..", "..", "..");
const BINARY_EXISTS = existsSync(BINARY_PATH);

const RSS_RUNS = 3;
const STARTUP_ITERATIONS = 5;

const measureRss = async (
  runs: number = RSS_RUNS,
): Promise<{ avg: number; min: number; max: number }> => {
  const results: Array<number> = [];
  for (let i = 0; i < runs; i++) {
    const proc = Bun.spawn(["/usr/bin/time", "-l", BINARY_PATH, "--version"], {
      cwd: CWD,
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    const stderr = await new Response(proc.stderr).text();
    const match = stderr.match(/(\d+)\s+maximum resident set size/);
    if (match) results.push(parseInt(match[1]) / (1024 * 1024));
  }
  if (results.length === 0) return { avg: 0, min: 0, max: 0 };
  return {
    avg: results.reduce((a, b) => a + b, 0) / results.length,
    min: Math.min(...results),
    max: Math.max(...results),
  };
};

const measureStartup = async (
  iterations: number = STARTUP_ITERATIONS,
): Promise<{ avg: number; min: number; max: number }> => {
  for (let i = 0; i < 2; i++) {
    const warmup = Bun.spawn([BINARY_PATH, "--version"], {
      cwd: CWD,
      stdout: "pipe",
      stderr: "pipe",
    });
    await warmup.exited;
  }

  const results: Array<number> = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const proc = Bun.spawn([BINARY_PATH, "--version"], {
      cwd: CWD,
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    results.push(performance.now() - start);
  }
  return {
    avg: results.reduce((a, b) => a + b, 0) / results.length,
    min: Math.min(...results),
    max: Math.max(...results),
  };
};

describe.skipIf(!BINARY_EXISTS)("Compiled Binary", () => {
  test("binary size", async () => {
    const file = Bun.file(BINARY_PATH);
    const sizeBytes = file.size;
    const sizeMb = sizeBytes / (1024 * 1024);
    console.log(`  binary size: ${sizeMb.toFixed(2)} MB (${sizeBytes.toLocaleString()} bytes)`);
    expect(sizeBytes).toBeGreaterThan(0);
  });

  test("peak RSS (--version)", async () => {
    const rss = await measureRss();
    console.log(
      `  peak RSS avg: ${rss.avg.toFixed(2)} MB (min: ${rss.min.toFixed(2)}, max: ${rss.max.toFixed(2)}, runs: ${RSS_RUNS})`,
    );
    expect(rss.avg).toBeGreaterThan(0);
  }, 30_000);

  test("startup time (--version)", async () => {
    const timing = await measureStartup();
    console.log(
      `  startup avg: ${timing.avg.toFixed(2)}ms (min: ${timing.min.toFixed(2)}, max: ${timing.max.toFixed(2)}, iterations: ${STARTUP_ITERATIONS})`,
    );
    expect(timing.avg).toBeGreaterThan(0);
  }, 30_000);

  test("binary size as module-count proxy", async () => {
    const file = Bun.file(BINARY_PATH);
    const sizeMb = file.size / (1024 * 1024);
    console.log(`  module-count proxy (binary size): ${sizeMb.toFixed(2)} MB`);
    console.log(`  rule of thumb: fewer bundled modules = smaller binary`);
    expect(sizeMb).toBeGreaterThan(0);
  });
});
