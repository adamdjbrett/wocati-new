// WOCATI — Build Awesome (Eleventy) configuration.
// Jekyll + Minimal Mistakes 4.28.0 compatibility port: identical HTML/CSS,
// identical permalinks, JSON-LD / Zotero / metadata.json integration intact.
import path from "node:path";
import fs from "node:fs";
import fontAwesomePlugin from "@11ty/font-awesome";
import Image from "@11ty/eleventy-img";
import { imageSize } from "image-size";
import yaml from "js-yaml";
import markdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import { kramdownSlug, parseJekyllDate, yamlNoDates, SITE_TZ, ROOT } from "./src/_11ty/lib.js";
import kramdownIndent from "./src/_11ty/kramdown-render.js";
import addJekyllFilters from "./src/_11ty/filters.js";
import site from "./src/_data/site.js";

process.env.TZ = SITE_TZ;

const imageDimensionCache = new Map();

function localImageDimensions(src) {
  const cleanSrc = String(src || "").split(/[?#]/)[0];
  if (!cleanSrc || /^[a-z][a-z0-9+.-]*:/i.test(cleanSrc) || cleanSrc.startsWith("//")) return null;

  const relativePath = cleanSrc.replace(/^\//, "");
  const absolutePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(absolutePath)) return null;
  if (imageDimensionCache.has(absolutePath)) return imageDimensionCache.get(absolutePath);

  try {
    const size = imageSize(fs.readFileSync(absolutePath));
    const dimensions = size.width && size.height ? { width: size.width, height: size.height } : null;
    imageDimensionCache.set(absolutePath, dimensions);
    return dimensions;
  } catch {
    imageDimensionCache.set(absolutePath, null);
    return null;
  }
}

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(fontAwesomePlugin, {
    transform: "i[class]",
    shortcode: false,
    defaultAttributes: {
      class: "icon-svg",
      "aria-hidden": "true",
    },
  });

  /* ---------- template languages ---------- */
  eleventyConfig.setLiquidOptions({
    jekyllInclude: true,     // {% include foo.html param="x" %}
    extname: "",
    dynamicPartials: false,
    strictFilters: false,
    lenientIf: true,
  });

  // YAML data files (_data/*.yml), like Jekyll.
  eleventyConfig.addDataExtension("yml,yaml", (contents) => yaml.load(contents));

  // Front matter: keep Jekyll's timezone semantics for date strings.
  eleventyConfig.setFrontMatterParsingOptions({
    engines: {
      yaml: (src) => {
        const data = yamlNoDates(src) || {};
        if (typeof data.date === "string") data.date = parseJekyllDate(data.date);
        return data;
      },
    },
  });

  /* ---------- markdown: kramdown-compatible ---------- */
  const md = markdownIt({ html: true, xhtmlOut: true, breaks: false, linkify: false, typographer: true })
    .use(markdownItAnchor, {
      slugify: kramdownSlug,
      tabIndex: false,
      level: [1, 2, 3, 4, 5, 6],
    });
  kramdownIndent(md);
  eleventyConfig.setLibrary("md", md);
  eleventyConfig.addGlobalData("__markdown", () => md);

  /* ---------- Jekyll Liquid filters ---------- */
  addJekyllFilters(eleventyConfig, { siteUrl: site.url, baseurl: site.baseurl, markdown: md });

  // Jekyll's `jekyll.environment` (theme gates analytics & comments on it).
  eleventyConfig.addGlobalData("jekyll", { environment: process.env.JEKYLL_ENV || "development" });

  /* ---------- collections ----------
     Posts join `collections.posts` via a synthetic tag in
     _posts/_posts.11tydata.js (tag-based collections participate in the
     dependency graph, which pagination needs). The synthetic tags are
     stripped from all Jekyll-facing facades so rendered tag lists stay
     identical to Jekyll's. */

  /* ---------- passthrough copy (static files) ---------- */
  eleventyConfig.addPassthroughCopy({
    "src/assets": "assets",
    "src/CNAME": "CNAME",
    "src/favicon.ico": "favicon.ico",
    "src/googleb426ad61102b4db9.html": "googleb426ad61102b4db9.html",
    "src/googlebfdcfddbdbfcbd99.html": "googlebfdcfddbdbfcbd99.html",
    "src/yandex_83b87e4256e24fa4.html": "yandex_83b87e4256e24fa4.html",
    "src/_redirects": "_redirects",
  });

  /* ---------- ignores ---------- */
  for (const p of [
    "_site/**", ".parity/**",
    "HANDOFF.md", "./HANDOFF.md", "**/HANDOFF.md", "patches.md",
    "README.md", "techstack.md", "techstack.yml",
    "googleb426ad61102b4db9.html", "googlebfdcfddbdbfcbd99.html",
    "yandex_83b87e4256e24fa4.html",
    "src/googleb426ad61102b4db9.html", "src/googlebfdcfddbdbfcbd99.html",
    "src/yandex_83b87e4256e24fa4.html",
    "metadata.json",          // replaced by _templates/org-metadata.liquid
    "_pages/ciations.xml",    // replaced by _templates/citations.liquid
    ".htaccess",
    "robots.txt", "humans.txt",
  ]) {
    eleventyConfig.ignores.add(p);
  }

  /* ---------- misc parity ---------- */
  eleventyConfig.setDataDeepMerge(true);

  eleventyConfig.addTransform("wocatiResponsiveImages", async function (content) {
    if (typeof this.page.outputPath !== "string" || !this.page.outputPath.endsWith(".html")) return content;

    const imgRegex = /<img\b([^>]*?)\bsrc=(["'])([^"']+)\2([^>]*)>/gi;
    const operations = [];

    let match;
    while ((match = imgRegex.exec(content)) !== null) {
      const [fullMatch, before, quote, src, after] = match;
      if (/<picture[\s\S]*$/.test(content.slice(Math.max(0, match.index - 120), match.index))) continue;
      if (/favicon|apple-touch-icon|android-chrome|mstile|safari-pinned-tab/i.test(src)) continue;

      const srcNoQuery = src.split(/[?#]/)[0];
      const ext = path.extname(srcNoQuery).toLowerCase();
      if (![".png", ".jpg", ".jpeg", ".gif"].includes(ext)) continue;

      const rel = srcNoQuery.replace(/^https?:\/\/[^/]+/i, "").replace(/^\//, "");
      const absPath = path.join(ROOT, rel);
      if (!fs.existsSync(absPath)) continue;

      const parsed = path.parse(rel);
      const urlPath = "/" + parsed.dir.replace(/\\/g, "/");
      const outDir = path.join("_site", parsed.dir);

      try {
        await Image(absPath, {
          widths: [null],
          formats: ["webp"],
          outputDir: outDir,
          urlPath,
          filenameFormat: (id, src, filenameWidth, format) => {
            const name = path.basename(src, path.extname(src));
            return `${name}.${format}`;
          },
        });

        const webpSrc = srcNoQuery.replace(/\.(png|jpe?g|gif)$/i, ".webp");

        // Build srcset with high-res Retina variants (e.g. -1400w, -2800w)
        const srcsetSources = [webpSrc];
        const origRel = srcNoQuery.replace(/^https?:\/\/[^/]+/i, "").replace(/^\//, "");
        const origDir = path.dirname(origRel);
        const origName = path.basename(origRel, path.extname(origRel));
        for (const suffix of ["-1400w", "-2800w"]) {
          const variant = `/${origDir}/${origName}${suffix}.webp`;
          if (fs.existsSync(path.join(ROOT, variant.replace(/^\//, "")))) {
            srcsetSources.push(variant);
          }
        }
        const sourceSrcset = srcsetSources.join(", ");

        const dimensions = localImageDimensions(src);
        let imgAttrs = `${before}src=${quote}${src}${quote}${after}`;
        if (dimensions) {
          if (!/\bwidth\s*=/.test(imgAttrs)) imgAttrs += ` width="${dimensions.width}"`;
          if (!/\bheight\s*=/.test(imgAttrs)) imgAttrs += ` height="${dimensions.height}"`;
        }
        if (!/\bloading\s*=/.test(imgAttrs)) imgAttrs += ' loading="lazy"';
        if (!/\bdecoding\s*=/.test(imgAttrs)) imgAttrs += ' decoding="async"';

        operations.push({
          index: match.index,
          from: fullMatch,
          to: `<picture><source srcset="${sourceSrcset}" type="image/webp"><img${imgAttrs}></picture>`,
        });
      } catch (e) {
        console.error(`[wocatiResponsiveImages] ${rel}: ${e.message}`);
      }
    }

    for (const { index, from, to } of operations.reverse()) {
      content = content.slice(0, index) + to + content.slice(index + from.length);
    }

    return content;
  });

  eleventyConfig.addTransform("wocatiImageDimensions", function (content) {
    if (typeof this.page.outputPath !== "string" || !this.page.outputPath.endsWith(".html")) return content;
    return content.replace(/<img\b([^>]*?)\bsrc=(["'])([^"']+)\2([^>]*)>/gi, (match, before, quote, src, after) => {
      if (/\bwidth\s*=/.test(match) && /\bheight\s*=/.test(match)) return match;
      const dimensions = localImageDimensions(src);
      if (!dimensions) return match;

      let attributes = `${before}src=${quote}${src}${quote}${after}`;
      if (!/\bwidth\s*=/.test(match)) attributes += ` width="${dimensions.width}"`;
      if (!/\bheight\s*=/.test(match)) attributes += ` height="${dimensions.height}"`;
      if (!/\bstyle\s*=/.test(match)) attributes += ` style="max-width: ${dimensions.width}px;"`;
      return `<img${attributes}>`;
    });
  });

  eleventyConfig.addTransform("wocatiAccessibleImageLinks", function (content) {
    if (typeof this.page.outputPath !== "string" || !this.page.outputPath.endsWith(".html")) return content;
    return content.replace(/<a\b((?=[^>]*\bclass=["'][^"']*\bimage-popup\b)[^>]*?)>(\s*<img\b[^>]*\balt=(["'])([^"']+)\3[^>]*>\s*)<\/a>/gi, (match, attrs, inner, _q, alt) => {
      const label = alt.trim() || "Open image";
      if (/\baria-label=/i.test(attrs)) return match;
      return `<a${attrs} aria-label="${label.replace(/"/g, "&quot;")}">${inner}</a>`;
    });
  });

  eleventyConfig.on("eleventy.after", async () => {
    const staticDirs = ["assets"];
    for (const dir of staticDirs) {
      const root = path.join("_site", dir);
      if (!fs.existsSync(root)) continue;
      for (const file of fs.globSync("**/.*", { cwd: root })) {
        fs.rmSync(path.join(root, file), { force: true, recursive: true });
      }
    }
  });

  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_layouts",
      data: "_data",
    },
    templateFormats: ["liquid", "md", "html", "11ty.js"],
    markdownTemplateEngine: "liquid",
    htmlTemplateEngine: "liquid",
    pathPrefix: "/",
  };
}
