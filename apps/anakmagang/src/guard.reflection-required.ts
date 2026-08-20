import { Array as Arr, Option } from "effect";
import * as Effect from "effect/Effect";
import { Allow, Block } from "./protocol.GuardResult";
import type { GuardFn } from "./guard.shared";

const fillerWords = new Set([
  "done",
  "ok",
  "okay",
  "yes",
  "no",
  "next",
  "continue",
  "moving",
  "proceed",
  "fine",
  "good",
  "n/a",
  "na",
  "yep",
  "nope",
  "skip",
  "pass",
]);

const reflectionPatterns = [/\banakmagang\s+eval\s+"([^"]*)"/, /\banakmagang\s+eval\s+'([^']*)'/];

const validateReflection = (reflection: string): { valid: boolean; error?: string } => {
  if (reflection.length === 0) {
    return {
      valid: false,
      error:
        "BLOCKED: Empty reflection. Answer the current phase's exit question before advancing.",
    };
  }
  if (fillerWords.has(reflection.toLowerCase())) {
    return {
      valid: false,
      error:
        "BLOCKED: Generic filler is not a reflection. Answer the current phase's exit question with a genuine response.",
    };
  }
  if (reflection.split(/\s+/).length < 3) {
    return {
      valid: false,
      error:
        "BLOCKED: Reflection too short (minimum 3 words). Answer the current phase's exit question with a genuine response.",
    };
  }
  return { valid: true };
};

export const reflectionRequired: GuardFn = (ctx) =>
  Effect.sync(() => {
    const command = ctx.input.tool_input?.["command"];
    if (typeof command !== "string") return Allow();

    return Arr.findFirst(reflectionPatterns, (pattern) => {
      const match = pattern.exec(command);
      return match !== null ? Option.some((match[1] ?? "").trim()) : Option.none();
    }).pipe(
      Option.match({
        onNone: () => Allow(),
        onSome: (reflection) => {
          const v = validateReflection(reflection);
          return v.valid ? Allow() : Block({ message: v.error ?? "" });
        },
      }),
    );
  });
