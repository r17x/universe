import { Match, Schema as S } from "effect"

type _YamlValue =
  | { readonly type: "YamlScalar"; readonly value: string | number | boolean | null }
  | { readonly type: "YamlList"; readonly items: readonly _YamlValue[] }
  | { readonly type: "YamlMap"; readonly entries: readonly { readonly key: string; readonly value: _YamlValue }[] }

const YamlScalarSchema = S.Struct({
  type: S.Literal("YamlScalar"),
  value: S.Union([S.String, S.Number, S.Boolean, S.Null]),
})

const YamlListSchema = S.Struct({
  type: S.Literal("YamlList"),
  items: S.Array(S.suspend((): S.Schema<_YamlValue> => YamlValue)),
})

const YamlMapSchema = S.Struct({
  type: S.Literal("YamlMap"),
  entries: S.Array(
    S.Struct({
      key: S.String,
      value: S.suspend((): S.Schema<_YamlValue> => YamlValue),
    }),
  ),
})

const YamlDocumentSchema = S.Struct({
  type: S.Literal("YamlDocument"),
  content: S.suspend((): S.Schema<_YamlValue> => YamlValue),
  comment: S.optionalKey(S.String),
})

export const YamlValue: S.Schema<_YamlValue> = S.Union([YamlScalarSchema, YamlListSchema, YamlMapSchema])
export const YamlDocument = YamlDocumentSchema

export type YamlValue = S.Schema.Type<typeof YamlValue>
export type YamlDocument = S.Schema.Type<typeof YamlDocument>

export const scalar = (value: string | number | boolean | null): YamlValue => ({
  type: "YamlScalar",
  value,
})

export const list = (items: ReadonlyArray<YamlValue>): YamlValue => ({
  type: "YamlList",
  items,
})

export const map = (entries: ReadonlyArray<{ key: string; value: YamlValue }>): YamlValue => ({
  type: "YamlMap",
  entries,
})

export const doc = (content: YamlValue, comment?: string): YamlDocument => ({
  type: "YamlDocument",
  content,
  ...(comment !== undefined ? { comment } : {}),
})

