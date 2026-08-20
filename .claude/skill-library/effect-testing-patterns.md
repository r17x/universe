# Effect Testing Patterns

Testing Effect-TS code with `bun:test`. Patterns extracted from `apps/anakmagang/src/tests/`.

## Running Effect in Tests

Use `Effect.runPromise` for async tests, `Effect.runSync` for pure synchronous effects.

```typescript
import { describe, test, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { BunServices } from "effect/unstable/BunServices"

test("async effect test", async () => {
  const result = await Effect.runPromise(
    Effect.gen(function* () {
      const svc = yield* MyService
      return yield* svc.doThing("input")
    }).pipe(Effect.provide(TestLayer))
  )
  expect(result).toBe("expected")
})
```

## Test Layer Composition

Build a composite test layer with `Layer.provideMerge`. Pattern from `guard.test.ts`:

```typescript
const TestLayer = GuardEvaluator.layer.pipe(
  Layer.provideMerge(Output.silent),
  Layer.provideMerge(BunServices.layer),
)

const run = <A, E>(effect: Effect.Effect<A, E, GuardEvaluator>) =>
  Effect.runPromise(effect.pipe(Effect.provide(TestLayer)))
```

`Output.silent` replaces real stdout/stderr with a no-op sink. `BunServices.layer` provides `Stdio` and other platform services. Order matters: the service layer goes first, then its dependencies via `provideMerge`.

## Guard Testing (Unit, Not Bash)

Test guards by calling the evaluator directly. From `guard.agent-first.test.ts`:

```typescript
const env: HookEnv = { CLAUDE_PROJECT_DIR: "/tmp/test-project" }
const guard: GuardConfig = { type: "agent-first", event: "PreToolUse", matcher: "Edit|Write" }

const evaluate = (input: HookInput) =>
  run(
    Effect.gen(function* () {
      const evaluator = yield* GuardEvaluator
      return yield* evaluator.evaluate({ input, env, guard })
    })
  )

test("blocks Edit without agent_id", async () => {
  const result = await evaluate({ tool_name: "Edit", tool_input: { file_path: "/tmp/test.ts" } })
  expect(result._tag).toBe("Block")
})

test("block message includes the file path", async () => {
  const result = await evaluate({ tool_name: "Write", tool_input: { file_path: "/tmp/my-file.ts" } })
  expect($is("Block")(result) ? result.message : "").toContain("/tmp/my-file.ts")
})
```

## Parameterized Tests

Use for-loops to build test matrices. From `output.e2e.test.ts`:

```typescript
test("silentSink produces empty string for all emissions", () => {
  const emissions = [
    Line({ text: "hello" }),
    Record({ fields: [["k", "v"]] }),
    Table({ headers: ["A"], rows: [["1"]] }),
    Document({ content: "body", mediaType: "text" }),
    Diagnostic({ severity: "warn", message: "caution" }),
  ]
  for (const e of emissions) {
    const projected = silentSink.projection(e)
    const formatted = silentSink.format(projected)
    expect(formatted).toBe("")
  }
})
```

For labeled test cases, use `test` per case or labeled arrays:

```typescript
test("produces valid JSON for each variant", () => {
  const variants: Emission[] = [
    Line({ text: "x" }),
    Record({ fields: [["k", "v"]] }),
    Table({ headers: ["H"], rows: [["R"]] }),
    Document({ content: "c", mediaType: "yaml" }),
    Diagnostic({ severity: "info", message: "m" }),
  ]
  for (const v of variants) {
    const result = json(v)
    expect(() => JSON.parse(result)).not.toThrow()
  }
})
```

## Schema Validation in Tests

Use `Schema.decodeUnknownSync` for test assertions. From `compare-fff.test.ts`:

```typescript
import { Schema } from "effect"

const doHealthCheck = (): unknown => {
  const jsonStr = unwrapResultString(lib, resultPtr, "<healthCheck>")
  return jsonStr
    ? Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Unknown))(jsonStr)
    : null
}

test("healthCheck returns a non-null object", () => {
  const result = doHealthCheck()
  expect(result).not.toBeNull()
  expect(typeof result).toBe("object")
})
```

## Option.getOrThrow in Tests

Use `Option.getOrThrow` for test assertions where None means test failure. From `protocol.test.ts`:

```typescript
import { Option } from "effect"

test("formatAddress roundtrips with parseAddress", () => {
  const addr = Option.getOrThrow(parseAddress("session:phases"))
  expect(formatAddress(addr)).toBe("session:phases")
})
```

## Pure Function Tests (No Effect Runtime)

Many tests don't need `Effect.runPromise` at all. From `protocol.test.ts`:

```typescript
test("all Allow results in fulfilled", () => {
  const result = resolveIntent([Allow(), Allow()])
  expect(result.status).toBe("fulfilled")
  expect(result.results.length).toBe(2)
})

test("Block always results in rejected", () => {
  const result = resolveIntent([Allow(), Block({ message: "msg" }), Warn({ message: "x" })])
  expect(result.status).toBe("rejected")
})
```

## Test Setup/Teardown with FFI

Tests CAN use try/catch and imperative setup. From `compare-fff.test.ts`:

```typescript
let lib: FffLib
let handle: Pointer

beforeAll(() => {
  lib = openLib(LIB_PATH)
  const createPtr = lib.symbols.fff_create_instance2(buf(BASE_PATH), ...)
  handle = unwrapResult(lib, createPtr, "<test-init>")
})

afterAll(() => {
  if (handle && lib) {
    lib.symbols.fff_destroy(handle)
    lib.close()
  }
})
```

## Anti-Patterns

- **NEVER test guards via bash pipes** -- guards see themselves in the outer command. Use bun unit tests with `GuardEvaluator` directly.
- **NEVER use `JSON.parse` in assertions when `Schema.decodeUnknownSync` is available** -- Schema decode validates structure, JSON.parse only validates syntax.
- **Tests CAN use try/catch for setup** -- imperative setup (beforeAll/afterAll) is fine in tests, not in production Effect code.
- **Tests CAN use `Option.getOrThrow`** -- acceptable for assertions where None means test failure. Production code must handle None explicitly.
- **NEVER put business logic in tests** -- tests call services/functions, they don't reimplement them.
