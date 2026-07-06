// Post defaults plus the legacy permalink shape: /:categories/:title/
import { jekyllSlugify, safeComputed } from "../_11ty/lib.js";

export default {
  layout: "single",
  author_profile: true,
  read_time: true,
  comments: true,
  share: true,
  related: true,
  jekyll_collection: "posts",
  tags: ["posts"], // synthetic; stripped from facades (see _data/eleventyComputed.js)
  eleventyComputed: {
    permalink: safeComputed((data) => {
      if (typeof data.permalink === "string" && data.permalink !== "") return data.permalink;
      const slug = data.page.fileSlug;
      if (typeof slug !== "string") return undefined; // dependency-discovery pass
      const raw = data.categories;
      const cats = (Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [])
        .filter((c) => typeof c === "string")
        .map((c) => jekyllSlugify(c));
      return `/${cats.concat(slug).join("/")}/`;
    }),
  },
};
