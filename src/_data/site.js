// Jekyll `site.*` facade (static part). The dynamic members that need
// collections (site.posts, site.categories, ...) are layered on in
// _data/eleventyComputed.js.
import fs from "node:fs";
import path from "node:path";
import { ROOT, loadYamlFile, collectStaticFiles } from "../_11ty/lib.js";

const config = loadYamlFile(path.join(ROOT, "_data", "settings.yml"));

// Jekyll exposes _data/* as site.data.*
const dataDir = path.join(ROOT, "_data");
const data = {};
for (const f of fs.readdirSync(dataDir)) {
  if (!/\.(yml|yaml|json)$/.test(f)) continue;
  const key = f.replace(/\.(yml|yaml|json)$/, "");
  data[key] = loadYamlFile(path.join(dataDir, f));
}
// Theme UI text (vendored from Minimal Mistakes).
const uiText = path.join(ROOT, "_data", "ui-text.yml");
if (!data["ui-text"] && fs.existsSync(uiText)) data["ui-text"] = loadYamlFile(uiText);

const site = {
  ...config,
  baseurl: config.baseurl || "",
  data,
  time: new Date(),
  static_files: collectStaticFiles(),
};

export default site;
