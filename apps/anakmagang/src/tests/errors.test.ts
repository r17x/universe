import { describe, test, expect } from "bun:test"
import { formatError } from "../errors"

describe("formatError", () => {
  test("full context produces [Service.operation] (resource): message", () => {
    const result = formatError(
      { service: "MemoryStore", operation: "create", resource: "node-1" },
      "already exists"
    )
    expect(result).toBe("[MemoryStore.create] (node-1): already exists")
  })

  test("no operation produces [Service] (resource): message", () => {
    const result = formatError(
      { service: "FileSystem", resource: "/tmp/file" },
      "not found"
    )
    expect(result).toBe("[FileSystem] (/tmp/file): not found")
  })

  test("no resource produces [Service.operation]: message", () => {
    const result = formatError(
      { service: "Config", operation: "load" },
      "invalid format"
    )
    expect(result).toBe("[Config.load]: invalid format")
  })

  test("minimal produces [Service]: message", () => {
    const result = formatError(
      { service: "App" },
      "unexpected error"
    )
    expect(result).toBe("[App]: unexpected error")
  })
})
