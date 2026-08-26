# WagerProof Guides source

This directory is the production editorial source of truth. A live Ghost connection is not part of the build.

Each published folder must contain:

- `guide.json`: layout, route, dates, author, hero, related routes, FAQs, and layout-specific data.
- `content.md`: original visible article content.
- `research.md`: internal research notes and claim boundaries.
- `sources.json`: visible, first-party or primary sources with access dates.

The flagship comparison additionally contains `distribution.md` and `monthly-review.md`.

`registry.json` is fail-closed. Its `expectedCount`, entry set, content folders, generated routes, sitemap entries, and feed items must match exactly. Canonical paths can stay under `/blog/` when preserving a valuable legacy URL; the renderer is identical and remains static-only.

Every article must name exactly four related slugs. Covers are versioned 1672 by 941 WebP files with 1200 by 630 social crops. Product interfaces and app icons must be real, self-hosted assets with provenance recorded under `public/guides/`.

Build order:

1. `npm run check:editorial-style`
2. `npm run typecheck:guides`
3. Vite and fail-closed prerender
4. Support generation
5. Static Guides generation
6. Sitemap and feed generation
7. Full generated-output verification

Do not add a React Router owner for an editorial canonical. Static HTML in `dist/<canonicalPath>/index.html` is the only owner.
