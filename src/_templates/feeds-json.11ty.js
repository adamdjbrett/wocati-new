export default class JsonFeed {
  data() {
    return {
      permalink: "/feeds/feeds.json",
      eleventyExcludeFromCollections: true,
      sitemap: false,
    };
  }

  render(data) {
    const site = data.site;
    return JSON.stringify({
      version: "https://jsonfeed.org/version/1.1",
      title: site.title,
      home_page_url: new URL("/", site.url).href,
      feed_url: new URL("/feeds/feeds.json", site.url).href,
      description: site.description,
      items: site.posts.slice(0, 20).map((post) => ({
        id: new URL(post.id, site.url).href,
        url: new URL(post.url, site.url).href,
        title: post.title,
        content_html: post.content || "",
        summary: post.excerpt || "",
        date_published: post.date instanceof Date ? post.date.toISOString() : post.date,
        date_modified: post.last_modified_at instanceof Date ? post.last_modified_at.toISOString() : undefined,
        tags: [...(post.categories || []), ...(post.tags || [])],
      })),
    }, null, 2);
  }
}
