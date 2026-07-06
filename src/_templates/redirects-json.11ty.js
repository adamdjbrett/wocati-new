// jekyll-redirect-from parity: /redirects.json
export default class {
  data() {
    return {
      permalink: "/redirects.json",
      eleventyExcludeFromCollections: true,
      sitemap: false,
    };
  }
  render({ redirects, site }) {
    const base = String(site.url || "").replace(/\/$/, "");
    const map = {};
    for (const r of redirects) map[r.from] = base + r.to;
    return JSON.stringify(map);
  }
}
