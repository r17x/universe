import { Array as Arr, Brand, Clock, Effect, Schema } from "effect";

const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ENCODING_LEN = ENCODING.length;
const TIME_LEN = 10;
const RANDOM_LEN = 16;

export type Ulid = Brand.Branded<string, "Ulid">;

export const Ulid = Brand.nominal<Ulid>();

export const UlidSchema = Schema.String.pipe(
  Schema.check(Schema.isLengthBetween(26, 26)),
  Schema.check(Schema.isPattern(/^[0-9A-HJKMNP-TV-Z]{26}$/)),
  Schema.fromBrand("Ulid", Ulid),
);

export const isUlid = Schema.is(UlidSchema);

export type SessionId = Brand.Branded<string, "SessionId">;

export const SessionId = Brand.nominal<SessionId>();

export const SessionIdSchema = Schema.String.pipe(
  Schema.check(Schema.isLengthBetween(26, 26)),
  Schema.check(Schema.isPattern(/^[0-9A-HJKMNP-TV-Z]{26}$/)),
  Schema.fromBrand("SessionId", SessionId),
);

const encodeTime = (now: number) =>
  Arr.makeBy(
    TIME_LEN,
    (i) => ENCODING[Math.floor(now / ENCODING_LEN ** (TIME_LEN - 1 - i)) % ENCODING_LEN],
  ).join("");

const encodeRandom = () => {
  const bytes = new Uint8Array(RANDOM_LEN);
  crypto.getRandomValues(bytes);
  return Arr.fromIterable(bytes)
    .map((b) => ENCODING[b % ENCODING_LEN])
    .join("");
};

export const ulid = Effect.map(Clock.currentTimeMillis, (now) =>
  SessionId(encodeTime(now) + encodeRandom()),
);
