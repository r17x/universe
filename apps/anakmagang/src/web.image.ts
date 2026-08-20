import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Arr from "effect/Array";
import * as Random from "effect/Random";
import { HttpRouter, HttpServerResponse } from "effect/unstable/http";

export const glyphRegistry: ReadonlyArray<string> = [
  "\u{1D706}", // 𝜆 MATH ITALIC SMALL LAMBDA (f)
  "\u{1D6EC}", // 𝛬 MATH BOLD CAPITAL LAMBDA (a)
  "\u{1D6B4}", // 𝚴 MATH BOLD CAPITAL NU (n)
  "\u{1D6E2}", // 𝛢 MATH ITALIC CAPITAL ALPHA (a)
  "\u{1D6CB}", // 𝛋 MATH BOLD CAPITAL KAPPA (k)
  "\u{1D6AD}", // 𝚭 MATH BOLD CAPITAL MU (m)
  "\u{1D756}", // 𝝖 MATH BOLD ITALIC CAPITAL ALPHA (a)
  "\u{1D6E4}", // 𝛤 MATH ITALIC CAPITAL GAMMA (g)
  "\u{1D790}", // 𝞐 MATH SANS BOLD CAPITAL ALPHA (a)
  "\u{1D72E}", // 𝜮 MATH BOLD ITALIC CAPITAL NU (n)
  "\u{1D7AA}", // 𝞪 MATH SANS BOLD CAPITAL GAMMA (g)
];

export const glyphToSvg = (glyph: string): string =>
  [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">`,
    `  <rect width="32" height="32" fill="#0a0a0a" rx="4"/>`,
    `  <text x="16" y="16" fill="#06b6d4" font-size="22" font-family="sans-serif" text-anchor="middle" dominant-baseline="central">${glyph}</text>`,
    `</svg>`,
  ].join("\n");

const svgResponse = (svg: string) => HttpServerResponse.text(svg, { contentType: "image/svg+xml" });

export const ImageRoutesLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const router = yield* HttpRouter.HttpRouter;

    yield* router.add(
      "GET",
      "/favicon.svg",
      Effect.gen(function* () {
        const idx = yield* Random.nextIntBetween(0, glyphRegistry.length);
        return svgResponse(glyphToSvg(glyphRegistry[idx] ?? glyphRegistry[0] ?? ""));
      }),
    );

    yield* Effect.forEach(Arr.range(0, 10), (n) =>
      router.add("GET", `/assets/${n}.svg`, svgResponse(glyphToSvg(glyphRegistry[n] ?? ""))),
    );

    yield* router.add(
      "GET",
      "/assets/glyphs",
      HttpServerResponse.json(Arr.map(glyphRegistry, glyphToSvg)),
    );
  }),
);
