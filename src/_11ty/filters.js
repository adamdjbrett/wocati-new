// Jekyll Liquid filters that LiquidJS doesn't ship, so Minimal Mistakes
// templates render unmodified under Build Awesome (Eleventy).
import {
  dateToXmlschema, dateToRfc822, strftime, toDate,
  jekyllSlugify, stripHtml, xmlEscape,
} from "./lib.js";

export default function addJekyllFilters(eleventyConfig, { siteUrl, baseurl = "", markdown }) {
  const abs = (input) => {
    if (input == null || input === "" || input === false) return input; // Jekyll passes nil through
    let s = prettyUrl(String(input));
    if (/^(https?:)?\/\//.test(s)) return s;
    s = baseurl + (s.startsWith("/") ? s : `/${s}`);
    return siteUrl.replace(/\/$/, "") + s;
  };

  const filters = {
    /* URLs */
    relative_url: (s) => {
      if (s == null || s === "" || s === false) return s;
      let v = prettyUrl(String(s));
      if (/^(https?:)?\/\//.test(v)) return v;
      return baseurl + (v.startsWith("/") ? v : `/${v}`);
    },
    absolute_url: abs,

    /* dates */
    date: (v, fmt) => strftime(v, fmt ?? "%a, %d %b %Y %H:%M:%S %z"),
    date_to_xmlschema: dateToXmlschema,
    date_to_rfc822: dateToRfc822,
    date_to_string: (v) => strftime(v, "%d %b %Y"),
    date_to_long_string: (v) => strftime(v, "%d %B %Y"),

    /* strings */
    markdownify: (s) => preserveNumericEntities(String(s ?? ""), (input) => markdown.render(input)),
    smartify: (s) => preserveNumericEntities(String(s ?? ""), (input) => markdown.renderInline(input)),
    strip_html: stripHtml,
    xml_escape: xmlEscape,
    escape_once: escapeOnce,
    cgi_escape: (s) => encodeURIComponent(String(s ?? "")).replace(/[()]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`).replace(/%20/g, "+"),
    url_encode: (s) => encodeURIComponent(String(s ?? "")).replace(/[()]/g, (ch) => `%${ch.charCodeAt(0).toString(16).toUpperCase()}`).replace(/%20/g, "+"),
    uri_escape: (s) => encodeURI(String(s ?? "")),
    slugify: (s, mode) => jekyllSlugify(s, mode),
    number_of_words: (s) => {
      const t = String(s ?? "").trim();
      return t ? t.split(/\s+/).length : 0;
    },
    normalize_whitespace: (s) => String(s ?? "").replace(/\s+/g, " "),
    jsonify: (v) => JSON.stringify(v ?? null),

    /* arrays (Jekyll-only) */
    where_exp: (arr, name, expr) => {
      arr = toArray(arr);
      const test = compileExpr(name, expr);
      return arr.filter(test);
    },
    find: (arr, prop, value) => toArray(arr).find((x) => x?.[prop] == value),
    find_exp: (arr, name, expr) => {
      const test = compileExpr(name, expr);
      return toArray(arr).find(test);
    },
    group_by: (arr, prop) => {
      const groups = new Map();
      for (const x of toArray(arr)) {
        const k = x?.[prop] == null ? "" : String(x[prop]);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(x);
      }
      return [...groups.entries()].map(([name, items]) => ({ name, items, size: items.length }));
    },
    group_by_exp: (arr, name, expr) => {
      const fn = compileValueExpr(name, expr);
      const groups = new Map();
      for (const x of toArray(arr)) {
        const k = String(fn(x) ?? "");
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k).push(x);
      }
      return [...groups.entries()].map(([gname, items]) => ({ name: gname, items, size: items.length }));
    },
    sample: (arr, n) => {
      arr = [...toArray(arr)];
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return n === undefined ? arr[0] : arr.slice(0, n);
    },
    pop: (arr) => toArray(arr).slice(0, -1),
    shift: (arr) => toArray(arr).slice(1),
    push: (arr, item) => [...toArray(arr), item],
    unshift: (arr, item) => [item, ...toArray(arr)],
    inspect: (v) => JSON.stringify(v),
    to_integer: (v) => parseInt(v, 10) || 0,

    /* Shopify/Jekyll semantics: integer inputs -> integer (floored) division */
    divided_by: (a, b) => {
      const x = Number(a), y = Number(b);
      if (Number.isInteger(x) && Number.isInteger(y) && y !== 0) return Math.floor(x / y);
      return x / y;
    },
  };

  for (const [name, fn] of Object.entries(filters)) {
    eleventyConfig.addLiquidFilter(name, fn);
  }
}

function prettyUrl(input) {
  if (!input || /^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(input) || /^(mailto|tel):/i.test(input)) return input;
  const m = String(input).match(/^([^?#]*)([?#].*)?$/);
  if (!m) return input;
  let path = m[1];
  const suffix = m[2] || "";
  if (!path) return input;
  path = path.replace(/(^|\/)index\.html$/i, "$1");
  if (!/(^|\/)(404|google[a-z0-9]+|yandex_[a-z0-9]+)\.html$/i.test(path)) {
    path = path.replace(/\.html$/i, "/");
  }
  return path + suffix;
}

function toArray(v) {
  if (v == null) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === "object" && typeof v[Symbol.iterator] === "function") return [...v];
  return [v];
}

function preserveNumericEntities(s, render) {
  const entities = [];
  const input = s.replace(/&#(?:0*38|x0*26);/gi, (entity) => {
    const key = `@@JEKYLL_ENTITY_${entities.length}@@`;
    entities.push(entity);
    return key;
  });
  let output = render(input);
  entities.forEach((entity, i) => {
    output = output.replaceAll(`@@JEKYLL_ENTITY_${i}@@`, entity);
  });
  return output;
}

function escapeOnce(s) {
  return String(s ?? "")
    .replace(/&(?!(?:#\d+|#x[0-9a-fA-F]+|[A-Za-z][A-Za-z0-9]+);)/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* Tiny evaluator for Jekyll's `where_exp`/`group_by_exp` expressions.
   Supports: item.prop, ==, !=, contains, and/or, literals. Enough for
   Minimal Mistakes (e.g. "item.hidden != true", "item.date | date: '%Y'"). */
function compileValueExpr(name, expr) {
  const filterMatch = String(expr).match(/^\s*(.+?)\s*\|\s*date:\s*['"](.+?)['"]\s*$/);
  if (filterMatch) {
    const getter = compileValueExpr(name, filterMatch[1]);
    return (item) => strftimeSafe(getter(item), filterMatch[2]);
  }
  const path = String(expr).trim();
  if (/^['"].*['"]$/.test(path)) return () => path.slice(1, -1);
  if (/^-?\d+(\.\d+)?$/.test(path)) return () => Number(path);
  if (path === "true") return () => true;
  if (path === "false") return () => false;
  if (path === "nil" || path === "null") return () => null;
  const parts = path.split(".");
  if (parts[0] !== name) return () => undefined;
  return (item) => parts.slice(1).reduce((o, k) => (o == null ? o : o[k]), item);
}

function strftimeSafe(v, fmt) {
  const d = toDate(v);
  return d ? strftime(d, fmt) : "";
}

function compileExpr(name, expr) {
  const s = String(expr).trim();
  const or = s.split(/\s+or\s+/);
  if (or.length > 1) {
    const tests = or.map((e) => compileExpr(name, e));
    return (item) => tests.some((t) => t(item));
  }
  const and = s.split(/\s+and\s+/);
  if (and.length > 1) {
    const tests = and.map((e) => compileExpr(name, e));
    return (item) => tests.every((t) => t(item));
  }
  let m = s.match(/^(.+?)\s*(==|!=|>=|<=|>|<)\s*(.+)$/);
  if (m) {
    const l = compileValueExpr(name, m[1]);
    const r = compileValueExpr(name, m[3]);
    const op = m[2];
    return (item) => {
      const a = l(item), b = r(item);
      switch (op) {
        case "==": return looseEq(a, b);
        case "!=": return !looseEq(a, b);
        case ">": return a > b;
        case "<": return a < b;
        case ">=": return a >= b;
        case "<=": return a <= b;
      }
    };
  }
  m = s.match(/^(.+?)\s+contains\s+(.+)$/);
  if (m) {
    const l = compileValueExpr(name, m[1]);
    const r = compileValueExpr(name, m[2]);
    return (item) => {
      const a = l(item), b = r(item);
      if (a == null) return false;
      if (Array.isArray(a)) return a.includes(b);
      return String(a).includes(String(b));
    };
  }
  const v = compileValueExpr(name, s);
  return (item) => !!v(item);
}

function looseEq(a, b) {
  if (a == null && (b == null || b === false)) return a === b || (a == null && b == null);
  return a == b; // Liquid-style loose equality
}
