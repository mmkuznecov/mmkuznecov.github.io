#!/usr/bin/env node
// authoring/server.mjs — local companion server for adding new blog posts.
//
// The browser can't create folders or rewrite posts/index.html, so this small
// zero-dependency server does the filesystem work. It:
//   • serves the authoring UI (authoring/ui.html) at /
//   • serves the repo (assets, posts, cv) so previews resolve /assets and /posts
//   • POST /api/preview  -> writes a throwaway preview under .preview/<slug>/
//   • POST /api/publish  -> creates posts/<slug>/ and splices posts/index.html
//
// Run from anywhere:  node authoring/server.mjs   (then open http://localhost:4321/)
// It writes only inside the repo root (one level up from this file).

import { createServer } from "node:http";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import {
  join,
  dirname,
  extname,
  resolve,
  normalize,
  sep,
} from "node:path";
import { fileURLToPath } from "node:url";
import { Buffer } from "node:buffer";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");            // repo root
const POSTS = join(ROOT, "posts");
const LISTING = join(POSTS, "index.html");
const PREVIEW = join(ROOT, ".preview");      // gitignored temp area
const UI_FILE = join(HERE, "ui.html");
const PORT = Number(process.env.PORT) || 4321;
const MAX_BODY = 300 * 1024 * 1024;          // generous; artifacts (gifs) get big base64

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ipynb": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".pdf": "application/pdf",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const send = (res, code, body, type = "text/plain; charset=utf-8") => {
  res.writeHead(code, { "content-type": type });
  res.end(body);
};
const sendJson = (res, code, obj) =>
  send(res, code, JSON.stringify(obj), "application/json; charset=utf-8");

