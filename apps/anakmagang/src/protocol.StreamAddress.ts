import { Option, Schema } from "effect";

export const StreamAddress = Schema.Struct({
  owner: Schema.String,
  name: Schema.String,
});

export type StreamAddress = typeof StreamAddress.Type;

export const parseAddress = (s: string): Option.Option<StreamAddress> => {
  const idx = s.indexOf(":");
  if (idx === -1) return Option.none();
  return Option.some({ owner: s.slice(0, idx), name: s.slice(idx + 1) });
};

export const formatAddress = (addr: StreamAddress): string => `${addr.owner}:${addr.name}`;

export const sessionStream = (sid: string, name: string): StreamAddress => ({ owner: sid, name });

export const GUARD_RESULTS: StreamAddress = { owner: "guard", name: "results" };
