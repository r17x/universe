import * as Data from "effect/Data";
import type { Channel } from "./protocol.Transport";
import { Priority } from "./protocol.Transport";

export type Emission = Data.TaggedEnum<{
  Line: { readonly text: string };
  Record: { readonly fields: ReadonlyArray<readonly [string, string]> };
  Table: {
    readonly headers: ReadonlyArray<string>;
    readonly rows: ReadonlyArray<ReadonlyArray<string>>;
  };
  Document: {
    readonly content: string;
    readonly mediaType: "json" | "yaml" | "text" | "html" | "toml";
  };
  Diagnostic: { readonly severity: "info" | "warn" | "error"; readonly message: string };
}>;

export const { Line, Record, Table, Document, Diagnostic, $is, $match } =
  Data.taggedEnum<Emission>();

export const emissionChannel: (emission: Emission) => { channel: Channel; priority: Priority } =
  $match({
    Diagnostic: () => ({ channel: "stderr" as const, priority: Priority.Render }),
    Line: () => ({ channel: "stdout" as const, priority: Priority.Data }),
    Record: () => ({ channel: "stdout" as const, priority: Priority.Data }),
    Table: () => ({ channel: "stdout" as const, priority: Priority.Data }),
    Document: () => ({ channel: "stdout" as const, priority: Priority.Data }),
  });