const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function slugify(s) {
  return String(s)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Every artifact referenced from the post as src="artifacts/…" or href="artifacts/…".
function referencedArtifacts(html) {
  const re =
    /(?:src|href)\s*=\s*["']\s*(?:\.\/)?artifacts\/([^"'#?]+)(?:[#?][^"']*)?\s*["']/gi;
  const set = new Set();
  let m;
  while ((m = re.exec(html))) {
    try {
      set.add(decodeURIComponent(m[1]));
    } catch {
      set.add(m[1]);
    }
  }
  return set;
}

function analyze(html, providedNames) {
  const referenced = referencedArtifacts(html);
  const provided = new Set(providedNames);
  const missing = [...referenced].filter((a) => !provided.has(a));
  const redundant = [...provided].filter((a) => !referenced.has(a));
  return { referenced: [...referenced], missing, redundant };
}

// Reject anything that could escape the artifacts/ folder.
function safeArtifactName(name) {
  const n = String(name).replace(/\\/g, "/");
  if (!n || n.includes("..") || n.startsWith("/") || n.includes("\0")) return null;
  return n;
}

function readBody(req) {
  return new Promise((res, rej) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        rej(new Error("payload too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => res(Buffer.concat(chunks)));
    req.on("error", rej);
  });
}

function serveStatic(res, urlPath) {
  let base = ROOT;
  let rel = urlPath;
  if (urlPath === "/_preview" || urlPath.startsWith("/_preview/")) {
    base = PREVIEW;
    rel = urlPath.slice("/_preview".length) || "/";
  }
  const decoded = decodeURIComponent(rel.split("?")[0]);
  let fsPath = normalize(join(base, decoded));
  if (fsPath !== base && !fsPath.startsWith(base + sep)) return send(res, 403, "forbidden");
  if (existsSync(fsPath) && statSync(fsPath).isDirectory()) fsPath = join(fsPath, "index.html");
  if (!existsSync(fsPath)) return send(res, 404, "not found");
  const type = MIME[extname(fsPath).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  res.end(readFileSync(fsPath));
}

function writeArtifacts(dir, artifacts) {
  mkdirSync(join(dir, "artifacts"), { recursive: true });
  for (const a of artifacts) {
    const name = safeArtifactName(a.name);
    if (!name) throw new Error(`Unsafe artifact name: ${a.name}`);
    const target = join(dir, "artifacts", name);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, Buffer.from(a.dataB64 || "", "base64"));
  }
}

// Build one <li> in the same shape posts/index.html already uses.
function buildListItem({ slug, title, date, tldr, notebook, tags }) {
  const meta = [`            ${esc(date)}`];
  if (notebook)
    meta.push(
      `            <a href="/posts/${slug}/artifacts/experiments.ipynb">notebook</a>`,
    );
  for (const t of tags) meta.push(`            ${esc(t)}`);
  return [
    `        <li>`,
    `          <a class="title" href="/posts/${slug}/">${esc(title)}</a>`,
    `          <div class="meta">`,
    meta.join("\n            ·\n"),
    `          </div>`,
    `          <div class="excerpt">`,
    `            ${esc(tldr)}`,
    `          </div>`,
    `        </li>`,
  ].join("\n");
}

// Newest first: splice the new <li> right after <ul class="post-list">.
function insertIntoListing(itemHtml) {
  const html = readFileSync(LISTING, "utf8");
  const anchor = '<ul class="post-list">';
  const idx = html.indexOf(anchor);
  if (idx < 0)
    throw new Error('Could not find <ul class="post-list"> in posts/index.html');
  const at = idx + anchor.length;
  writeFileSync(LISTING, html.slice(0, at) + "\n" + itemHtml + html.slice(at));
}

function validate(p) {
  const title = (p.title || "").trim();
  const tldr = (p.tldr || "").trim();
  const postHtml = p.postHtml || "";
  const slug = (p.slug || "").trim() || slugify(title);
  const date = (p.date || "").trim() || new Date().toISOString().slice(0, 10);
  const tags = Array.isArray(p.tags) ? p.tags.map((t) => String(t).trim()).filter(Boolean) : [];
  const artifacts = Array.isArray(p.artifacts) ? p.artifacts : [];

  const errors = [];
  if (!title) errors.push("Title is required.");
  if (!tldr) errors.push("Preview / TLDR is required.");
  if (!postHtml.trim()) errors.push("Post HTML is empty.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    errors.push(`Invalid slug "${slug}" — use lowercase letters, numbers, and hyphens.`);

  const names = artifacts.map((a) => a.name);
  const { missing, redundant, referenced } = analyze(postHtml, names);
  const notebook = referenced.includes("experiments.ipynb") || names.includes("experiments.ipynb");

  return { errors, title, tldr, postHtml, slug, date, tags, artifacts, missing, redundant, notebook };
}

// ---------------------------------------------------------------------------
// endpoints
// ---------------------------------------------------------------------------
async function handlePreview(req, res) {
  const v = validate(JSON.parse((await readBody(req)).toString("utf8")));
  if (v.errors.length) return sendJson(res, 400, { ok: false, errors: v.errors });
  if (v.missing.length)
    return sendJson(res, 422, {
      ok: false,
      missing: v.missing,
      redundant: v.redundant,
      message: "Missing artifacts referenced by the post — cannot preview.",
    });

  const dir = join(PREVIEW, v.slug);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), v.postHtml);
  writeArtifacts(dir, v.artifacts);

  sendJson(res, 200, {
    ok: true,
    url: `/_preview/${v.slug}/`,
    redundant: v.redundant,
    notebook: v.notebook,
  });
}

async function handlePublish(req, res) {
  const v = validate(JSON.parse((await readBody(req)).toString("utf8")));
  if (v.errors.length) return sendJson(res, 400, { ok: false, errors: v.errors });
  if (v.missing.length)
    return sendJson(res, 422, {
      ok: false,
      missing: v.missing,
      redundant: v.redundant,
      message: "Missing artifacts — cannot publish.",
    });

  const dir = join(POSTS, v.slug);
  if (existsSync(dir))
    return sendJson(res, 409, { ok: false, message: `posts/${v.slug}/ already exists.` });

  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), v.postHtml);
  writeArtifacts(dir, v.artifacts);
  insertIntoListing(
    buildListItem({
      slug: v.slug,
      title: v.title,
      date: v.date,
      tldr: v.tldr,
      notebook: v.notebook,
      tags: v.tags,
    }),
  );
  rmSync(join(PREVIEW, v.slug), { recursive: true, force: true });

  sendJson(res, 200, {
    ok: true,
    slug: v.slug,
    dir: `posts/${v.slug}/`,
    url: `/posts/${v.slug}/`,
    redundant: v.redundant,
  });
}

// ---------------------------------------------------------------------------
// server
// ---------------------------------------------------------------------------
const server = createServer(async (req, res) => {
  try {
    const url = req.url || "/";
    if (req.method === "GET" && (url === "/" || url === "/index.html")) {
      res.writeHead(200, { "content-type": MIME[".html"], "cache-control": "no-store" });
      return res.end(readFileSync(UI_FILE));
    }
    if (req.method === "POST" && url === "/api/preview") return await handlePreview(req, res);
    if (req.method === "POST" && url === "/api/publish") return await handlePublish(req, res);
    if (req.method === "GET" && url === "/favicon.ico") return send(res, 204, "");
    if (req.method === "GET") return serveStatic(res, url);
    send(res, 405, "method not allowed");
  } catch (err) {
    sendJson(res, 500, { ok: false, message: String((err && err.message) || err) });
  }
});

server.listen(PORT, () => {
  console.log(`\n  Post authoring:   http://localhost:${PORT}/`);
  console.log(`  Repo root:        ${ROOT}`);
  console.log(`  Preview temp:     ${PREVIEW}  (gitignored, safe to delete)\n`);
});