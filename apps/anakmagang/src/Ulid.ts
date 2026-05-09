const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
const ENCODING_LEN = ENCODING.length
const ULID_LEN = 26
const TIME_LEN = 10
const RANDOM_LEN = 16

const encodeTime = (now: number): string =>
  Array.from({ length: TIME_LEN }, (_, i) => i).reduceRight(
    (acc, _) => {
      const remainder = acc.t % ENCODING_LEN
      return { str: ENCODING[remainder] + acc.str, t: Math.floor(acc.t / ENCODING_LEN) }
    },
    { str: "", t: now },
  ).str

const encodeRandom = (): string => {
  const bytes = new Uint8Array(RANDOM_LEN)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ENCODING[b % ENCODING_LEN]).join("")
}

export const ulid = (): string => encodeTime(Date.now()) + encodeRandom()

const VALID_CHARS = new Set(ENCODING.split(""))

export const isUlid = (s: string): boolean =>
  s.length === ULID_LEN && s.split("").every((c) => VALID_CHARS.has(c))
