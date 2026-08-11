# WOCATI

Static archive for the World Conference of Associated Theological Institutions, built with Eleventy and deployed to GitHub Pages.

## Development

Requires Node.js 22.

```sh
npm ci
npm run dev
```

## Production build

```sh
npm run build
```

The generated site is written to `_site/`. Source pages and posts live in `src/_pages/` and `src/_posts/`; archival downloads live in `src/assets/`.
