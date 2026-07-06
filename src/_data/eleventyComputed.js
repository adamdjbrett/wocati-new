// Per-page computed data that bridges Eleventy's world to Jekyll's Liquid
// vocabulary used by Minimal Mistakes:
//
//   jpage          -> what Jekyll calls `page` (vendored templates are
//                     rewritten `page.` -> `jpage.` at vendor time, because
//                     Eleventy reserves `page`)
//   site.posts     -> Jekyll post objects, newest first
//   site.categories / site.tags / site.related_posts / site.documents
//   paginator      -> Jekyll paginator facade (home page pagination)
import staticSite from "./site.js";
import { autoExcerpt, safeComputed } from "../_11ty/lib.js";

const EXCLUDE_KEYS = new Set([
  "collections", "site", "eleventy", "pkg", "page", "jpage", "paginator",
  "eleventyComputed", "eleventyNavigation", "pagination",
]);

// Synthetic Eleventy collection tags that must not leak into Jekyll-visible tags.
const SYNTHETIC_TAGS = new Set(["posts", "jekyllPages"]);
const normalizeTaxonomy = (value) => String(value ?? "").trim().toLowerCase().replace(/\s+/g, "-");
const cleanTags = (tags) => [].concat(tags || []).filter((t) => !SYNTHETIC_TAGS.has(t)).map(normalizeTaxonomy).filter(Boolean);
const cleanCategories = (categories) => [].concat(categories || []).map(normalizeTaxonomy).filter(Boolean);

function postFacade(item) {
  if (item.data.__jekyllFacade) return item.data.__jekyllFacade;
  const d = item.data;
  const facade = {};
  for (const [k, v] of Object.entries(d)) {
    if (!EXCLUDE_KEYS.has(k)) facade[k] = v;
  }
  facade.tags = cleanTags(d.tags);
  facade.categories = cleanCategories(d.categories);
  facade.url = item.url;
  facade.id = String(item.url).replace(/\/$/, ""); // Jekyll post.id has no trailing slash
  facade.date = item.date;
  facade.collection = d.jekyll_collection || null;
  facade.excerpt = d.excerpt != null ? d.excerpt : autoExcerpt(item.rawInput ?? item.template?.frontMatter?.content ?? "");
  Object.defineProperty(facade, "content", {
    enumerable: true,
    get() { try { return item.templateContent; } catch { return ""; } },
  });
  Object.defineProperty(d, "__jekyllFacade", { value: facade, enumerable: false, configurable: true });
  return facade;
}

function sortedPosts(collections) {
  const posts = (collections.posts || []).slice();
  posts.sort((a, b) => b.date - a.date); // newest first, like Jekyll
  return posts;
}

export default {
  site: safeComputed((data) => {
    void data.collections?.posts; void data.collections?.jekyllPages; void data.page?.url;
    const collections = data.collections || {};
    const posts = sortedPosts(collections).map(postFacade);
    const pages = (collections.jekyllPages || []).map(postFacade);

    const categories = {};
    const tags = {};
    const postsAsc = posts.slice().reverse();
    for (const p of postsAsc) {
      for (const c of [].concat(p.categories || [])) (categories[c] ||= []).push(p);
      for (const t of [].concat(p.tags || [])) (tags[t] ||= []).push(p);
    }
    for (const docs of Object.values(categories)) docs.sort((a, b) => b.date - a.date);
    for (const docs of Object.values(tags)) docs.sort((a, b) => b.date - a.date);

    return {
      ...staticSite,
      posts,
      pages,
      documents: posts.concat(pages),
      categories,
      tags,
      // Jekyll's related_posts: 10 most recent, never including the current doc
      related_posts: posts.filter((p) => p.url !== data.page?.url).slice(0, 10),
      html_pages: pages,
      // Jekyll site.collections (used by the theme's lunr search store)
      collections: [{ label: "posts", output: true, docs: postsAsc }],
    };
  }),

  jpage: safeComputed((data) => {
    // Touch dependencies FIRST: Eleventy discovers them with a proxy, and
    // Object.entries() below throws on that proxy before it would see these.
    void data.collections?.posts; void data.collections?.all; void data.page?.url; void data.jekyll_collection;
    const j = {};
    for (const [k, v] of Object.entries(data)) {
      if (!EXCLUDE_KEYS.has(k)) j[k] = v;
    }
    j.tags = cleanTags(data.tags);
    j.categories = cleanCategories(data.categories);
    j.url = data.page?.url ?? "";
    j.id = j.url.replace(/\/$/, "");
    // Jekyll: page.date exists only when set in front matter (posts always have it).
    // Eleventy invents file dates for everything — don't leak those.
    j.date = data.date ?? (data.jekyll_collection === "posts" ? data.page?.date : undefined);
    j.collection = data.jekyll_collection || null;
    if (j.excerpt == null && data.page?.rawInput) j.excerpt = autoExcerpt(data.page.rawInput);

    // Jekyll's page.content (rendered HTML) — lazily via our own collection item
    const inputPath = data.page?.inputPath;
    const all = data.collections?.all;
    Object.defineProperty(j, "content", {
      enumerable: false,
      get() {
        const self = all?.find((it) => it.inputPath === inputPath && it.url === this.url);
        try { return self ? self.templateContent : ""; } catch { return ""; }
      },
    });

    // previous / next post links (Jekyll orders oldest -> newest for these)
    if (data.jekyll_collection === "posts" && data.collections?.posts) {
      const asc = data.collections.posts.slice().sort((a, b) => a.date - b.date);
      const i = asc.findIndex((p) => p.url === j.url);
      if (i > 0) j.previous = postFacade(asc[i - 1]);
      if (i >= 0 && i < asc.length - 1) j.next = postFacade(asc[i + 1]);
    }
    return j;
  }),

  paginator: safeComputed((data) => {
    if (!data.pagination || data.pagination.data !== "collections.posts") return undefined;
    const pag = data.pagination;
    const perPage = pag.size;
    const all = (data.collections?.posts || []);
    const total = all.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const pageNum = pag.pageNumber + 1; // Jekyll is 1-based
    const pathFor = (n) => (n <= 1 ? "/" : `/page${n}/`);
    return {
      posts: (pag.items || []).map(postFacade),
      page: pageNum,
      per_page: perPage,
      total_posts: total,
      total_pages: totalPages,
      previous_page: pageNum > 1 ? pageNum - 1 : null,
      previous_page_path: pageNum > 1 ? pathFor(pageNum - 1) : null,
      next_page: pageNum < totalPages ? pageNum + 1 : null,
      next_page_path: pageNum < totalPages ? pathFor(pageNum + 1) : null,
    };
  }),
};
