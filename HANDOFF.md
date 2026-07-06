---
permalink: false
templateEngineOverride: md
eleventyExcludeFromCollections: true
---

# WOCATI Jekyll → Build Awesome (11ty) Conversion — Handoff

**Goal:** strict/literal port of the Jekyll + Minimal Mistakes site to Build Awesome
(`@awesome.me/buildawesome@4.0.0-alpha.10`), preserving HTML, CSS, permalinks,
JSON-LD / Zotero / metadata.json. Verification target = live www.wocati.org
(mirror in `~/github/wocati-html/www.wocati.org`).

## Build

```bash
npm run build   # npx @awesome.me/buildawesome
npm run dev     # --serve
```

Output: `_site/`. Builds clean (~80 templates written, ~476 files copied).
**Always `rm -rf _site` before judging output** — Eleventy doesn't clean stale files.

## Architecture (what was done)

- **Theme vendored at master `58d9185`** (what live was built from — live's unpinned
  `remote_theme` used master, NOT tag 4.28.0; e.g. `dir="ltr"` moved from body to html).
  Source clone in `.theme-src/` (gitignore it). `_layouts/` + `_includes/` copied in with
  a mechanical rewrite: `page.` → `jpage.` (Eleventy reserves `page`), bare `page` in
  `page__meta.html`/`feature_row`/`gallery`, `include_cached` → `include`,
  `{% include /x %}` → `{% include x %}`. Site's own overrides preserved:
  `_includes/head/custom.html`, `head/zotero.html`, `footer.html`, `footer/custom.html`,
  `header/custom.html`.
- **CSS**: `assets/css/main.css` copied byte-exact from the live mirror (no Sass pipeline
  yet). `assets/js/main.min.js` = theme master build, verified byte-identical to live.
- **Compat layer**:
  - `eleventy.config.js` — LiquidJS `jekyllInclude`, YAML data files, markdown-it with
    `html/xhtmlOut/typographer` + kramdown-style header IDs (`_11ty/lib.js: kramdownSlug`)
    and kramdown list indentation/looseness (`_11ty/kramdown-render.js`),
    `jekyll.environment=production` global (theme gates analytics on it), passthroughs,
    ignores, post-build dotfile cleanup (Jekyll skips dotfiles).
  - `_11ty/lib.js` — psych-compatible date parsing (**no-offset front-matter dates are
    UTC**, verified vs live sitemap), strftime in America/New_York, slugify, static-files
    facade, `safeComputed` wrapper (Eleventy computed-data proxy pass throws on
    String()/Object.entries — every eleventyComputed fn must be wrapped AND touch its
    data deps first; see `_data/eleventyComputed.js` preambles).
  - `_11ty/filters.js` — Jekyll filters: relative/absolute_url (nil passthrough!),
    date_to_xmlschema/rfc822, markdownify, where_exp/group_by/find/sample, jsonify,
    number_of_words, integer `divided_by` (LiquidJS's returns floats), etc.
  - `_data/site.js` + `_data/eleventyComputed.js` — Jekyll `site.*` facade
    (posts newest-first, categories/tags maps, related_posts excluding current page,
    site.collections for lunr store), `jpage` (= Jekyll `page`: url, id w/o trailing
    slash, date only when front-matter has one, excerpt, prev/next, lazy `.content`),
    `paginator` facade. Synthetic collection tags `posts`/`jekyllPages` are stripped
    from facades so rendered tag lists match Jekyll.
  - `_posts/_posts.11tydata.js` — front-matter defaults + `/:categories/:title/`
    permalink computation (note: Eleventy passes `permalink:""` when unset).
  - `_pages/_pages.11tydata.js` — page defaults.
- **Generated outputs** (`_templates/`): `feed.liquid` (jekyll-feed byte format),
  `sitemap.liquid` (jekyll-sitemap: posts asc, pages, .pdf statics),
  `redirect-stubs.liquid` + `redirects-json.11ty.js` (jekyll-redirect-from; data from
  `_data/redirects.js`), `post-metadata.11ty.js` (port of `_plugins/fair_metadata_json.rb`,
  per-post metadata.json, **Zotero-aware**: front-matter `zotero.type:
  blogPost|book|journalArticle|journal|document|report` → schema.org @type, plus
  isbn/issn/volume/issue/pages/doi/publisher), `org-metadata.11ty.js` (root
  metadata.json), `citations.liquid` (/citations.xml), `lunr-store.liquid`,
  `headers.liquid` (**`_site/_headers` with exactly 2 rules**: `/metadata.json` and
  `/*/metadata.json` → `Content-Type: application/ld+json`).
- **Home pagination**: `index.html` front matter paginates `collections.posts`
  reverse size 5 → `/`, `/page2/`–`/page4/`; body untouched.

## Verification harness

`.parity/normalize.py {live|new} <file> <url-path>` normalizes wget link-rewrites and
Cloudflare injections (rocket-loader, beacon, email-protection, `&amp;` re-escaping)
for diffing against the mirror. Sweep:

```bash
cd ~/github/wocati-new && rm -rf _site && npm run build
M=~/github/wocati-html/www.wocati.org
for f in $(cd $M && find . -name "*.html" -not -path "./cdn-cgi/*" | sed 's|^\./||'); do
  url="/$(dirname $f)/"; [ "$url" = "/./" ] && url="/"
  n=$(diff <(python3 .parity/normalize.py live "$M/$f" "$url") \
           <(python3 .parity/normalize.py new "_site/$f" "$url") | grep -c "^[<>]")
  echo "$n $f"
done | sort -rn
```

**Status:** `/` (home), `/about/`, and most post pages diff at or near ZERO.
File manifest matches Jekyll's except intentional additions (`_headers`,
19 per-post metadata.json — live has these too).

