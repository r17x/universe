import { describe, test } from "bun:test";
import { Effect } from "effect";
import { isUlid, ulid } from "../../../Ulid";

const ITERATIONS = 1000;

const measure = (name: string, fn: () => void, iterations = ITERATIONS) => {
  for (let i = 0; i < 10; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const validUlid = Effect.runSync(ulid);

describe("Ulid", () => {
  test("ulid() — generate", () => {
    measure("ulid() — generate", () => {
      Effect.runSync(ulid);
    });
  });

  test("isUlid(validUlid) — valid", () => {
    measure("isUlid(validUlid) — valid", () => {
      isUlid(validUlid);
    });
  });

  test("isUlid('invalid') — invalid", () => {
    measure("isUlid('invalid') — invalid", () => {
      isUlid("invalid");
    });
  });
});
