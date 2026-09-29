# WagerProof editorial design brief

## Product and reader

WagerProof is a sports-research product, not a sportsbook. The editorial system should help a reader understand evidence, uncertainty, and the limits of a tool before asking them to try the product. Its voice is direct, calm, specific, and responsible. It must never imply that a model, agent, or data point guarantees a winning outcome.

## Reference research

The finished Honeydew and Orbital Focus implementations were reviewed in their requested commit order. Honeydew supplied the Git-native content foundation, layout families, title-card discipline, static-only route hardening, and exact-once analytics pattern. Orbital supplied the stronger author treatment, schema composition, image provenance, full-output inspection, and polished reading layout.

Refero's research workflow was selected for this interface task, but its MCP tools were not available in this session. The supplied finished first-party implementations therefore served as the primary pattern corpus, supplemented by current official product, pricing, App Store, responsible-gambling, and search-intent sources. No unverified competitor hands-on claims are permitted.

## Pattern extraction and steal list

| Source pattern | What works | WagerProof adaptation | What not to copy |
| --- | --- | --- | --- |
| Honeydew static guide registry | Content cannot disappear silently | Expected-count registry and exact directory/output parity | Its early dual React/static ownership |
| Honeydew feature layout | Disclosure, at-a-glance table, ranked reviews | Documentation-based sports research comparison with genuine category wins | Arbitrary related-card order |
| Honeydew analytics injection | Every generated page is checked exact-once | Rybbit, Mixpanel, and Meta snippets rendered once in the static shell | Honeydew's Ahrefs key |
| Orbital article header | Human byline, avatar, dates, clear hero | Chris Habib identity, role, reviewed date, test date, reading time | Generic team authorship |
| Orbital cover system | Stable 16:9 files and recorded provenance | 1672 by 941 WebP masters plus 1200 by 630 social crops | Untracked or fallback artwork |
| Orbital static templates | Focused reading column and scoped enhancement script | No React root, page-level scroll, optional search and TOC script only | Assuming a missing content directory is valid |
| Both Read more systems | Visual recirculation after the article | Four explicit image cards from metadata | Separate competing related panels |
| Current WagerProof app | Green/black identity and real product captures | Forest, mint, bone, charcoal, restrained data-grid motifs | Landing-page glass effects inside long-form prose |

## Visual direction

- Palette: forest green, near-black, bone, warm gray, and limited amber for cautions.
- Typography: Inter for body and controls, Playfair Display only for editorial display headings. Body copy is 1rem to 1.075rem with 1.7 line height.
- Reading measure: 45 to 75 characters per line, with a 720px prose column and a sticky table of contents where space permits.
- Imagery: consistent 16:9 title cards. Product interfaces use real screenshots. Comparison products use real self-hosted icons. An AI-assisted abstract probability field may be used as an editorial layer and must be disclosed in its caption.
- Motion: only small hover and disclosure transitions, disabled by `prefers-reduced-motion`. No entrance choreography on article text.
- Responsive behavior: four/two/one related-card columns, horizontally scrollable tables, full-width readable prose, and no fixed-height content containers.

## Hub hierarchy

1. Compact masthead and editorial promise.
2. One flagship feature with a clear visual anchor.
3. Topic navigation and client-side search over pre-rendered rows.
4. Recent updates with dates and layout labels.
5. Curated collections organized by reader job, not by identical cards.
6. A separate complete All Guides index.

## Persuasion layer

The system earns trust before asking for action. A visible ownership disclosure appears in comparison content. Each recommendation names its evidence basis and limitation. Product CTAs describe research workflows rather than outcomes. Dates, sources, corrections contact, author identity, and responsible-gambling help remain visible. Competitors receive a real category win where their public documentation supports one.

## Acceptance notes

Light and dark themes are equally supported. The generated document is useful with JavaScript disabled. Canonical editorial pages have one static owner, one H1, one metadata set, local imagery, visible sources, and four explicit related cards. Unknown editorial routes must return a real 404 before the SPA fallback.

## Interactive tools and companion videos

Two optional `guide.json` fields render outside `content.md`. Both are rendered by `scripts/lib/guide-embeds.mjs`, validated in `validateGuide()`, typed in `src/lib/guides.ts`, and checked by `scripts/verify-guides-build.mjs`. `content.md` still may not contain `<script>`, `<iframe>` or `<style>`.

### `tool`

`"tool": "parlay-calculator"` renders a server-side `<form data-parlay-calculator>` between the article header and the hero, so a search visitor who came for the tool reaches it in the first screen on a phone. Pages with a tool get a `has-tool` body class that tightens the header. The rules:

- The static HTML is the no-JavaScript experience. It shows the correct default example result (-110, -110, +150 at $10: $91.12, +811), computed at build time by the same `src/lib/parlay-math.js` the browser uses. Controls that need JavaScript (add, remove, reset) ship with `hidden` and are revealed by the enhancement.
- Behaviour lives in `src/lib/guides.js` as a data-attribute module (`data-pc-*`) wired with `addEventListener`. No inline handlers, no module scripts. `build-guides.mjs` inlines `parlay-math.js` ahead of `guides.js` as the frozen `WagerProofParlayMath` global, so `/guides/guides-v1.js` stays a single classic script. Keep `parlay-math.js` to dependency-free top-level `export function` / `export const` declarations.
- Math changes need unit tests in `src/lib/parlay-math.test.ts`, and every number quoted in the article must match what the calculator displays, including rounding (money to the cent, American odds to a whole number).
- Every input has a `<label>`, errors render inline and set `aria-invalid`, and results update in an `aria-live="polite"` region. Styles use the guide tokens and must work in both themes at 320 px.
- The verifier checks, for the declaring page only, that the form renders once before the hero and body, that its inputs are labelled, that the default outputs match the math, that JavaScript-only controls are hidden, and that the caveats are present. Tool markup on any other page fails the build.

Add a new tool by adding its name to `SUPPORTED_TOOLS`, `GuideTool` and the corpus type guard, a renderer in `guide-embeds.mjs`, a data-attribute module in `guides.js`, styles in `guides.css`, unit tests, and a verifier function.

### `video`

```json
"video": {
  "youtubeId": "dQw4w9WgXcQ",
  "title": "How to calculate parlay odds",
  "description": "One sentence about the video.",
  "uploadDate": "2026-10-01",
  "duration": "PT4M12S",
  "thumbnail": "/guides/<slug>/<slug>-video-v1.webp"
}
```

`youtubeId` may be empty or absent while the video is in production. Nothing renders and no schema is emitted until it is set. Once set, the page shows a click-to-load facade at the top of the article body: the local 16:9 WebP thumbnail, a play button, and a normal link to `youtube.com/watch?v=ID`. With JavaScript on, clicking swaps in a `youtube-nocookie.com/embed/ID` iframe; the static HTML never contains an iframe and nothing loads from YouTube until the reader asks. A `VideoObject` JSON-LD block is emitted with the video's name, description, thumbnail, upload date, duration, content URL and embed URL. The verifier checks the exact JSON-LD type set of every article, the facade link, and that the thumbnail exists and is 16:9. Record the thumbnail's provenance next to it.
