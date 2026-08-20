import { describe, test } from "bun:test";
import { Option } from "effect";
import {
  deepGet,
  resolveSource,
  formatNumber,
  formatValue,
  renderBar,
  renderDuration,
  renderSegment,
  renderDefault,
  renderFromConfig,
  renderStatusline,
  type SessionSnapshot,
  type SegmentDef,
} from "../../../StatuslineRenderer";
import type { HookInput } from "../../../guard";
import type { StatuslineConfigType } from "../../../MachineLoader";

const ITERATIONS = 1000;

const measure = (name: string, fn: () => void, iterations = ITERATIONS) => {
  for (let i = 0; i < 10; i++) fn();
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = performance.now() - start;
  const opsPerSec = Math.round((iterations / elapsed) * 1000);
  console.log(`  ${name}: ${elapsed.toFixed(2)}ms (${opsPerSec.toLocaleString()} ops/sec)`);
};

const mockInput: HookInput = {
  tool_name: "Edit",
  tool_input: { file_path: "/src/foo.ts", old_string: "abc", new_string: "def" },
  session_id: "ses-01JK",
  context_window: { used_percentage: 42.567 },
  agent_id: "worker-1",
};

const mockState: Option.Option<SessionSnapshot> = Option.some({
  sessionId: "ses-01JK",
  task: "implement statusline renderer benchmarks",
  phase: "impl",
});

const nestedObj: Record<string, unknown> = {
  a: { b: { c: "deep-value", d: 99 } },
  x: { y: [1, 2, 3] },
};

const mockSegment: SegmentDef = {
  id: "context",
  source: "stdin.context_window.used_percentage",
  render: "bar",
  width: 20,
  thresholds: [50, 90] as const,
};

const mockTextSegment: SegmentDef = {
  id: "task",
  source: "state.current_task",
  format: "[{value}]",
  render: "text",
};

const mockConfig: StatuslineConfigType = {
  segments: [
    {
      id: "context",
      source: "stdin.context_window.used_percentage",
      render: "bar",
      width: 20,
      thresholds: [50, 90],
    },
    { id: "task", source: "state.current_task", format: "[{value}]" },
    { id: "phase", source: "state.current_phase", format: "phase:{value}" },
    { id: "elapsed", source: "stdin.tool_input.elapsed_ms", render: "duration" },
  ],
  separator: " | ",
  presets: { minimal: ["context", "phase"], full: "all" },
  active: "full",
};

const mockConfigWithLayout: StatuslineConfigType = {
  ...mockConfig,
  layout: [["context", "phase"], ["task"]],
};

describe("deepGet", () => {
  test("nested path a.b.c", () => {
    measure("nested path a.b.c", () => {
      deepGet(nestedObj, "a.b.c");
    });
  });

  test("missing path a.b.z", () => {
    measure("missing path a.b.z", () => {
      deepGet(nestedObj, "a.b.z");
    });
  });

  test("single key", () => {
    measure("single key", () => {
      deepGet(nestedObj, "a");
    });
  });
});

describe("resolveSource", () => {
  test("stdin path", () => {
    measure("stdin path", () => {
      resolveSource("stdin.context_window.used_percentage", mockInput, mockState);
    });
  });

  test("state.current_task", () => {
    measure("state.current_task", () => {
      resolveSource("state.current_task", mockInput, mockState);
    });
  });

  test("state.current_phase", () => {
    measure("state.current_phase", () => {
      resolveSource("state.current_phase", mockInput, mockState);
    });
  });

  test("state with None", () => {
    measure("state with None", () => {
      resolveSource("state.current_task", mockInput, Option.none());
    });
  });
});

describe("formatNumber", () => {
  test("with .2f format", () => {
    measure("with .2f format", () => {
      formatNumber(42.567, ":.2f");
    });
  });

  test("with .0f format", () => {
    measure("with .0f format", () => {
      formatNumber(42.567, ":.0f");
    });
  });

  test("no format", () => {
    measure("no format", () => {
      formatNumber(42.567);
    });
  });
});

describe("formatValue", () => {
  test("number with format", () => {
    measure("number with format", () => {
      formatValue(42.567, "{value}%");
    });
  });

  test("string with format", () => {
    measure("string with format", () => {
      formatValue("hello", "[{value}]");
    });
  });

  test("null value", () => {
    measure("null value", () => {
      formatValue(null, "{value}");
    });
  });

  test("no format", () => {
    measure("no format", () => {
      formatValue("raw", undefined);
    });
  });
});

describe("renderBar", () => {
  test("75% width=20 with thresholds", () => {
    measure("75% width=20 with thresholds", () => {
      renderBar(75, 20, [50, 90]);
    });
  });

  test("95% critical zone", () => {
    measure("95% critical zone", () => {
      renderBar(95, 20, [50, 90]);
    });
  });

  test("30% safe zone", () => {
    measure("30% safe zone", () => {
      renderBar(30, 20, [50, 90]);
    });
  });

  test("no thresholds", () => {
    measure("no thresholds", () => {
      renderBar(50, 10, undefined);
    });
  });
});

describe("renderDuration", () => {
  test("125000ms", () => {
    measure("125000ms", () => {
      renderDuration(125000);
    });
  });

  test("3600000ms (1h)", () => {
    measure("3600000ms (1h)", () => {
      renderDuration(3600000);
    });
  });

  test("500ms", () => {
    measure("500ms", () => {
      renderDuration(500);
    });
  });
});

describe("renderSegment", () => {
  test("bar segment", () => {
    measure("bar segment", () => {
      renderSegment(mockSegment, mockInput, mockState);
    });
  });

  test("text segment from state", () => {
    measure("text segment from state", () => {
      renderSegment(mockTextSegment, mockInput, mockState);
    });
  });

  test("missing source returns undefined", () => {
    measure("missing source returns undefined", () => {
      renderSegment({ id: "x", source: "stdin.missing.path" }, mockInput, mockState);
    });
  });
});

describe("renderDefault", () => {
  test("with session state", () => {
    measure("with session state", () => {
      renderDefault(mockInput, mockState, false);
    });
  });

  test("without session state", () => {
    measure("without session state", () => {
      renderDefault(mockInput, Option.none(), false);
    });
  });
});

describe("renderFromConfig", () => {
  test("full preset", () => {
    measure("full preset", () => {
      renderFromConfig(mockConfig, mockInput, mockState, false);
    });
  });

  test("with layout", () => {
    measure("with layout", () => {
      renderFromConfig(mockConfigWithLayout, mockInput, mockState, false);
    });
  });
});

describe("renderStatusline", () => {
  test("config-based dispatch", () => {
    measure("config-based dispatch", () => {
      renderStatusline(mockConfig, mockInput, mockState, false);
    });
  });

  test("default dispatch (no config)", () => {
    measure("default dispatch (no config)", () => {
      renderStatusline(undefined, mockInput, mockState, false);
    });
  });

  test("layout-based dispatch", () => {
    measure("layout-based dispatch", () => {
      renderStatusline(mockConfigWithLayout, mockInput, mockState, false);
    });
  });
});
