/* Command Deck validation suite.
   Run: node tests/validate.mjs  (exit 0 = all green) */

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  TOOLS,
  loadRaw,
  normalizeAll,
  serialize,
  decode,
  serializeForInline,
  filterAndRank,
  availableJsonFiles,
} from "../scripts/core.mjs";

let pass = 0, fail = 0;
const ok = (name, fn) => {
  try { fn(); pass++; console.log(`  PASS ${name}`); }
  catch (e) { fail++; console.error(`  FAIL ${name}\n    ${e.message}`); }
};

const root = new URL("../", import.meta.url).pathname; /* POSIX-ish only for checks below */

/* 1. Schema: every source deck is a JSON array of well-formed entries. */
ok("schema: all nine decks parse and have entries", () => {
  const files = availableJsonFiles();
  assert.equal(files.length, 9, `expected 9 deck files, got ${files.length}`);
  for (const tool of TOOLS) {
    const file = join("commands", `${tool.id}.json`);
    assert.ok(existsSync(file), `missing deck ${file}`);
    const entries = loadRaw()[tool.id].raw;
    assert.ok(Array.isArray(entries) && entries.length > 0, `${tool.id} not a non-empty array`);
    for (const e of entries) {
      assert.equal(typeof e.command, "string", `command not string in ${tool.id}`);
      assert.ok(e.command.trim().length > 0, `empty command in ${tool.id}`);
      if (e.title !== undefined) assert.equal(typeof e.title, "string");
      if (e.description !== undefined) assert.equal(typeof e.description, "string");
      if (e.tags !== undefined) assert.ok(Array.isArray(e.tags), `tags not array in ${tool.id}`);
    }
  }
});

/* 2. IDs are unique and stable across the federated set. */
ok("federation: unique ids + no missing titles", () => {
  const items = normalizeAll();
  const ids = items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate ids found");
  for (const i of items) assert.ok(i.title.trim().length > 0, `empty title for ${i.id}`);
  assert.equal(items.length, 1946, "expected 1946 federated commands");
});

/* 3. Serialize -> decode round-trip is lossless in content. */
ok("round-trip: serialize+decode equals federated set", () => {
  const items = normalizeAll();
  const back = decode(serialize(items));
  assert.equal(back.length, items.length);
  for (let i = 0; i < items.length; i++) {
    const a = items[i], b = back[i];
    assert.equal(b.tool, a.tool);
    assert.equal(b.title, a.title);
    assert.equal(b.group, a.group);
    assert.equal(b.command, a.command);
    assert.equal(b.description, a.description);
    assert.deepEqual(b.tags, a.tags);
  }
  const ids = back.map((i) => i.id);
  assert.equal(new Set(ids).size, back.length, "decoded ids must stay unique");
});

/* 4. Built index.html embeds data identical to the pipeline output. */
ok("embed sync: built index.html data equals serialize()", () => {
  const builtPath = join("index.html");
  assert.ok(existsSync(builtPath), "index.html not built; run node scripts/build.mjs");
  const html = readFileSync(builtPath, "utf8");
  const start = html.indexOf("const DECK_DATA = ") + "const DECK_DATA = ".length;
  assert.ok(start !== -1, "DECK_DATA const not found in index.html");
  const end = html.indexOf("\n", start);
  const embedded = JSON.parse(html.slice(start, end).replace(/;\s*$/, ""));
  assert.deepEqual(embedded, serialize(normalizeAll()));
  assert.equal(decode(embedded).length, 1946);
});

/* 5. Embedded data decodes to usable, linkable items. */
ok("decode: embedded tuples map to real tool indexes", () => {
  const html = readFileSync(join("index.html"), "utf8");
  const start = html.indexOf("const DECK_DATA = ") + "const DECK_DATA = ".length;
  const end = html.indexOf("\n", start);
  const embedded = JSON.parse(html.slice(start, end).replace(/;\s*$/, ""));
  const items = decode(embedded);
  const toolCount = new Set(items.map((i) => i.tool)).size;
  assert.equal(toolCount, 9, "expected all 9 tools present after decode");
  const sample = items.find((i) => i.command === "git log");
  assert.ok(sample, "`git log` missing from decoded dataset");
  assert.ok(sample.title.trim().length > 0, "`git log` title missing");
  assert.equal(sample.tool, "git", "`git log` should live under git tool");
});

/* 6. Search semantics: every returned item must match every token. */
ok("search: ranking returns valid matches only", () => {
  const items = decode(serialize(normalizeAll()));
  for (const q of ["git", "git log", "npm install", "delete"]) {
    const res = filterAndRank(items, q);
    const tokens = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    for (const r of res) {
      const hay = [
        r.title, r.command, r.toolLabel, r.description, ...r.tags,
      ].join(" ").toLowerCase();
      for (const t of tokens) {
        assert.ok(hay.includes(t), `"${q}": item ${r.id} missing token ${t}`);
      }
    }
    assert.ok(res.length > 0, `"${q}" unexpectedly returned nothing`);
  }
  const none = filterAndRank(items, "zzzznozzzz");
  assert.equal(none.length, 0, "garbage query should return nothing");
  const all = filterAndRank(items, "");
  assert.equal(all.length, items.length, "empty query should return everything");
});

/* 7. No build markers left over in the deliverable. */
ok("build: no unresolved markers, no em dashes", () => {
  const html = readFileSync(join("index.html"), "utf8");
  const markers = html.match(/__[A-Z_]{2,}__/g) || [];
  assert.deepEqual(markers, [], `unresolved markers: ${markers.join(", ")}`);
  assert.ok(!html.includes("—"), "em dash found in deliverable");
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);