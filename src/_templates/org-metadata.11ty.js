// Root /metadata.json (schema.org Organization) — port of the Jekyll
// front-mattered metadata.json.
export default class {
  data() {
    return {
      permalink: "/metadata.json",
      eleventyExcludeFromCollections: true,
      sitemap: false,
    };
  }
  render({ site }) {
    const url = String(site.url || "").replace(/\/$/, "");
    const json = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${url}/#organization`,
      name: site.title ?? site.name ?? null,
      description: String(site.description ?? "").replace(/\n/g, ""),
      url: site.url,
      inLanguage: String(site.locale || "en").slice(0, 2),
    };
    // Match the Liquid original's output shape (2-space indent objects,
    // values via jsonify).
    return [
      "{",
      `  "@context": "https://schema.org",`,
      `  "@type": "Organization",`,
      `  "@id": ${JSON.stringify(url + "/#organization")},`,
      `  "name": ${JSON.stringify(json.name)},`,
      `  "description": ${JSON.stringify(json.description)},`,
      `  "url": ${JSON.stringify(site.url)},`,
      `  "inLanguage": ${JSON.stringify(json.inLanguage)}`,
      "}",
    ].join("\n");
  }
}
