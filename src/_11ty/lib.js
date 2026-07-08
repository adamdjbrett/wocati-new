// Jekyll-compatibility helpers for the Build Awesome (Eleventy) port.
// Site timezone is UTC for deterministic Build Awesome output.
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

export const SITE_TZ = "UTC";
process.env.TZ = SITE_TZ;

export const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
export const PROJECT_ROOT = path.resolve(ROOT, "..");

/* ---------- YAML / config ---------- */

export function loadYamlFile(p) {
  return yaml.load(fs.readFileSync(p, "utf8"));
}

/** Parse YAML but keep timestamps as strings (Jekyll-style date handling is ours). */
export function yamlNoDates(src) {
  return yaml.load(src, { schema: yaml.CORE_SCHEMA });
}

/* ---------- dates ---------- */

/**
 * Parse a Jekyll front-matter date exactly like Ruby's YAML (psych):
 *  - "2020-07-06T15:34:30-04:00" -> explicit offset honored
 *  - "2012-06-25 17:49:55"       -> treated as UTC (verified against the
 *                                   live Jekyll build's sitemap/lastmod)
 *  - "2012-06-25"                -> UTC midnight
 * Rendering then happens in the site timezone (UTC).
 */
export function parseJekyllDate(v) {
  if (v == null) return v;
  if (v instanceof Date) return v;
  const s = String(v).trim();
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00Z`);
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s)) {
    return new Date(`${s.replace(" ", "T")}Z`);
  }
  const d = new Date(s);
  return isNaN(d) ? undefined : d;
}

function pad(n, w = 2) { return String(n).padStart(w, "0"); }

/** Offset (minutes east of UTC) for a date in the site timezone. */
function tzOffsetMinutes(date) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: SITE_TZ, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const parts = Object.fromEntries(dtf.formatToParts(date).map(p => [p.type, p.value]));
  const asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUTC - date.getTime()) / 60000);
}

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

/** Pieces of a date rendered in the site timezone. */
export function siteDateParts(date) {
  const off = tzOffsetMinutes(date);
  const local = new Date(date.getTime() + off * 60000);
  return {
    year: local.getUTCFullYear(), month: local.getUTCMonth() + 1, day: local.getUTCDate(),
    hour: local.getUTCHours(), minute: local.getUTCMinutes(), second: local.getUTCSeconds(),
    wday: local.getUTCDay(), offsetMin: off,
  };
}

function offsetStr(min, sep = ":") {
  const sign = min < 0 ? "-" : "+";
  const a = Math.abs(min);
  return `${sign}${pad(Math.floor(a / 60))}${sep}${pad(a % 60)}`;
}

/** Jekyll `date_to_xmlschema`: 2012-06-26T04:19:09-04:00 */
export function dateToXmlschema(v) {
  const d = toDate(v); if (!d) return v;
  const p = siteDateParts(d);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}${offsetStr(p.offsetMin)}`;
}

/** Jekyll `date_to_rfc822`: Tue, 26 Jun 2012 04:19:09 -0400 */
export function dateToRfc822(v) {
  const d = toDate(v); if (!d) return v;
  const p = siteDateParts(d);
  return `${DAYS[p.wday].slice(0,3)}, ${pad(p.day)} ${MONTHS[p.month-1].slice(0,3)} ${p.year} ${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)} ${offsetStr(p.offsetMin, "")}`;
}

export function toDate(v) {
  if (v instanceof Date) return v;
  if (typeof v === "number") return new Date(v * 1000);
  if (typeof v === "string") {
    if (v === "now" || v === "today") return new Date();
    return parseJekyllDate(v);
  }
  return null;
}

