// WOCATI — Build Awesome (Eleventy) configuration.
// Jekyll + Minimal Mistakes 4.28.0 compatibility port: identical HTML/CSS,
// identical permalinks, JSON-LD / Zotero / metadata.json integration intact.
import path from "node:path";
import fs from "node:fs";
import fontAwesomePlugin from "@11ty/font-awesome";
import yaml from "js-yaml";
import markdownIt from "markdown-it";
import markdownItAnchor from "markdown-it-anchor";
import { kramdownSlug, parseJekyllDate, yamlNoDates, SITE_TZ, ROOT } from "./src/_11ty/lib.js";
import kramdownIndent from "./src/_11ty/kramdown-render.js";
import addJekyllFilters from "./src/_11ty/filters.js";
import site from "./src/_data/site.js";

process.env.TZ = SITE_TZ;

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
    "src/images": "images",
    "src/wp-content": "wp-content",
    "src/assets": "assets",
    "src/CNAME": "CNAME",
    "src/favicon.ico": "favicon.ico",
    "src/googleb426ad61102b4db9.html": "googleb426ad61102b4db9.html",
    "src/googlebfdcfddbdbfcbd99.html": "googlebfdcfddbdbfcbd99.html",
    "src/yandex_83b87e4256e24fa4.html": "yandex_83b87e4256e24fa4.html",
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

  eleventyConfig.addTransform("wocatiWebpPictures", function (content) {
    if (typeof this.page.outputPath !== "string" || !this.page.outputPath.endsWith(".html")) return content;
    return content.replace(/<img\b([^>]*?)\bsrc=(["'])([^"']+\.(?:png|jpe?g|gif))\2([^>]*)>/gi, (match, before, quote, src, after) => {
      if (/<picture[\s\S]*$/.test(content.slice(Math.max(0, content.indexOf(match) - 120), content.indexOf(match)))) return match;
      if (/favicon|apple-touch-icon|android-chrome|mstile/i.test(src)) return match;
      const srcNoQuery = src.split(/[?#]/)[0];
      const webpSrc = srcNoQuery.replace(/\.(?:png|jpe?g|gif)$/i, ".webp");
      const rel = webpSrc.replace(/^https?:\/\/[^/]+/i, "").replace(/^\//, "");
      if (!fs.existsSync(path.join(ROOT, rel))) return match;
      return `<picture><source srcset="${webpSrc}" type="image/webp">${match}</picture>`;
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
    const staticDirs = ["images", "wp-content", "assets"];
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
