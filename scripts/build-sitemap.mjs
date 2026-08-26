import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { SITE_URL, escapeHtml, loadEditorialSystem } from './lib/guides.mjs'

const DIST_DIR = path.join(process.cwd(), 'dist')

const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/free-picks', priority: '0.8', changefreq: 'daily' },
  { path: '/ai-agents', priority: '0.8', changefreq: 'monthly' },
  { path: '/mcp', priority: '0.8', changefreq: 'monthly' },
  { path: '/mobile-app', priority: '0.7', changefreq: 'monthly' },
  { path: '/privacy-policy', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms-and-conditions', priority: '0.3', changefreq: 'yearly' },
  { path: '/press-kit', priority: '0.5', changefreq: 'monthly' },
]

function xml(value) {
  return escapeHtml(value).replaceAll('&#039;', '&apos;')
}

function rssDate(date) {
  return new Date(`${date}T12:00:00Z`).toUTCString()
}

async function loadSupportUrls() {
  try {
    const support = JSON.parse(await fs.readFile(path.join(DIST_DIR, '.support-urls.json'), 'utf8'))
    return support.map((entry) => ({
      path: entry.path,
      priority: entry.priority || '0.5',
      changefreq: 'monthly',
    }))
  } catch (error) {
    throw new Error(`support URL manifest is required before sitemap generation: ${error.message}`)
  }
}

function sitemapEntry(page) {
  const lastmod = page.lastmod ? `\n    <lastmod>${xml(page.lastmod)}</lastmod>` : ''
  const image = page.image ? `\n    <image:image><image:loc>${xml(`${SITE_URL}${page.image}`)}</image:loc><image:caption>${xml(page.imageCaption)}</image:caption></image:image>` : ''
  return `  <url>\n    <loc>${xml(`${SITE_URL}${page.path}`)}</loc>${lastmod}\n    <changefreq>${page.changefreq}</changefreq>\n    <priority>${page.priority}</priority>${image}\n  </url>`
}

function buildFeed(guides) {
  const latest = [...guides].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  const items = [...guides]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.publishedAt.localeCompare(a.publishedAt))
    .map((guide) => `    <item>
      <title>${xml(guide.title)}</title>
      <link>${xml(`${SITE_URL}${guide.canonicalPath}`)}</link>
      <guid isPermaLink="true">${xml(`${SITE_URL}${guide.canonicalPath}`)}</guid>
      <description>${xml(guide.description)}</description>
      <pubDate>${rssDate(guide.updatedAt)}</pubDate>
      <dc:creator>Chris Habib</dc:creator>
      <category>${xml(guide.category)}</category>
      <media:content url="${xml(`${SITE_URL}${guide.hero.src}`)}" type="image/webp" width="1672" height="941" />
    </item>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>WagerProof Guides</title>
    <link>${SITE_URL}/guides/</link>
    <description>Sourced guides about sports research, odds, models, product updates, and responsible use.</description>
    <language>en-us</language>
    <lastBuildDate>${rssDate(latest.updatedAt)}</lastBuildDate>
    <atom:link href="${SITE_URL}/guides/feed.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`
}

async function main() {
  const { guides } = await loadEditorialSystem()
  const supportPages = await loadSupportUrls()
  const latestEditorialDate = guides.reduce((latest, guide) => guide.updatedAt > latest ? guide.updatedAt : latest, '0000-00-00')
  const editorialPages = [
    { path: '/guides/', lastmod: latestEditorialDate, priority: '0.9', changefreq: 'weekly' },
    { path: '/guides/all/', lastmod: latestEditorialDate, priority: '0.7', changefreq: 'weekly' },
    ...guides.map((guide) => ({
      path: guide.canonicalPath,
      lastmod: guide.updatedAt,
      priority: guide.featured ? '0.8' : '0.7',
      changefreq: guide.nextReviewAt ? 'monthly' : 'yearly',
      image: guide.hero.src,
      imageCaption: guide.hero.alt,
    })),
  ]
  const pages = [...STATIC_PAGES, ...supportPages, ...editorialPages]
  const paths = pages.map((page) => page.path)
  if (new Set(paths).size !== paths.length) throw new Error('duplicate sitemap paths')

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${pages.map(sitemapEntry).join('\n')}
</urlset>\n`
  const feed = `${buildFeed(guides)}\n`
  await fs.mkdir(path.join(DIST_DIR, 'guides'), { recursive: true })
  await Promise.all([
    fs.writeFile(path.join(DIST_DIR, 'sitemap.xml'), sitemap),
    fs.writeFile(path.join(DIST_DIR, 'guides', 'feed.xml'), feed),
  ])
  console.log(`Generated sitemap.xml with ${pages.length} URLs and RSS with ${guides.length} editorial items.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