/** Ruby strftime (the subset Jekyll/Minimal Mistakes templates use), in site TZ. */
export function strftime(v, fmt) {
  const d = toDate(v); if (!d) return v == null ? "" : String(v);
  const p = siteDateParts(d);
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return String(fmt).replace(/%(-?[a-zA-Z%])/g, (m, t) => {
    switch (t) {
      case "Y": return String(p.year);
      case "y": return pad(p.year % 100);
      case "m": return pad(p.month);
      case "-m": return String(p.month);
      case "d": return pad(p.day);
      case "-d": return String(p.day);
      case "e": return String(p.day).padStart(2, " ");
      case "j": return pad(Math.ceil((Date.UTC(p.year,p.month-1,p.day) - Date.UTC(p.year,0,1)) / 86400000) + 1, 3);
      case "H": return pad(p.hour);
      case "-H": return String(p.hour);
      case "I": return pad(h12);
      case "-I": return String(h12);
      case "M": return pad(p.minute);
      case "S": return pad(p.second);
      case "p": return p.hour < 12 ? "AM" : "PM";
      case "P": return p.hour < 12 ? "am" : "pm";
      case "B": return MONTHS[p.month - 1];
      case "b": case "h": return MONTHS[p.month - 1].slice(0, 3);
      case "A": return DAYS[p.wday];
      case "a": return DAYS[p.wday].slice(0, 3);
      case "u": return String(p.wday === 0 ? 7 : p.wday);
      case "w": return String(p.wday);
      case "s": return String(Math.floor(d.getTime() / 1000));
      case "z": return offsetStr(p.offsetMin, "");
      case "Z": return "UTC"; // display-only; not used by the theme
      case "%": return "%";
      default: return m;
    }
  });
}

/* ---------- strings ---------- */

/** kramdown-style header ID (auto_ids). */
export function kramdownSlug(str) {
  let s = String(str)
    .replace(/<[^>]*>/g, "")
    .replace(/&[^\s;]+;/g, "")
    .replace(/[^\p{L}0-9 \-]/gu, "")
    .replace(/\s/g, "-")
    .toLowerCase();
  return s || "section";
}

/** Jekyll `slugify` (default mode). */
export function jekyllSlugify(str, mode = "default") {
  let s = String(str);
  if (mode === "raw") return s.trim().replace(/\s+/g, "-").toLowerCase();
  if (mode === "pretty") return s.trim().toLowerCase().replace(/[^a-z0-9._~!$&'()+,;=@\-]+/g, "-").replace(/^-|-$/g, "");
  // default / latin
  return s.trim().toLowerCase().replace(/[^a-z0-9\-_]+/g, "-").replace(/^-+|-+$/g, "");
}

export function stripHtml(s) {
  return String(s ?? "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]*>/g, "");
}

export function xmlEscape(s) {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Jekyll auto-excerpt: content up to the first blank line. */
export function autoExcerpt(rawContent) {
  const c = String(rawContent ?? "").replace(/\r\n/g, "\n").trim();
  if (!c) return "";
  const i = c.indexOf("\n\n");
  return i === -1 ? c : c.slice(0, i);
}

/* ---------- computed-data helper ---------- */

/**
 * Eleventy runs eleventyComputed functions once with a dependency-tracking
 * Proxy (values aren't real). Wrap functions so that pass can't crash.
 */
export function safeComputed(fn) {
  return (data) => {
    try { return fn(data); }
    catch { return undefined; }
  };
}

/* ---------- static files (Jekyll site.static_files facade) ---------- */

const STATIC_DIRS = ["assets"];
const STATIC_ROOT_FILES = ["favicon.ico", "robots.txt", "humans.txt"];

export function collectStaticFiles() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(abs); continue; }
      const rel = "/" + path.relative(ROOT, abs).split(path.sep).join("/");
      const st = fs.statSync(abs);
      files.push({
        path: rel,
        name: entry.name,
        basename: entry.name.replace(/\.[^.]+$/, ""),
        extname: path.extname(entry.name),
        modified_time: st.mtime,
        // Front-matter defaults from the migrated site settings:
        image: rel.startsWith("/assets/images/"),
        pdf: rel.startsWith("/assets/wp-content/uploads/"),
      });
    }
  };
  for (const d of STATIC_DIRS) {
    const abs = path.join(ROOT, d);
    if (fs.existsSync(abs)) walk(abs);
  }
  for (const f of STATIC_ROOT_FILES) {
    const abs = path.join(ROOT, f);
    if (fs.existsSync(abs)) {
      const st = fs.statSync(abs);
      files.push({ path: `/${f}`, name: f, basename: f.replace(/\.[^.]+$/, ""), extname: path.extname(f), modified_time: st.mtime, image: false, pdf: false });
    }
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return files;
}
