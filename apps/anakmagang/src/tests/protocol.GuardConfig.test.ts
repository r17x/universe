import { describe, test, expect } from "bun:test";
import { computeContextPct } from "../protocol.GuardConfig";

describe("computeContextPct", () => {
  test("returns undefined for undefined input", () => {
    expect(computeContextPct(undefined)).toBeUndefined();
  });

  test("falls back to used_percentage when no raw fields", () => {
    expect(computeContextPct({ used_percentage: 42 })).toBe(42);
  });

  test("falls back to used_percentage when context_window_size is missing", () => {
    expect(computeContextPct({ used_percentage: 42, input_tokens: 100 })).toBe(42);
  });

  test("computes from raw tokens when all fields present", () => {
    const result = computeContextPct({
      used_percentage: 50,
      input_tokens: 100000,
      output_tokens: 50000,
      cache_creation_input_tokens: 10000,
      cache_read_input_tokens: 40000,
      context_window_size: 200000,
    });
    expect(result).toBe(100);
  });

  test("includes output_tokens in calculation unlike used_percentage", () => {
    const result = computeContextPct({
      used_percentage: 83,
      input_tokens: 140000,
      output_tokens: 26000,
      cache_creation_input_tokens: 10000,
      cache_read_input_tokens: 16000,
      context_window_size: 200000,
    });
    expect(result).toBe(96);
  });

  test("returns used_percentage when total tokens is 0 but used_percentage exists", () => {
    expect(
      computeContextPct({
        used_percentage: 5,
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        context_window_size: 200000,
      }),
    ).toBe(5);
  });

  test("returns undefined when no data at all", () => {
    expect(computeContextPct({})).toBeUndefined();
  });

  test("handles null token fields gracefully", () => {
    const result = computeContextPct({
      input_tokens: 100000,
      output_tokens: null,
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      context_window_size: 200000,
    });
    expect(result).toBe(50);
  });
});
