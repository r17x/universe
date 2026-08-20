import { bench, group, afterAll } from "bun:test";
import { mkdtempSync, cpSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const PROJECT_DIR = join(import.meta.dir, "..", "..", "..", "..");
const APP_DIR = join(import.meta.dir, "..", "..");
const BIN_PATH = join(import.meta.dir, "..", "bin.ts");

const SANDBOX_ROOT = mkdtempSync(join(tmpdir(), "anakmagang-bench-"));
mkdirSync(join(SANDBOX_ROOT, ".anakmagang"), { recursive: true });
cpSync(
  join(PROJECT_DIR, ".anakmagang", "config.yaml"),
  join(SANDBOX_ROOT, ".anakmagang", "config.yaml"),
);
mkdirSync(join(SANDBOX_ROOT, ".anakmagang", "out"), { recursive: true });
mkdirSync(join(SANDBOX_ROOT, ".claude", "memories"), { recursive: true });
mkdirSync(join(SANDBOX_ROOT, ".claude", "agents"), { recursive: true });
mkdirSync(join(SANDBOX_ROOT, ".claude", "skills"), { recursive: true });

writeFileSync(join(SANDBOX_ROOT, "ARCHITECTURE.md"), "# Benchmark fixture\nDomain routing test.\n");
writeFileSync(
  join(SANDBOX_ROOT, ".claude", "memories", "bench-fixture.md"),
  "---\nname: bench-fixture\ndescription: benchmark fixture memory\ntype: project\nupdated: 2026-01-01\n---\nEffect benchmark fixture\n",
);
writeFileSync(
  join(SANDBOX_ROOT, ".claude", "agents", "bench-agent.md"),
  "# Bench Agent\n\nA fixture agent for benchmarks.\n\n## Role\nBenchmark agent.\n",
);

afterAll(() => {
  rmSync(SANDBOX_ROOT, { recursive: true, force: true });
});

const runCli = async (args: ReadonlyArray<string>, cwd?: string): Promise<void> => {
  const proc = Bun.spawn(["bun", "run", BIN_PATH, ...args], {
    cwd: cwd ?? SANDBOX_ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });
  await proc.exited;
};

group("CLI Invocation", () => {
  bench("anakmagang state", async () => {
    await runCli(["state"]);
  });

  bench("anakmagang state --sort latest --limit 5", async () => {
    await runCli(["state", "--sort", "latest", "--limit", "5"]);
  });

  bench("anakmagang memory status", async () => {
    await runCli(["memory", "status"]);
  });

  bench("anakmagang memory query effect", async () => {
    await runCli(["memory", "query", "effect"]);
  });

  bench("anakmagang hook list", async () => {
    await runCli(["hook", "list"]);
  });

  bench("anakmagang config list", async () => {
    await runCli(["config", "list"]);
  });
});

group("DirtyBits (Subprocess)", () => {
  const SESSION_DIR = join(SANDBOX_ROOT, ".anakmagang", "out", "bench-dirty");
  mkdirSync(SESSION_DIR, { recursive: true });
  writeFileSync(
    join(SESSION_DIR, "manifest.yaml"),
    "events:\n  - type: task_start\n    task: benchmark\n    timestamp: 2026-01-01T00:00:00Z\n",
  );

  bench("DirtyBits.snapshot via CLI", async () => {
    const proc = Bun.spawn(["git", "diff", "--name-only", "HEAD"], {
      cwd: PROJECT_DIR,
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    await new Response(proc.stdout).text();
  });

  bench("DirtyBits.diff via CLI", async () => {
    const proc = Bun.spawn(["git", "diff", "--name-only"], {
      cwd: PROJECT_DIR,
      stdout: "pipe",
      stderr: "pipe",
    });
    await proc.exited;
    await new Response(proc.stdout).text();
  });
});

group("Guard Pipeline (inject-reminders)", () => {
  const hookInput = JSON.stringify({
    session_id: "bench-session-id",
    tool_input: {},
  });

  bench("hook eval UserPromptSubmit (full guard chain)", async () => {
    const proc = Bun.spawn(
      ["bun", "run", BIN_PATH, "hook", "eval", "--event", "UserPromptSubmit"],
      {
        cwd: SANDBOX_ROOT,
        stdout: "pipe",
        stderr: "pipe",
        stdin: new Blob([hookInput]),
      },
    );
    await proc.exited;
  });

  bench("hook eval PreToolUse (full guard chain)", async () => {
    const preToolInput = JSON.stringify({
      session_id: "bench-session-id",
      tool_name: "Bash",
      tool_input: { command: "echo hello" },
    });
    const proc = Bun.spawn(["bun", "run", BIN_PATH, "hook", "eval", "--event", "PreToolUse"], {
      cwd: SANDBOX_ROOT,
      stdout: "pipe",
      stderr: "pipe",
      stdin: new Blob([preToolInput]),
    });
    await proc.exited;
  });

  bench("hook eval PostToolUse (full guard chain)", async () => {
    const postToolInput = JSON.stringify({
      session_id: "bench-session-id",
      tool_name: "Edit",
      tool_input: { file_path: "/tmp/test.ts" },
    });
    const proc = Bun.spawn(["bun", "run", BIN_PATH, "hook", "eval", "--event", "PostToolUse"], {
      cwd: SANDBOX_ROOT,
      stdout: "pipe",
      stderr: "pipe",
      stdin: new Blob([postToolInput]),
    });
    await proc.exited;
  });
});

group("Search (FFI)", () => {
  const LIBFFF_PATH = join(APP_DIR, "native");
  const libPath = join(LIBFFF_PATH, "libfff_c.dylib");

  let libAvailable = false;
  try {
    const stat = Bun.file(libPath);
    libAvailable = stat.size > 0;
  } catch {
    libAvailable = false;
  }

  if (libAvailable) {
    bench("Search.find *.ts (file fuzzy search)", async () => {
      const proc = Bun.spawn(["bun", "run", BIN_PATH, "search", "find", "*.ts"], {
        cwd: PROJECT_DIR,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, LIBFFF_PATH },
      });
      await proc.exited;
    });

    bench("Search.grep Effect (content search)", async () => {
      const proc = Bun.spawn(["bun", "run", BIN_PATH, "search", "grep", "Effect"], {
        cwd: PROJECT_DIR,
        stdout: "pipe",
        stderr: "pipe",
        env: { ...process.env, LIBFFF_PATH },
      });
      await proc.exited;
    });

    bench("Search.multiGrep [Effect, Schema] (multi-pattern)", async () => {
      const proc = Bun.spawn(
        ["bun", "run", BIN_PATH, "search", "grep", "Effect", "--pattern", "Schema"],
        {
          cwd: PROJECT_DIR,
          stdout: "pipe",
          stderr: "pipe",
          env: { ...process.env, LIBFFF_PATH },
        },
      );
      await proc.exited;
    });
  } else {
    bench("Search (SKIPPED - libfff_c.dylib not found)", () => {});
  }
});

group("Full Hook Evaluation Pipeline", () => {
  bench("E2E hook pipeline (parse stdin + resolve session + evaluate guards + render)", async () => {
    const fullInput = JSON.stringify({
      session_id: "bench-full-pipeline",
      context_window: { used_percentage: 0.5 },
      transcript_path: "/tmp/bench-transcript",
      tool_input: {},
    });
    const proc = Bun.spawn(
      ["bun", "run", BIN_PATH, "hook", "eval", "--event", "UserPromptSubmit"],
      {
        cwd: SANDBOX_ROOT,
        stdout: "pipe",
        stderr: "pipe",
        stdin: new Blob([fullInput]),
      },
    );
    await proc.exited;
    await new Response(proc.stdout).text();
  });

  bench("E2E hook pipeline (Notification event - minimal guards)", async () => {
    const notifInput = JSON.stringify({
      session_id: "bench-notification",
    });
    const proc = Bun.spawn(["bun", "run", BIN_PATH, "hook", "eval", "--event", "Notification"], {
      cwd: SANDBOX_ROOT,
      stdout: "pipe",
      stderr: "pipe",
      stdin: new Blob([notifInput]),
    });
    await proc.exited;
  });
});

group("MachineLoader.generate", () => {
  bench("scaffold generation to temp directory", async () => {
    const tempTarget = mkdtempSync(join(tmpdir(), "anakmagang-scaffold-"));
    mkdirSync(join(tempTarget, ".claude", "skills"), { recursive: true });
    try {
      await runCli(["init", "--force"], tempTarget);
    } finally {
      rmSync(tempTarget, { recursive: true, force: true });
    }
  });
});

group("Audit Pipeline", () => {
  bench("audit agents (all agent files)", async () => {
    await runCli(["audit", "agents"]);
  });

  bench("audit skills (all skill files)", async () => {
    await runCli(["audit", "skills"]);
  });

  bench("audit all (agents + skills combined)", async () => {
    await runCli(["audit", "all"]);
  });
});
