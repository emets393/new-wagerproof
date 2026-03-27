# Support Center

> Last verified: March 2026

## Overview

Self-serve help center at `/support` with 21 articles across 6 collections. Fully static — no database or auth required. Built as pre-rendered HTML during `npm run build` for SEO, with client-side React for navigation and search.

## Routes

| Route | Page | Component |
|-------|------|-----------|
| `/support` | Home — all collections as cards + search | `SupportCenter.tsx` |
| `/support/:collectionSlug` | Collection — lists articles | `SupportCollection.tsx` |
| `/support/:collectionSlug/:articleSlug` | Article — full content | `SupportArticle.tsx` |

## Collections

| Collection | Articles | Topics |
|-----------|----------|--------|
| `getting-started` | 4 | What is WagerProof, navigation, free vs pro, supported sports |
| `predictions-and-models` | 4 | How predictions work, game cards, betting trends, scoreboard |
| `ai-agents` | 5 | What are agents, creating agents, leaderboard, performance, WagerBot |
| `plans-and-payments` | 4 | Subscribe, cancel, refunds, restore purchase |
| `your-account` | 4 | Account management |
| `troubleshooting` | 4 | App issues, predictions not showing, contact support |

## Content Structure

Articles are JSON files in `src/data/support/en/{collection}/{article}.json`:

```json
{
  "slug": "article-slug",
  "title": "Article Title",
  "description": "Meta description",
  "lastUpdated": "2026-03-01",
  "keywords": ["search", "terms"],
  "content": [
    { "type": "paragraph", "text": "..." },
    { "type": "heading", "level": 2, "text": "..." },
    { "type": "list", "style": "unordered", "items": ["..."] },
    { "type": "callout", "variant": "info|warning|tip", "text": "..." },
    { "type": "steps", "items": [{ "title": "...", "description": "..." }] },
    { "type": "image", "src": "...", "alt": "...", "caption": "..." },
    { "type": "divider" },
    { "type": "video", "src": "iframe-url" },
    { "type": "code", "language": "...", "code": "..." }
  ],
  "relatedArticles": ["other-article-slug"]
}
```

Index file at `src/data/support/en/index.ts` exports `collections[]` and builds `searchIndex[]`.

## Components

| Component | Purpose |
|-----------|---------|
| `SupportLayout.tsx` | Wrapper with header/footer, SEO meta tags, theme support |
| `SupportBreadcrumb.tsx` | Navigation breadcrumb trail |
| `ArticleRenderer.tsx` | Renders content blocks (9 types) to styled HTML |
| `ArticleList.tsx` | Lists articles in a collection |
| `CollectionCard.tsx` | Collection preview card with icon and article count |
| `SupportSearch.tsx` | Client-side search with 200ms debounce, scores by title > description > keywords |
| `ArticleFeedback.tsx` | "Was this helpful?" thumbs up/down, persisted in localStorage |

## Hooks

| Hook | Purpose |
|------|---------|
| `useSupportCollections()` | Async loads all collections |
| `useSupportArticle(collection, article)` | Dynamic import of article JSON |
| `useSupportSearch()` | Full-text client-side search with scoring |

Library functions in `src/lib/support.ts` handle dynamic imports and search index loading.

## Build Process

The `build-support` script runs as part of `npm run build`:

1. Vite builds the React app to `dist/`
2. `build-support.mjs` generates static HTML for all support pages:
   - `dist/support/index.html` (home)
   - `dist/support/{collection}/index.html` (6 collection pages)
   - `dist/support/{collection}/{article}/index.html` (21 article pages)
3. Each page includes inline CSS, theme script, navbar, JSON-LD structured data
4. Outputs `.support-urls.json` for sitemap generation

JSON-LD schemas generated: `Article`, `FAQPage`, `BreadcrumbList`, `CollectionPage`.

## Deployment

Netlify handles routing via `netlify.toml` rewrites:

```
/support        → /support/index.html
/support/:col   → /support/:col/index.html
/support/:col/:article → /support/:col/:article/index.html
```

Cache: `public, max-age=0, s-maxage=300, stale-while-revalidate=600` (5-min CDN, 10-min stale).

## Adding a New Article

1. Create `src/data/support/en/{collection}/{slug}.json` following the schema above
2. Import it in `src/data/support/en/index.ts` and add to the collection's `articles` array
3. Run `npm run build` — the static page is auto-generated
4. Article is immediately searchable client-side via the search index

## Adding a New Collection

1. Create directory `src/data/support/en/{collection}/`
2. Add article JSON files
3. Add collection to `collections[]` in `index.ts` with `slug`, `title`, `description`, `icon`, `order`
4. Supported icons: `BookOpen`, `Brain`, `Bot`, `CreditCard`, `UserCircle`, `LifeBuoy` (mapped in `CollectionCard.tsx`)

## File Map

```
src/
├── pages/support/
│   ├── SupportCenter.tsx        # Home page
│   ├── SupportCollection.tsx    # Collection page
│   └── SupportArticle.tsx       # Article page
├── components/support/          # 7 components (see table above)
├── data/support/en/             # 21 article JSONs + index.ts
├── hooks/
│   ├── useSupportCollections.ts
│   ├── useSupportArticle.ts
│   └── useSupportSearch.ts
├── lib/support.ts               # Load/search utilities
└── types/support.ts             # TypeScript interfaces
scripts/
└── build-support.mjs            # Static HTML generator
```
