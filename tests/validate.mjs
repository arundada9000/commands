/* ------------------------------------------------------------------ */
/*  Command Deck: Master Test & Validation Suite                      */
/*  Run: node tests/validate.mjs (exit 0 = all green)                 */
/* ------------------------------------------------------------------ */

import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  TOOLS,
  loadRaw,
  loadBlogs,
  normalizeAll,
  serialize,
  decode,
  filterAndRank,
  filterAndRankBlogs,
  availableJsonFiles,
  executeMockRestApi,
  executeMockGraphQL,
  executeMockTRPC,
} from "../scripts/core.mjs";

let pass = 0, fail = 0;
const ok = (name, fn) => {
  try {
    fn();
    pass++;
    console.log(`  PASS ${name}`);
  } catch (e) {
    fail++;
    console.error(`  FAIL ${name}\n    ${e.message}`);
  }
};

/* 1. Schema: all nine decks parse and contain valid command entries */
ok("schema: all 9 upstream command collections parse and validate", () => {
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

/* 2. Technical Blogs Schema (SEO / AEO / GEO) */
ok("blogs: 10 technical guides validate with SEO, AEO, and GEO schemas", () => {
  const blogs = loadBlogs();
  assert.equal(blogs.length, 10, `expected 10 technical articles, got ${blogs.length}`);
  const slugs = new Set();
  for (const b of blogs) {
    assert.ok(b.id && b.id.trim().length > 0, `missing id on article`);
    assert.ok(b.slug && b.slug.trim().length > 0, `missing slug on article ${b.id}`);
    assert.ok(!slugs.has(b.slug), `duplicate slug: ${b.slug}`);
    slugs.add(b.slug);
    assert.ok(b.title && b.title.length > 10, `article title too short on ${b.slug}`);
    assert.ok(b.quickAnswer && b.quickAnswer.length > 20, `missing quickAnswer for AEO on ${b.slug}`);
    assert.ok(b.author && b.author.name === "Arun Neupane", `author attribution mismatch on ${b.slug}`);
    assert.ok(Array.isArray(b.content) && b.content.length >= 3, `insufficient content sections on ${b.slug}`);
    assert.ok(Array.isArray(b.faqs) && b.faqs.length >= 3, `insufficient FAQs for AEO on ${b.slug}`);
    for (const faq of b.faqs) {
      assert.ok(faq.question && faq.question.length > 5, `empty FAQ question in ${b.slug}`);
      assert.ok(faq.answer && faq.answer.length > 10, `empty FAQ answer in ${b.slug}`);
    }
  }
});

/* 3. IDs are unique and stable across the federated command set */
ok("federation: unique ids and title normalization across 1,946 commands", () => {
  const items = normalizeAll();
  const ids = items.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate ids found");
  for (const i of items) assert.ok(i.title.trim().length > 0, `empty title for ${i.id}`);
  assert.equal(items.length, 1946, "expected 1946 federated commands");
});

/* 4. Serialize -> decode round-trip is lossless in content */
ok("compression: compact dictionary serialize and decode round-trip is lossless", () => {
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
});

/* 5. Built index.html embeds data properly */
ok("embed sync: index.html embeds valid DECK_DATA and DECK_BLOGS", () => {
  const builtPath = join("index.html");
  assert.ok(existsSync(builtPath), "index.html not built; run node scripts/build.mjs");
  const html = readFileSync(builtPath, "utf8");
  assert.ok(html.includes("const DECK_DATA = {"), "DECK_DATA missing in index.html");
  assert.ok(html.includes("const DECK_BLOGS = ["), "DECK_BLOGS missing in index.html");
});

/* 6. Search ranking tests */
ok("search: command and blog ranking filters match tokens accurately", () => {
  const items = decode(serialize(normalizeAll()));
  const blogs = loadBlogs();

  const gitResults = filterAndRank(items, "git rebase");
  assert.ok(gitResults.length > 0, "expected matches for 'git rebase'");
  assert.ok(gitResults[0].command.includes("rebase"), "top hit should contain rebase");

  const blogResults = filterAndRankBlogs(blogs, "systemd");
  assert.ok(blogResults.length > 0, "expected matches for blog query 'systemd'");
  assert.equal(blogResults[0].slug, "linux-server-hardening-production-systemd");
});

/* 7. Mock REST API execution */
ok("api: mock REST API endpoints resolve with status codes and pagination", () => {
  const items = normalizeAll();
  const blogs = loadBlogs();

  const statsRes = executeMockRestApi("GET", "/api/stats", {}, items, blogs);
  assert.equal(statsRes.status, 200);
  assert.equal(statsRes.data.totalCommands, 1946);
  assert.equal(statsRes.data.totalBlogs, 10);
  assert.equal(statsRes.data.author.name, "Arun Neupane");

  const cmdsRes = executeMockRestApi("GET", "/api/commands", { tool: "git", limit: "5" }, items, blogs);
  assert.equal(cmdsRes.status, 200);
  assert.equal(cmdsRes.data.items.length, 5);
  assert.equal(cmdsRes.data.pagination.limit, 5);

  const blogsRes = executeMockRestApi("GET", "/api/blogs", { limit: "3" }, items, blogs);
  assert.equal(blogsRes.status, 200);
  assert.equal(blogsRes.data.items.length, 3);
});

/* 8. Mock GraphQL query execution */
ok("api: mock GraphQL queries execute and resolve correctly", () => {
  const items = normalizeAll();
  const blogs = loadBlogs();
  const query = `
    query TestQuery {
      stats { totalCommands totalBlogs }
      commands(tool: "git", limit: 3) { id title command }
      blogs(limit: 2) { slug title }
    }
  `;
  const gqlRes = executeMockGraphQL(query, {}, items, blogs);
  assert.ok(gqlRes.data, "missing GraphQL data");
  assert.equal(gqlRes.data.stats.totalCommands, 1946);
  assert.equal(gqlRes.data.commands.length, 3);
  assert.equal(gqlRes.data.blogs.length, 2);
});

/* 9. Mock tRPC router procedures */
ok("api: mock tRPC router executes type-safe procedures", () => {
  const items = normalizeAll();
  const blogs = loadBlogs();

  const trpcCmds = executeMockTRPC("commands.list", { tool: "git", limit: 4 }, items, blogs);
  assert.equal(trpcCmds.result.data.items.length, 4);

  const trpcStats = executeMockTRPC("stats.summary", {}, items, blogs);
  assert.equal(trpcStats.result.data.commands, 1946);
  assert.equal(trpcStats.result.data.author, "Arun Neupane");
});

/* 10. Progressive Web App and SEO companion assets */
ok("pwa: manifest.webmanifest, sw.js, sitemap.xml, robots.txt exist and validate", () => {
  assert.ok(existsSync("manifest.webmanifest"), "manifest.webmanifest missing");
  const manifest = JSON.parse(readFileSync("manifest.webmanifest", "utf8"));
  assert.equal(manifest.display, "standalone");
  assert.ok(existsSync("sw.js"), "sw.js missing");
  assert.ok(existsSync("sitemap.xml"), "sitemap.xml missing");
  assert.ok(existsSync("robots.txt"), "robots.txt missing");
  assert.ok(existsSync("LICENSE"), "LICENSE missing");
  const license = readFileSync("LICENSE", "utf8");
  assert.ok(license.includes("PROPRIETARY LICENSE"), "license must be proprietary");
});

/* 11. Strict Constraints: Zero Emojis and Zero Em Dashes */
ok("constraints: zero emojis and zero em dashes across deliverables", () => {
  const filesToCheck = [
    "index.html",
    "plan.md",
    "README.md",
    "LICENSE",
    "rules/tracker.md",
    "manifest.webmanifest",
    "sw.js",
    "data/blogs.json",
  ];

  const emojiRegex = /[\u{1F300}-\u{1F5FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{2388}\u{2B05}\u{2B06}\u{2B07}\u{2B1B}\u{2B1C}\u{2B50}\u{2B55}]/u;

  for (const file of filesToCheck) {
    if (existsSync(file)) {
      const content = readFileSync(file, "utf8");
      assert.ok(!content.includes("—"), `em dash found in ${file}`);
      assert.ok(!emojiRegex.test(content), `emoji found in ${file}`);
    }
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);