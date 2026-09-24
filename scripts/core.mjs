import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
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

export function loadBlogs() {
  const blogPath = join("data", "blogs.json");
  if (!existsSync(blogPath)) return [];
  const text = readFileSync(blogPath, "utf8");
  return JSON.parse(text);
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

/* Blog search scoring and ranking */
export function scoreBlog(blog, tokens) {
  const q = (t) => (t || "").toLowerCase();
  let total = 0;
  for (const tokenRaw of tokens) {
    const token = q(tokenRaw);
    let score = -Infinity;
    const t = q(blog.title);
    const s = q(blog.summary);
    const a = q(blog.quickAnswer);
    const c = q(blog.category);
    const tl = q(blog.tool);
    const tags = (blog.tags || []).map((x) => q(x));

    if (t.includes(token)) score = Math.max(score, 10);
    if (a.includes(token)) score = Math.max(score, 8);
    if (s.includes(token)) score = Math.max(score, 6);
    if (tags.some((x) => x.includes(token))) score = Math.max(score, 5);
    if (c.includes(token) || tl.includes(token)) score = Math.max(score, 4);

    if (score < 0) return null;
    total += score;
  }
  return total;
}

export function filterAndRankBlogs(blogs, query = "", category = "", tool = "") {
  let filtered = blogs;
  if (category && category !== "all") {
    filtered = filtered.filter((b) => b.category.toLowerCase() === category.toLowerCase());
  }
  if (tool && tool !== "all") {
    filtered = filtered.filter((b) => b.tool.toLowerCase() === tool.toLowerCase());
  }
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return filtered;

  return filtered
    .map((blog) => ({ blog, s: scoreBlog(blog, tokens) }))
    .filter((x) => x.s !== null)
    .sort((a, b) => b.s - a.s || a.blog.title.localeCompare(b.blog.title))
    .map((x) => x.blog);
}

export function availableJsonFiles() {
  return readdirSync("commands")
    .filter((f) => f.endsWith(".json"))
    .sort();
}

export function serializeForInline(items) {
  return JSON.stringify(serialize(items)).replace(/</g, "\\u003c");
}

export function serializeBlogsForInline(blogs) {
  return JSON.stringify(blogs).replace(/</g, "\\u003c");
}

export function writeBuild(serializedCommands, serializedBlogs, templateContent, outPath) {
  const markerCmd = "/*__COMMAND_DECK_DATA__*/";
  const markerBlogs = "/*__COMMAND_DECK_BLOGS__*/";

  if (!templateContent.includes(markerCmd)) {
    throw new Error(`Template missing data marker: ${markerCmd}`);
  }

  let built = templateContent.replace(
    markerCmd,
    `const DECK_DATA = ${serializedCommands};\n`
  );

  if (built.includes(markerBlogs)) {
    built = built.replace(
      markerBlogs,
      `const DECK_BLOGS = ${serializedBlogs};\n`
    );
  }

  writeFileSync(outPath, built, "utf8");
  return built;
}

/* ------------------------------------------------------------------ */
/*  Data & API Simulation Engine (REST, GraphQL, tRPC)                */
/* ------------------------------------------------------------------ */

export function executeMockRestApi(method, path, params = {}, items = [], blogs = []) {
  const normPath = path.toLowerCase().replace(/\/$/, "");
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(params.limit || "20", 10)));
  const search = (params.search || "").trim();
  const tool = (params.tool || "").trim();
  const tag = (params.tag || "").trim();
  const category = (params.category || "").trim();

  // Route: /api/stats
  if (normPath === "/api/stats") {
    return {
      status: 200,
      data: {
        totalCommands: items.length,
        totalBlogs: blogs.length,
        totalTools: TOOLS.length,
        tools: TOOLS.map((t) => ({
          id: t.id,
          label: t.label,
          commandCount: items.filter((i) => i.tool === t.id).length,
          articleCount: blogs.filter((b) => b.tool === t.id).length,
        })),
        author: {
          name: "Arun Neupane",
          role: "CTO and Lead Architect",
          company: "Sajilo Digital Pvt. Ltd.",
          location: "Butwal, Lumbini, Nepal",
          timezone: "UTC+5:45 (NPT)",
          website: "https://arunneupane.vercel.app",
        },
        engineVersion: "2.0.0",
        timestamp: new Date().toISOString(),
      },
    };
  }

  // Route: /api/tools
  if (normPath === "/api/tools") {
    return {
      status: 200,
      data: TOOLS.map((t) => ({
        id: t.id,
        label: t.label,
        commandCount: items.filter((i) => i.tool === t.id).length,
        articleCount: blogs.filter((b) => b.tool === t.id).length,
      })),
    };
  }

  // Route: /api/commands
  if (normPath === "/api/commands") {
    let results = items;
    if (tool && tool !== "all") {
      results = results.filter((i) => i.tool.toLowerCase() === tool.toLowerCase());
    }
    if (tag) {
      results = results.filter((i) => i.tags && i.tags.some((t) => t.toLowerCase() === tag.toLowerCase()));
    }
    if (search) {
      results = filterAndRank(results, search);
    }

    const total = results.length;
    const startIndex = (page - 1) * limit;
    const pagedItems = results.slice(startIndex, startIndex + limit);
    const nextCursor = startIndex + limit < total ? Buffer.from(String(startIndex + limit)).toString("base64") : null;
    const prevCursor = startIndex > 0 ? Buffer.from(String(Math.max(0, startIndex - limit))).toString("base64") : null;

    return {
      status: 200,
      data: {
        items: pagedItems,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasMore: startIndex + limit < total,
          nextCursor,
          prevCursor,
        },
      },
    };
  }

  // Route: /api/commands/:id
  if (normPath.startsWith("/api/commands/")) {
    const id = normPath.replace("/api/commands/", "");
    const found = items.find((i) => i.id.toLowerCase() === id.toLowerCase());
    if (!found) {
      return { status: 404, error: { code: "NOT_FOUND", message: `Command '${id}' not found.` } };
    }
    return { status: 200, data: found };
  }

  // Route: /api/blogs
  if (normPath === "/api/blogs") {
    let results = filterAndRankBlogs(blogs, search, category, tool);
    const total = results.length;
    const startIndex = (page - 1) * limit;
    const pagedItems = results.slice(startIndex, startIndex + limit);

    return {
      status: 200,
      data: {
        items: pagedItems.map((b) => ({
          id: b.id,
          slug: b.slug,
          title: b.title,
          tool: b.tool,
          category: b.category,
          readTime: b.readTime,
          date: b.date,
          summary: b.summary,
          quickAnswer: b.quickAnswer,
          tags: b.tags,
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
    };
  }

  // Route: /api/blogs/:slug
  if (normPath.startsWith("/api/blogs/")) {
    const slug = normPath.replace("/api/blogs/", "");
    const found = blogs.find((b) => b.slug.toLowerCase() === slug.toLowerCase() || b.id.toLowerCase() === slug.toLowerCase());
    if (!found) {
      return { status: 404, error: { code: "NOT_FOUND", message: `Article with slug '${slug}' not found.` } };
    }
    return { status: 200, data: found };
  }

  return {
    status: 404,
    error: {
      code: "ROUTE_NOT_FOUND",
      message: `Endpoint ${method} ${path} is not recognized.`,
      availableRoutes: [
        "GET /api/stats",
        "GET /api/tools",
        "GET /api/commands",
        "GET /api/commands/:id",
        "GET /api/blogs",
        "GET /api/blogs/:slug",
      ],
    },
  };
}

export function executeMockGraphQL(query, variables = {}, items = [], blogs = []) {
  const clean = (query || "").trim();
  const errors = [];
  const data = {};

  if (!clean) {
    return { errors: [{ message: "Query string cannot be empty" }] };
  }

  if (clean.includes("stats")) {
    data.stats = {
      totalCommands: items.length,
      totalBlogs: blogs.length,
      totalTools: TOOLS.length,
    };
  }

  if (clean.includes("tools")) {
    data.tools = TOOLS.map((t) => ({
      id: t.id,
      label: t.label,
      commandCount: items.filter((i) => i.tool === t.id).length,
      articleCount: blogs.filter((b) => b.tool === t.id).length,
    }));
  }

  if (clean.includes("commands")) {
    const cmdMatch = clean.match(/commands\s*(?:\(([^)]+)\))?/);
    let tool = variables.tool;
    let search = variables.search;
    let limit = variables.limit;

    if (cmdMatch && cmdMatch[1]) {
      const argsStr = cmdMatch[1];
      const toolMatch = argsStr.match(/tool:\s*"([^"]+)"/);
      const limitMatch = argsStr.match(/limit:\s*(\d+)/);
      const searchMatch = argsStr.match(/search:\s*"([^"]+)"/);
      if (toolMatch && !tool) tool = toolMatch[1];
      if (limitMatch && limit === undefined) limit = parseInt(limitMatch[1], 10);
      if (searchMatch && !search) search = searchMatch[1];
    }
    limit = limit || 10;
    let list = items;
    if (tool && tool !== "all") list = list.filter((i) => i.tool === tool);
    if (search) list = filterAndRank(list, search);
    data.commands = list.slice(0, limit);
  }

  if (clean.includes("blogs")) {
    const blogMatch = clean.match(/blogs\s*(?:\(([^)]+)\))?/);
    let category = variables.category;
    let tool = variables.tool;
    let search = variables.search;
    let limit = variables.limit;

    if (blogMatch && blogMatch[1]) {
      const argsStr = blogMatch[1];
      const catMatch = argsStr.match(/category:\s*"([^"]+)"/);
      const toolMatch = argsStr.match(/tool:\s*"([^"]+)"/);
      const limitMatch = argsStr.match(/limit:\s*(\d+)/);
      const searchMatch = argsStr.match(/search:\s*"([^"]+)"/);
      if (catMatch && !category) category = catMatch[1];
      if (toolMatch && !tool) tool = toolMatch[1];
      if (limitMatch && limit === undefined) limit = parseInt(limitMatch[1], 10);
      if (searchMatch && !search) search = searchMatch[1];
    }
    limit = limit || 5;
    data.blogs = filterAndRankBlogs(blogs, search, category, tool).slice(0, limit);
  }

  return { data, errors: errors.length ? errors : undefined };
}