## Remaining work (in order)

1. **Verify the last two fixes** (written but the confirming build timed out):
   kramdown per-item loose lists (`_11ty/kramdown-render.js: kramdownLooseLists`) and
   lazy `jpage.content` (read-time was "less than 1 minute" everywhere).
   Then re-run the sweep. Last sweep (BEFORE these fixes):
   archive 628 (loose lists), tags 210, constitution 86, members 48,
   listeners-reports 42, categories 40, books 26, presentation-outlines 17,
   executive 12, presenter-bios 11, communique 8, posts 8, join 7 … 6 pages at 0.
2. **Chase residual page diffs to ~0** (tags/categories archive pages likely share one
   root cause; constitution/members probably markdown edge cases — check `&#10515;`
   entity handling, typographer quotes, table rendering).
3. **Diff non-HTML outputs** vs live: `feed.xml`, per-post `metadata.json` (live copies
   exist in mirror), `citations.xml`, `robots.txt`. Sitemap.xml isn't in the mirror —
   sanity-check structure only (posts asc → pages → PDFs).
4. **Lens features** (https://lens.rknight.me/ — user requirement): present already:
   charset/title/og:*/description/canonical/feed link. **Missing, to add in
   `_includes/head/custom.html`**: `theme-color`, `apple-touch-icon` (asset needed),
   `rel="me"` (user has proven.lol link sitting in the dead `header/custom.html` —
   MM never includes that file; move its content into `head/custom.html`, minus the
   duplicate gtag), optional `fediverse:creator`. NOTE: additions change HTML vs live —
   user explicitly requested them (their checklist item 3).
5. **Zotero**: zotero.html currently emits blogPost for posts. Extend
   `_includes/head/zotero.html` to read `page.zotero.type` and emit matching
   `zotero:itemType` + `citation_*` fields (journal: citation_journal_title/volume/
   issue/pages/issn; book: citation_isbn/publisher). metadata.json side is DONE
   (`_templates/post-metadata.11ty.js`). Keep default = blogPost (no drift).
6. **`/techstack/`**: stale Jekyll build emitted it; my build doesn't (techstack.md has
   no front matter). Check live URL; if absent there, current behavior is correct.
7. **Cleanup (after parity sign-off)**: delete `Gemfile`, `Gemfile.lock`, `_config.yml`
   (KEEP until then — `_data/site.js` reads it! port to JSON first or keep it as data),
   `_plugins/`, `vendor/`, `.bundle/`, root `metadata.json`, `_pages/ciations.xml`;
   swap `.github/workflows` Jekyll deploy for Node (setup-node, `npm ci`, `npm run
   build`, upload `_site`). Add `.theme-src/`, `node_modules/`, `.parity/` to
   `.gitignore`. Update README + footer "Powered by Jekyll" text? — NO, leave footer
   (byte parity) unless user opts in.
8. **Performance pass** (user goal: four 100s in PSI) — separate pass AFTER parity:
   self-host FA subset, preload css, defer gtag, etc. — all opt-in HTML changes.

## Environment notes

- Cowork sandbox has NO network to npm/GitHub — installs/clones must run on the
  user's machine (folder is mounted, so results are visible to the sandbox).
- User exposed a web terminal at http://0.0.0.0:3264/ (Chrome extension was
  disconnected when tried).
- `_config.yml` is still the single source of site config (read by `_data/site.js`).
- The committed-then-deleted stale `_site` was a baseurl-broken CI build — do not
  mourn it; the live mirror + these notes are the reference.
