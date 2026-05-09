export interface ErrorContext {
  readonly service: string
  readonly operation?: string | undefined
  readonly resource?: string | undefined
}

export const formatError = (ctx: ErrorContext, message: string): string =>
  [
    `[${ctx.service}`,
    ctx.operation ? `.${ctx.operation}` : "",
    "]",
    ctx.resource ? ` (${ctx.resource})` : "",
    `: ${message}`,
  ].join("")
