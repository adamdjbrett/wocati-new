import fs from "node:fs";
import path from "node:path";
import { PROJECT_ROOT } from "../_11ty/lib.js";

const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8"));

export default {
  eleventyVersion: pkg.dependencies?.["@11ty/eleventy"] || "unknown",
};
