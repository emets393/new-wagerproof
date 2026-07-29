// Regenerates public/ from src/icon.ts.
//
// The icon has two consumers: serverInfo.icons + the worker's /icon.png route
// read the base64 in src/icon.ts, while Cloudflare static assets serve public/.
// Assets take precedence over the worker for matching paths, so a hand-edited
// public/icon.png would silently win over an updated src/icon.ts. Deriving one
// from the other on every deploy keeps src/icon.ts the single source of truth.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/icon.ts"), "utf8");

// Grab the whole assignment up to the semicolon, then join every quoted chunk:
// the constant is written as line-wrapped "..." + "..." pieces, and matching only
// the first one silently yields a truncated-but-header-valid PNG.
const assignment = src.match(/ICON_PNG_BASE64\s*=\s*([\s\S]*?);/);
if (!assignment) {
  console.error("build-assets: could not find ICON_PNG_BASE64 in src/icon.ts");
  process.exit(1);
}
const b64 = [...assignment[1].matchAll(/"([A-Za-z0-9+/=]*)"/g)].map((m) => m[1]).join("");

const bytes = Buffer.from(b64, "base64");
// PNG magic catches a mangled blob, but NOT truncation — a clipped file keeps a
// valid 8-byte signature and IHDR, so `file` and most decoders still report the
// right dimensions. Require the terminal IEND chunk, which only a complete PNG has.
if (bytes.length < 8 || bytes.readUInt32BE(0) !== 0x89504e47) {
  console.error("build-assets: ICON_PNG_BASE64 does not decode to a PNG");
  process.exit(1);
}
if (bytes.subarray(-8, -4).toString("latin1") !== "IEND") {
  console.error(
    `build-assets: decoded PNG is truncated (${bytes.length} bytes, no IEND chunk)`,
  );
  process.exit(1);
}

mkdirSync(join(root, "public"), { recursive: true });
for (const name of ["icon.png", "favicon.ico"]) {
  writeFileSync(join(root, "public", name), bytes);
}
console.log(`build-assets: wrote public/icon.png + public/favicon.ico (${bytes.length} bytes)`);
