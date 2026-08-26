import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/* ------------------------------------------------------------------ */
/*  Command Deck: shared data pipeline (single source of truth)        */
/*  Used by scripts/build.mjs and tests/validate.mjs.                  */
/* ------------------------------------------------------------------ */

export const TOOLS = [
  { id: "windows", label: "Windows" },
  { id: "mac", label: "macOS" },
  { id: "linux", label: "Linux" },
  { id: "git", label: "Git" },
  { id: "npm", label: "npm" },
  { id: "pnpm", label: "pnpm" },
  { id: "vscode", label: "VS Code" },
  { id: "nextjs", label: "Next.js" },
  { id: "davinci", label: "DaVinci" },
];

const SLUG_GROUP_TOOLS = new Set(["mac", "linux", "pnpm"]);
const CATEGORY_TOOLS = new Set(["git", "npm"]);

function humanize(slug) {
  return slug
    .split(/[\s-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function loadRaw() {
  const out = {};
  for (const tool of TOOLS) {
    const file = join("commands", `${tool.id}.json`);
    const text = readFileSync(file, "utf8");
    out[tool.id] = { tool, raw: JSON.parse(text) };
  }
  return out;
}

export function normalizeEntry(entry, tool, idx) {
  const command = entry.command;
  const tags = Array.isArray(entry.tags) ? entry.tags.slice() : [];
  const titleRaw =
    typeof entry.title === "string" && entry.title.trim()
      ? entry.title.trim()
      : "";
  let title = titleRaw;
  let group = "";

  if (CATEGORY_TOOLS.has(tool.id)) {
    group = typeof entry.category === "string" ? entry.category : "";
  } else if (SLUG_GROUP_TOOLS.has(tool.id) && titleRaw) {
    const words = titleRaw.split(/[\s-_]+/).filter(Boolean);
    if (words.length <= 2) {
      group = humanize(titleRaw);
      title = "";
    }
  }

  if (!title) title = command;

  return {
    id: `${tool.id}@${idx}`,
    tool: tool.id,
    toolLabel: tool.label,
    title,
    group: group ? humanize(group) : "",
    command,
    description:
      typeof entry.description === "string" ? entry.description : "",
    tags,
  };
}

export function normalizeAll() {
  const raw = loadRaw();
  const items = [];
  for (const tool of TOOLS) {
    const { raw: list } = raw[tool.id];
    list.forEach((entry, idx) => items.push(normalizeEntry(entry, tool, idx)));
  }
  return items;
}

/* Compact dictionary serialization for inline embedding. */
export function serialize(items) {
  const uniq = (arr) => [...new Set(arr.filter((s) => s.length))];
  const titles = uniq(items.map((i) => i.title));
  const groups = uniq(items.map((i) => i.group));
  const cmds = uniq(items.map((i) => i.command));
  const descs = uniq(items.map((i) => i.description));
  const tags = uniq(items.flatMap((i) => i.tags));

  const tIdx = new Map(titles.map((s, i) => [s, i]));
  const gIdx = new Map(groups.map((s, i) => [s, i]));
  const cIdx = new Map(cmds.map((s, i) => [s, i]));
  const dIdx = new Map(descs.map((s, i) => [s, i]));
  const tagIdx = new Map(tags.map((s, i) => [s, i]));

  const tuples = items.map((i) => [
    TOOLS.findIndex((t) => t.id === i.tool),
    i.title ? tIdx.get(i.title) : -1,
    i.group ? gIdx.get(i.group) : -1,
    cIdx.get(i.command),
    dIdx.get(i.description),
    i.tags.map((t) => tagIdx.get(t)),
  ]);

  return {
    version: 1,
    names: TOOLS.map((t) => t.id),
    labels: TOOLS.map((t) => t.label),
    titles,
    groups,
    cmds,
    descs,
    tags,
    items: tuples,
  };
}

export function decode(serialized) {
  const {
    names,
    labels,
    titles,
    groups,
    cmds,
    descs,
    tags,
    items,
  } = serialized;
  const toolLabel = (i) => labels[i] || names[i] || "Tool";
  return items.map((tuple, idx) => {
    const [toolIdx, titleIdx, groupIdx, cmdIdx, descIdx, tagIdxs] = tuple;
    const tool = names[toolIdx];
    const command = cmds[cmdIdx] ?? "";
    return {
      id: `${tool}@${idx}`,
      tool,
      toolLabel: toolLabel(toolIdx),
      title: titleIdx >= 0 ? titles[titleIdx] : command,
      group: groupIdx >= 0 ? groups[groupIdx] : "",
      command,
      description: descs[descIdx] ?? "",
      tags: (tagIdxs ?? []).map((t) => tags[t]),
    };
  });
}

/* Search scoring shared semantics: every token must match at least one
   field; rank favors title > command > tool > tag > description. */
export function scoreItem(item, tokens) {
  const q = (t) => t.toLowerCase();
  const hit = (needleParts) =>
    needleParts.some((p) => q(p).includes(token));
  let total = 0;
  for (const tokenRaw of tokens) {
    const token = q(tokenRaw);
    const t = item.title ?? "";
    const c = item.command ?? "";
    const tl = item.toolLabel ?? "";
    const d = item.description ?? "";
    let score = -Infinity;
    const st = (v) => v.startsWith(token);
    const inc = (v) => v.includes(token);
    if (st(q(t))) score = 6;
    else if (inc(q(t))) score = 4;
    else if (st(q(c))) score = 5;
    else if (inc(q(c))) score = 3;
    else if (st(q(tl))) score = 4;
    else if (inc(q(tl))) score = 3;
    else if ((item.tags ?? []).some((x) => inc(q(x)))) score = 2;
    else if (inc(q(d))) score = 1;
    if (score < 0) return null;
    total += score;
  }
  return total;
}

export function filterAndRank(items, query) {
  const tokens = query
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!tokens.length) return items.slice();
  return items
    .map((item) => ({ item, s: scoreItem(item, tokens) }))
    .filter((x) => x.s !== null)
    .sort((a, b) => b.s - a.s || a.item.title.localeCompare(b.item.title))
    .map((x) => x.item);
}

export function availableJsonFiles() {
  return readdirSync("commands")
    .filter((f) => f.endsWith(".json"))
    .sort();
}

export function serializeForInline(items) {
  return JSON.stringify(serialize(items)).replace(/</g, "\\u003c");
}

export function writeBuild(serializedText, templateContent, outPath) {
  const marker = "/*__COMMAND_DECK_DATA__*/";
  if (!templateContent.includes(marker)) {
    throw new Error(`Template missing data marker: ${marker}`);
  }
  const built = templateContent.replace(
    marker,
    `const DECK_DATA = ${serializedText};\n`
  );
  writeFileSync(outPath, built, "utf8");
  return built;
}