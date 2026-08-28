import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeAll, serializeForInline, writeBuild } from "./core.mjs";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const b64 = (rel, mime) => `data:${mime};base64,` + readFileSync(join(root, rel)).toString("base64");

const ASSET_MARKERS = {
  SG500: b64("assets/fonts/spacegrotesk-500.woff2", "font/woff2"),
  SG700: b64("assets/fonts/spacegrotesk-700.woff2", "font/woff2"),
  JBM500: b64("assets/fonts/jetbrains-mono-500.woff2", "font/woff2"),
  AMBIENT: 'url("' + b64("assets/img/code-night.webp", "image/webp") + '")',
  LOGO: b64("assets/img/logo.svg", "image/svg+xml"),
};

function injectAssets(template) {
  let out = template;
  for (const [key, value] of Object.entries(ASSET_MARKERS)) {
    const marker = `/*__${key}__*/`;
    if (!out.includes(marker)) throw new Error(`Missing asset marker ${marker} in template`);
    out = out.split(marker).join(value);
  }
  return out;
}

const items = normalizeAll();
const serialized = serializeForInline(items);

let template = readFileSync(join(root, "src/index.template.html"), "utf8");
template = injectAssets(template);
const built = writeBuild(serialized, template, "index.html");

const bytes = Buffer.byteLength(built, "utf8");
console.log(`Built index.html (${bytes.toLocaleString()} bytes)`);
console.log(`Federated ${items.length.toLocaleString()} commands`);
console.log(
  `Tools: ${new Set(items.map((i) => i.tool)).size} | Groups: ${
    new Set(items.filter((i) => i.group).map((i) => i.group)).size
  } | Tags: ${new Set(items.flatMap((i) => i.tags)).size}`
);