const prettyPrintValue = (value: YamlValue, indent = 0): string => {
  const spaces = "  ".repeat(indent)

  return Match.value(value).pipe(
    Match.when({ type: "YamlScalar" }, (node): string => {
      if (node.value === null) return "null"
      if (typeof node.value === "string") {
        if (
          node.value.includes(":") ||
          node.value.includes("#") ||
          node.value.includes("\n") ||
          node.value.includes('"') ||
          node.value.includes("*") ||
          node.value.includes("&") ||
          node.value.includes("!") ||
          node.value.includes("[") ||
          node.value.includes("]") ||
          node.value.includes("{") ||
          node.value.includes("}") ||
          node.value.includes(",") ||
          node.value.includes("|") ||
          node.value.includes(">") ||
          node.value.includes("'") ||
          node.value.includes("%") ||
          node.value.includes("@") ||
          node.value.includes("`") ||
          node.value === "" ||
          node.value === "true" ||
          node.value === "false" ||
          node.value === "null" ||
          /^\d/.test(node.value) ||
          /^[-?]/.test(node.value)
        ) {
          return `"${node.value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
        }
        return node.value
      }
      return String(node.value)
    }),
    Match.when({ type: "YamlList" }, (node): string => {
      if (node.items.length === 0) return "[]"
      return node.items
        .map((item) =>
          `${spaces}- ${prettyPrintValue(item, indent + 1).trim()}`
        )
        .join("\n")
    }),
    Match.when({ type: "YamlMap" }, (node): string => {
      if (node.entries.length === 0) return "{}"
      return node.entries
        .map(({ key, value: v }) => {
          const valueStr = prettyPrintValue(v, indent + 1)
          if (v.type === "YamlList" || v.type === "YamlMap") {
            return `${spaces}${key}:\n${valueStr}`
          }
          return `${spaces}${key}: ${valueStr.trim()}`
        })
        .join("\n")
    }),
    Match.exhaustive,
  )
}

export const prettyPrintDoc = (document: YamlDocument): string =>
  (document.comment !== undefined ? `# ${document.comment}\n` : "") +
  prettyPrintValue(document.content, 0)


interface QuoteState {
  readonly inSingle: boolean
  readonly inDouble: boolean
}

const initialQuoteState: QuoteState = { inSingle: false, inDouble: false }

const advanceQuoteState = (state: QuoteState, ch: string, prev: string): QuoteState =>
  ch === "'" && !state.inDouble
    ? { ...state, inSingle: !state.inSingle }
    : ch === '"' && !state.inSingle && prev !== "\\"
      ? { ...state, inDouble: !state.inDouble }
      : state

const stripComment = (line: string): string => {
  const walkChars = (idx: number, state: QuoteState): string => {
    if (idx >= line.length) return line
    const ch = line[idx]
    const prev = idx > 0 ? line[idx - 1] : ""
    const nextState = advanceQuoteState(state, ch, prev)
    if (ch === "#" && !nextState.inSingle && !nextState.inDouble && (idx === 0 || line[idx - 1] === " "))
      return line.slice(0, idx).trimEnd()
    return walkChars(idx + 1, nextState)
  }
  return walkChars(0, initialQuoteState)
}

const parseScalar = (raw: string): unknown => {
  if (raw === "" || raw === "null" || raw === "~") return null
  if (raw === "true") return true
  if (raw === "false") return false
  if (raw === "[]") return []
  if (raw === "{}") return {}

  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    const inner = raw.slice(1, -1)
    if (raw.startsWith('"')) {
      return inner
        .replace(/\\n/g, "\n")
        .replace(/\\t/g, "\t")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\")
    }
    return inner.replace(/''/g, "'")
  }

  const num = Number(raw)
  if (!Number.isNaN(num) && raw !== "") return num

  return raw
}

interface ParsedLine {
  readonly indent: number
  readonly content: string
}

const prepareLines = (input: string): ReadonlyArray<ParsedLine> =>
  input.split("\n").reduce<ReadonlyArray<ParsedLine>>((acc, rawLine) => {
    const trimmed = rawLine.trimStart()
    if (trimmed === "" || trimmed.startsWith("#")) return acc
    const content = stripComment(trimmed)
    if (content === "") return acc
    const indent = rawLine.length - trimmed.length
    return [...acc, { indent, content }]
  }, [])

const findTopLevelColon = (s: string): number => {
  const walk = (idx: number, state: QuoteState): number => {
    if (idx >= s.length) return -1
    const ch = s[idx]
    const prev = idx > 0 ? s[idx - 1] : ""
    const nextState = advanceQuoteState(state, ch, prev)
    if (ch === ":" && !nextState.inSingle && !nextState.inDouble && (idx + 1 === s.length || s[idx + 1] === " "))
      return idx
    return walk(idx + 1, nextState)
  }
  return walk(0, initialQuoteState)
}

interface ParseResult {
  readonly value: unknown
  readonly next: number
}

const parseBlock = (lines: ReadonlyArray<ParsedLine>, start: number, baseIndent: number): ParseResult => {
  if (start >= lines.length) return { value: null, next: start }

  const line = lines[start]
  if (line.indent < baseIndent) return { value: null, next: start }

  if (line.content.startsWith("- ") || line.content === "-") {
    return parseSequence(lines, start, line.indent)
  }

  const colonIdx = findTopLevelColon(line.content)
  if (colonIdx !== -1) {
    return parseMapping(lines, start, line.indent)
  }

  return { value: parseScalar(line.content), next: start + 1 }
}

const parseMapping = (lines: ReadonlyArray<ParsedLine>, start: number, baseIndent: number): ParseResult => {
  const accumulate = (idx: number, entries: ReadonlyArray<readonly [string, unknown]>): ParseResult => {
    if (idx >= lines.length) return { value: Object.fromEntries(entries), next: idx }

    const line = lines[idx]
    if (line.indent !== baseIndent) return { value: Object.fromEntries(entries), next: idx }

    const colonIdx = findTopLevelColon(line.content)
    if (colonIdx === -1) return { value: Object.fromEntries(entries), next: idx }

    const key = line.content.slice(0, colonIdx).trim()
    const afterColon = line.content.slice(colonIdx + 1).trim()

    if (afterColon !== "") {
      return accumulate(idx + 1, [...entries, [key, parseScalar(afterColon)]])
    }

    const nextIdx = idx + 1
    if (nextIdx < lines.length && lines[nextIdx].indent > baseIndent) {
      const sub = parseBlock(lines, nextIdx, lines[nextIdx].indent)
      return accumulate(sub.next, [...entries, [key, sub.value]])
    }

    return accumulate(nextIdx, [...entries, [key, null]])
  }

  return accumulate(start, [])
}

const parseSequence = (lines: ReadonlyArray<ParsedLine>, start: number, baseIndent: number): ParseResult => {
  const accumulate = (idx: number, items: ReadonlyArray<unknown>): ParseResult => {
    if (idx >= lines.length) return { value: items, next: idx }

    const line = lines[idx]
    if (line.indent !== baseIndent) return { value: items, next: idx }
    if (!line.content.startsWith("-")) return { value: items, next: idx }

    if (line.content === "-") {
      const nextIdx = idx + 1
      if (nextIdx < lines.length && lines[nextIdx].indent > baseIndent) {
        const sub = parseBlock(lines, nextIdx, lines[nextIdx].indent)
        return accumulate(sub.next, [...items, sub.value])
      }
      return accumulate(nextIdx, [...items, null])
    }

    const itemContent = line.content.slice(2)
    const itemColonIdx = findTopLevelColon(itemContent)

    if (itemColonIdx !== -1) {
      const collectNested = (j: number, acc: ReadonlyArray<ParsedLine>): ReadonlyArray<ParsedLine> =>
        j < lines.length && lines[j].indent > baseIndent
          ? collectNested(j + 1, [...acc, lines[j]])
          : acc

      const nestedLines = collectNested(idx + 1, [])
      const virtualLines: ReadonlyArray<ParsedLine> = [
        { indent: baseIndent + 2, content: itemContent },
        ...nestedLines,
      ]
      const sub = parseBlock(virtualLines, 0, baseIndent + 2)
      return accumulate(idx + 1 + nestedLines.length, [...items, sub.value])
    }

    return accumulate(idx + 1, [...items, parseScalar(itemContent)])
  }

  return accumulate(start, [])
}

export const parse = (input: string): unknown => {
  const lines = prepareLines(input)
  if (lines.length === 0) return null
  const result = parseBlock(lines, 0, lines[0].indent)
  return result.value
}

export const parseFrontmatter = (content: string): { fm: Record<string, unknown>; body: string } | null => {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/)
  if (!match) return null
  const parsed = parse(match[1])
  const isRecord = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === "object"
  if (!isRecord(parsed)) return null
  return { fm: parsed, body: match[2].trim() }
}
