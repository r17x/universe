import { describe, test } from "bun:test";
import { join } from "node:path";

// Safety: all commands below are read-only (state, memory status/query, config list/get,
// hook list, search find/grep). No mutating commands (start, eval, drop, hook eval) are used,
// so running against the real project directory cannot pollute session state.

const ITERATIONS = 10;

const measureAsync = async (name: string, fn: () => Promise<void>, iterations = ITERATIONS) => {
  for (let i = 0; i < 3; i++) await fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) await fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const BIN_PATH = join(import.meta.dir, "..", "..", "..", "bin.ts");
const CWD = join(import.meta.dir, "..", "..", "..", "..");

const run = async (args: ReadonlyArray<string>): Promise<void> => {
  const proc = Bun.spawn(["bun", "run", BIN_PATH, ...args], {
    cwd: CWD,
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;
};

describe("State Commands", () => {
  test("anakmagang state", async () => {
    await measureAsync("anakmagang state", async () => {
      await run(["state"]);
    });
  });

  test("anakmagang state --sort latest --limit 5", async () => {
    await measureAsync("anakmagang state --sort latest --limit 5", async () => {
      await run(["state", "--sort", "latest", "--limit", "5"]);
    });
  });
});

describe("Memory Commands", () => {
  test("anakmagang memory status", async () => {
    await measureAsync("anakmagang memory status", async () => {
      await run(["memory", "status"]);
    });
  });

  test("anakmagang memory query effect", async () => {
    await measureAsync("anakmagang memory query effect", async () => {
      await run(["memory", "query", "effect"]);
    });
  });
});

describe("Config Commands", () => {
  test("anakmagang config list", async () => {
    await measureAsync("anakmagang config list", async () => {
      await run(["config", "list"]);
    });
  });

  test("anakmagang config get name", async () => {
    await measureAsync("anakmagang config get name", async () => {
      await run(["config", "get", "name"]);
    });
  });
});

describe("Hook Commands", () => {
  test("anakmagang hook list", async () => {
    await measureAsync("anakmagang hook list", async () => {
      await run(["hook", "list"]);
    });
  });

  test("anakmagang hook list --event UserPromptSubmit", async () => {
    await measureAsync("anakmagang hook list --event UserPromptSubmit", async () => {
      await run(["hook", "list", "--event", "UserPromptSubmit"]);
    });
  });
});

describe("Search Commands", () => {
  test("anakmagang search find *.ts", async () => {
    await measureAsync("anakmagang search find *.ts", async () => {
      await run(["search", "find", "*.ts"]);
    });
  });

  test("anakmagang search grep Effect", async () => {
    await measureAsync("anakmagang search grep Effect", async () => {
      await run(["search", "grep", "Effect"]);
    });
  });
});