export function executeMockTRPC(procedure, input = {}, items = [], blogs = []) {
  switch (procedure) {
    case "commands.list": {
      const limit = Math.min(100, input.limit || 20);
      let list = items;
      if (input.tool && input.tool !== "all") list = list.filter((i) => i.tool === input.tool);
      if (input.search) list = filterAndRank(list, input.search);
      return { result: { data: { items: list.slice(0, limit), total: list.length } } };
    }
    case "commands.byId": {
      const found = items.find((i) => i.id === input.id);
      if (!found) throw new Error(`Command not found with id: ${input.id}`);
      return { result: { data: found } };
    }
    case "blogs.list": {
      const limit = Math.min(20, input.limit || 10);
      const list = filterAndRankBlogs(blogs, input.search, input.category, input.tool);
      return { result: { data: { items: list.slice(0, limit), total: list.length } } };
    }
    case "blogs.bySlug": {
      const found = blogs.find((b) => b.slug === input.slug);
      if (!found) throw new Error(`Blog article not found with slug: ${input.slug}`);
      return { result: { data: found } };
    }
    case "tools.all": {
      return { result: { data: TOOLS } };
    }
    case "stats.summary": {
      return {
        result: {
          data: {
            commands: items.length,
            blogs: blogs.length,
            tools: TOOLS.length,
            author: "Arun Neupane",
          },
        },
      };
    }
    default:
      throw new Error(`Unknown tRPC procedure: ${procedure}`);
  }
}