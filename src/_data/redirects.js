// Collects `redirect_from` front matter across posts and pages
// (jekyll-redirect-from parity): stub pages + redirects.json.
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { ROOT, jekyllSlugify } from "../_11ty/lib.js";

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(abs);
    else if (/\.(md|html)$/.test(e.name)) yield abs;
  }
}

function frontMatter(file) {
  const src = fs.readFileSync(file, "utf8");
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  try { return yaml.load(m[1], { schema: yaml.CORE_SCHEMA }); } catch { return null; }
}

function postPermalink(file, fm) {
  if (fm.permalink) return fm.permalink;
  const cats = [].concat(fm.categories || []).map((c) => jekyllSlugify(c));
  const slug = path.basename(file).replace(/\.(md|html)$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "");
  return `/${cats.concat(slug).join("/")}/`;
}

function redirectLocation(out, to) {
  const outFile = out.endsWith("/") ? `${out}index.html` : out;
  const pretty = prettyPath(to);
  let rel = path.posix.relative(path.posix.dirname(outFile), pretty) || "./";
  if (pretty.endsWith("/") && !rel.endsWith("/")) rel += "/";
  return rel;
}

function prettyPath(p) {
  return String(p).replace(/(^|\/)index\.html$/i, "$1").replace(/\.html$/i, "/");
}

const redirects = [];
for (const file of [...walk(path.join(ROOT, "_posts")), ...walk(path.join(ROOT, "_pages"))]) {
  const fm = frontMatter(file);
  if (!fm || fm.redirect_from == null) continue;
  const to = file.includes(`${path.sep}_posts${path.sep}`)
    ? postPermalink(file, fm)
    : fm.permalink;
  if (!to) continue;
  for (const from of [].concat(fm.redirect_from)) {
    const f = String(from);
    // Jekyll writes "/pubs" (no trailing slash, no extension) as /pubs.html
    const out = /\/$/.test(f) || /\.[a-z0-9]+$/i.test(f) ? f : `${f}.html`;
    redirects.push({ from: f, to, out, location: redirectLocation(out, to) });
  }
}

export default redirects;
