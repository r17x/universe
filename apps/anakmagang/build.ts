import { mkdir, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

await mkdir("./out", { recursive: true })

// Step 1: Bundle web assets (browser target)
const webResult = await Bun.build({
  entrypoints: ["./src/web.main.ts"],
  target: "browser",
  minify: true,
  plugins: [{
    name: "exclude-non-runtime-deps",
    setup(build) {
      build.onResolve({ filter: /^(fast-check|pure-rand|msgpackr)$/ }, (args) => ({
        path: args.path,
        namespace: "stub",
      }))
      build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents: "export default {}",
        loader: "js",
      }))
    },
  }],
})

if (!webResult.success) {
  console.error("Web bundle failed:")
  for (const log of webResult.logs) console.error(log)
  process.exit(1)
}

const js = await webResult.outputs[0].text()
await Bun.write("./out/web.app.js", js)
console.log(`[web] ${js.length} bytes → out/web.app.js`)

// Bust Bun compile cache — touch file-type imports to ensure fresh mtime
const { utimes } = await import("node:fs/promises")
const now = new Date()
await utimes("./src/web.app.css", now, now)
await utimes("./out/web.app.js", now, now)

// Step 2: Compile binary (bun target)
const outfile = process.env.OUTFILE ?? "./out/anakmagang"
const tempDir = await mkdtemp(join(tmpdir(), "anakmagang-build-"))

// Pre-compile: stage native library for embedding (gzipped for compact binary)
const libfffPath = process.env.LIBFFF_PATH
if (libfffPath) {
  const raw = await Bun.file(join(libfffPath, "libfff_c.dylib")).bytes()
  const gz = Bun.gzipSync(raw)
  const target = join(resolve("."), "out", "libfff_c.dylib.gz")
  await Bun.write(target, gz)
  console.log(`[native] staged out/libfff_c.dylib.gz (${raw.length} → ${gz.length} bytes)`)
}

const compileResult = await Bun.build({
  entrypoints: ["./src/bin.ts"],
  target: "bun",
  compile: true,
  minify: true,
  drop: ["console.log", "console.debug"],
  outdir: tempDir,
  plugins: [{
    name: "exclude-non-runtime-deps",
    setup(build) {
      build.onResolve({ filter: /^(fast-check|pure-rand|msgpackr|msgpackr-extract|node-gyp-build-optional-packages|detect-libc|yaml|ini|toml)$/ }, (args) => ({
        path: args.path,
        namespace: "stub",
      }))
      build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents: "export default {}",
        loader: "js",
      }))
    },
  }],
})

if (!compileResult.success) {
  console.error("Compile failed:")
  for (const log of compileResult.logs) console.error(log)
  await rm(tempDir, { recursive: true })
  process.exit(1)
}

const compiled = compileResult.outputs[0].path
await Bun.$`mv ${compiled} ${outfile}`
await rm(tempDir, { recursive: true })
console.log(`[compile] ${outfile}`)
