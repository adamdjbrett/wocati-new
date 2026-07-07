import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { promisify } from "node:util";
import { minify as minifyCss } from "csso";
import { transform as transformJs } from "esbuild";

const gzip = promisify(zlib.gzip);
const brotliCompress = promisify(zlib.brotliCompress);
const siteDir = path.resolve("_site");
const compressibleExtensions = new Set([".html", ".css", ".js", ".json", ".xml", ".svg", ".txt"]);
const minifyExtensions = new Set([".html", ".css", ".js"]);
const htmlRawBlocks = /<(script|style|pre|textarea)\b[\s\S]*?<\/\1>/gi;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    return fullPath;
  });
}

function minifyHtml(source) {
  const blocks = [];
  const protectedSource = source.replace(htmlRawBlocks, (block) => {
    const index = blocks.push(block) - 1;
    return `%%%WOCATI_HTML_BLOCK_${index}%%%`;
  });

  return protectedSource
    .replace(/<!--(?!\[if|<!|>)[\s\S]*?-->/g, "")
    .replace(/>\s+</g, "><")
    .replace(/^\s+|\s+$/gm, "")
    .replace(/%%%WOCATI_HTML_BLOCK_(\d+)%%%/g, (_match, index) => blocks[Number(index)]);
}

async function minifyFile(filePath) {
  const extension = path.extname(filePath);
  if (!minifyExtensions.has(extension)) return false;

  const source = fs.readFileSync(filePath, "utf8");
  let result = source;

  if (extension === ".html") {
    result = minifyHtml(source);
  } else if (extension === ".css") {
    result = minifyCss(source, { restructure: false }).css;
  } else if (extension === ".js") {
    result = (await transformJs(source, {
      loader: "js",
      minify: true,
      legalComments: "inline",
      sourcemap: false,
    })).code;
  }

  if (result !== source && result.length < source.length) {
    fs.writeFileSync(filePath, result);
    return true;
  }

  return false;
}

async function compressFile(filePath) {
  const extension = path.extname(filePath);
  if (!compressibleExtensions.has(extension)) return false;
  if (filePath.endsWith(".br") || filePath.endsWith(".gz")) return false;

  const input = fs.readFileSync(filePath);
  const [gzipOutput, brotliOutput] = await Promise.all([
    gzip(input, { level: zlib.constants.Z_BEST_COMPRESSION }),
    brotliCompress(input, {
      params: {
        [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: input.length,
      },
    }),
  ]);

  fs.writeFileSync(`${filePath}.gz`, gzipOutput);
  fs.writeFileSync(`${filePath}.br`, brotliOutput);
  return true;
}

if (!fs.existsSync(siteDir)) {
  throw new Error(`Missing build output directory: ${siteDir}`);
}

const files = walk(siteDir);
let minified = 0;
let compressed = 0;

for (const file of files) {
  if (await minifyFile(file)) minified += 1;
}

for (const file of walk(siteDir)) {
  if (await compressFile(file)) compressed += 1;
}

console.log(`Optimized ${minified} files; wrote gzip and Brotli variants for ${compressed} files.`);
