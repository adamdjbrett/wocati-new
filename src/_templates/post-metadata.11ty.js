// Port of _plugins/fair_metadata_json.rb: a schema.org JSON-LD
// metadata.json beside every post. Zotero-aware: front matter
// `zotero.type` (blogPost | book | journalArticle | document | report)
// maps to the right schema.org @type; default stays BlogPosting.
import { stripHtml, autoExcerpt, siteDateParts } from "../_11ty/lib.js";

const SCHEMA_TYPE = {
  blogPost: "BlogPosting",
  book: "Book",
  journalArticle: "ScholarlyArticle",
  journal: "Periodical",
  document: "DigitalDocument",
  report: "Report",
};

function ymd(date) {
  const p = siteDateParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function absoluteUrl(siteUrl, value) {
  if (!value) return null;
  value = String(value);
  if (/^https?:\/\//.test(value)) return value;
  return siteUrl + (value.startsWith("/") ? value : `/${value}`);
}

export default class {
  data() {
    return {
      pagination: { data: "collections.posts", size: 1, alias: "post" },
      permalink: (data) => {
        const u = data.post?.url;
        if (typeof u !== "string") return undefined; // dependency-discovery pass
        return `${u.replace(/\/?$/, "/")}metadata.json`;
      },
      eleventyExcludeFromCollections: true,
      sitemap: false,
    };
  }

  render({ post, site }) {
    const d = post.data;
    const siteUrl = String(site.url || "").replace(/\/$/, "");
    const url = siteUrl + post.url;
    const title = d.title || site.title || site.name;
    let description = d.description || d.excerpt;
    if (!description) {
      let content = "";
      try { content = post.templateContent || ""; } catch { content = autoExcerpt(post.rawInput || ""); }
      description = stripHtml(content).replace(/\s+/g, " ").trim().slice(0, 300);
    }
    const author = d.author || site.author?.name || site.author || site.name || site.title;
    const language = String(site.locale || site.language || "en").slice(0, 2);
    const image = d.image || d.header?.image || d.header?.teaser || site.teaser || site.logo;
    const zotero = d.zotero || {};
    const schemaType = SCHEMA_TYPE[zotero.type] || "BlogPosting";

    const data = {
      "@context": "https://schema.org",
      "@type": schemaType,
      "@id": `${url}#metadata`,
      name: title,
      headline: title,
      description: String(description),
      url,
      identifier: url,
      inLanguage: language,
      author: { "@type": "Organization", name: String(author) },
      publisher: { "@type": "Organization", name: String(site.title || site.name), url: siteUrl },
      isPartOf: { "@type": "WebSite", "@id": `${siteUrl}/#website`, name: String(site.title || site.name), url: siteUrl },
    };
    if (post.date) data.datePublished = ymd(post.date);
    if (d.last_modified_at) data.dateModified = String(d.last_modified_at);
    if (image) data.image = absoluteUrl(siteUrl, image);
    if (d.citations) data.citation = d.citations;

    // Zotero bibliographic extensions (books, journals, journal articles)
    if (zotero.publication) data.isPartOf = { "@type": "Periodical", name: String(zotero.publication) };
    if (zotero.isbn) data.isbn = String(zotero.isbn);
    if (zotero.issn) data.issn = String(zotero.issn);
    if (zotero.volume) data.volumeNumber = String(zotero.volume);
    if (zotero.issue) data.issueNumber = String(zotero.issue);
    if (zotero.pages) data.pagination = String(zotero.pages);
    if (zotero.doi || d.doi) data.sameAs = `https://doi.org/${zotero.doi || d.doi}`;
    if (zotero.publisher) data.publisher = { "@type": "Organization", name: String(zotero.publisher) };

    return JSON.stringify(data, null, 2);
  }
}
