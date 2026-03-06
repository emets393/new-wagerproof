import fs from 'fs/promises'
import path from 'path'

const SITE_URL = process.env.SITE_URL || 'https://wagerproof.bet'

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function getThemeScript() {
  return `<script>
(function() {
  var s = localStorage.getItem('theme');
  var d = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (s === 'dark' || (!s && d)) document.documentElement.classList.add('dark');
})();
</script>`
}

function getSupportStyles() {
  return `
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background: linear-gradient(135deg, #fff 0%, #ecfdf5 100%); transition: background 0.3s, color 0.3s; }
html.dark body { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #e5e7eb; }
.navbar { position: fixed; top: 0; left: 0; right: 0; z-index: 50; background: rgba(255,255,255,0.95); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(0,0,0,0.08); transition: background 0.3s; }
html.dark .navbar { background: rgba(15,23,42,0.95); border-bottom-color: #334155; }
.navbar-inner { max-width: 56rem; margin: 0 auto; padding: 0.875rem 1.5rem; display: flex; align-items: center; justify-content: space-between; }
.navbar-logo { display: flex; align-items: center; gap: 0.5rem; text-decoration: none; }
.navbar-logo img { height: 28px; width: auto; }
.navbar-logo span { font-weight: 700; font-size: 1.125rem; background: linear-gradient(135deg, #059669 0%, #047857 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
html.dark .navbar-logo span { background: linear-gradient(135deg, #34d399 0%, #10b981 100%); -webkit-background-clip: text; background-clip: text; }
.navbar-links { display: flex; align-items: center; gap: 1rem; }
.navbar-links a { color: #666; text-decoration: none; font-weight: 500; font-size: 0.875rem; transition: color 0.2s; }
html.dark .navbar-links a { color: #9ca3af; }
.support-container { max-width: 56rem; margin: 0 auto; padding: 5rem 1.5rem 4rem; }
.support-header { text-align: center; margin-bottom: 2.5rem; }
.support-title { font-size: 2rem; font-weight: 700; color: #111; margin-bottom: 0.5rem; }
html.dark .support-title { color: #f1f5f9; }
.support-desc { color: #6b7280; font-size: 1.1rem; }
html.dark .support-desc { color: #94a3b8; }
.collection-grid { display: grid; grid-template-columns: 1fr; gap: 1rem; }
@media (min-width: 640px) { .collection-grid { grid-template-columns: 1fr 1fr; } }
.collection-card { display: block; padding: 1.5rem; background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; text-decoration: none; transition: all 0.2s; }
html.dark .collection-card { background: rgba(30,41,59,0.5); border-color: rgba(51,65,85,0.5); }
.collection-card:hover { border-color: #6ee7b7; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
.collection-card h3 { font-size: 1.1rem; font-weight: 600; color: #111; margin: 0 0 0.25rem; }
html.dark .collection-card h3 { color: #f1f5f9; }
.collection-card p { color: #6b7280; font-size: 0.9rem; margin: 0; }
html.dark .collection-card p { color: #94a3b8; }
.article-card { display: block; padding: 0.875rem 1rem; text-decoration: none; border-bottom: 1px solid #f3f4f6; transition: background 0.2s; }
html.dark .article-card { border-bottom-color: rgba(51,65,85,0.5); }
.article-card:hover { background: rgba(236,253,245,0.5); }
html.dark .article-card:hover { background: rgba(30,41,59,0.5); }
.article-card span { color: #374151; font-size: 0.95rem; }
html.dark .article-card span { color: #cbd5e1; }
.article-content { background: #fff; border: 1px solid #e5e7eb; border-radius: 0.75rem; padding: 2rem; }
html.dark .article-content { background: rgba(30,41,59,0.5); border-color: rgba(51,65,85,0.5); }
.article-content h1 { font-size: 1.75rem; font-weight: 700; color: #111; margin-bottom: 0.5rem; }
html.dark .article-content h1 { color: #f1f5f9; }
.article-content h2 { font-size: 1.25rem; font-weight: 700; color: #111; margin-top: 2rem; margin-bottom: 0.75rem; }
html.dark .article-content h2 { color: #f1f5f9; }
.article-content p { color: #4b5563; margin-bottom: 1rem; line-height: 1.7; }
html.dark .article-content p { color: #cbd5e1; }
.article-content ul, .article-content ol { color: #4b5563; margin-left: 1.5rem; margin-bottom: 1rem; }
html.dark .article-content ul, html.dark .article-content ol { color: #cbd5e1; }
.article-content li { margin-bottom: 0.5rem; }
.callout { display: flex; gap: 0.75rem; padding: 1rem; border-radius: 0.5rem; margin-bottom: 1rem; border: 1px solid; }
.callout-tip { background: #ecfdf5; border-color: #bbf7d0; color: #166534; }
html.dark .callout-tip { background: rgba(16,185,129,0.1); border-color: rgba(16,185,129,0.3); color: #86efac; }
.callout-info { background: #eff6ff; border-color: #bfdbfe; color: #1e40af; }
html.dark .callout-info { background: rgba(59,130,246,0.1); border-color: rgba(59,130,246,0.3); color: #93c5fd; }
.callout-warning { background: #fffbeb; border-color: #fde68a; color: #92400e; }
html.dark .callout-warning { background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.3); color: #fcd34d; }
.step-item { display: flex; gap: 1rem; margin-bottom: 1rem; }
.step-num { flex-shrink: 0; width: 1.75rem; height: 1.75rem; border-radius: 50%; background: #d1fae5; display: flex; align-items: center; justify-content: center; font-size: 0.875rem; font-weight: 600; color: #047857; }
html.dark .step-num { background: rgba(16,185,129,0.2); color: #34d399; }
.step-text strong { color: #111; }
html.dark .step-text strong { color: #f1f5f9; }
.step-text p { color: #6b7280; font-size: 0.9rem; margin: 0; }
html.dark .step-text p { color: #94a3b8; }
.breadcrumb { margin-bottom: 1.5rem; font-size: 0.875rem; color: #6b7280; }
html.dark .breadcrumb { color: #94a3b8; }
.breadcrumb a { color: #6b7280; text-decoration: none; }
html.dark .breadcrumb a { color: #94a3b8; }
.breadcrumb a:hover { color: #059669; }
html.dark .breadcrumb a:hover { color: #34d399; }
.meta-date { font-size: 0.875rem; color: #9ca3af; margin-bottom: 1.5rem; }
footer { background: #f9fafb; padding: 2rem 1.5rem; text-align: center; border-top: 1px solid #e5e7eb; margin-top: 4rem; }
html.dark footer { background: #0f172a; border-top-color: #334155; }
footer p { color: #666; font-size: 0.875rem; }
html.dark footer p { color: #94a3b8; }
footer a { color: #059669; text-decoration: none; }
html.dark footer a { color: #34d399; }
.related-articles { margin-top: 2.5rem; padding-top: 1.5rem; border-top: 1px solid #e5e7eb; }
html.dark .related-articles { border-top-color: rgba(51,65,85,0.5); }
.related-articles h2 { font-size: 0.875rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.75rem; }
.related-articles-list { display: flex; flex-direction: column; gap: 0.5rem; }
.related-article-link { display: flex; align-items: center; gap: 0.5rem; padding: 0.625rem 0.875rem; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.5rem; text-decoration: none; color: #374151; transition: all 0.2s; }
html.dark .related-article-link { background: rgba(30,41,59,0.3); border-color: rgba(51,65,85,0.5); color: #cbd5e1; }
.related-article-link:hover { border-color: #6ee7b7; background: #ecfdf5; color: #059669; }
html.dark .related-article-link:hover { border-color: rgba(16,185,129,0.5); background: rgba(16,185,129,0.1); color: #34d399; }
body.react-loaded .ssg-content { display: none; }
`
}

function getNavbar() {
  return `<nav class="navbar">
  <div class="navbar-inner">
    <a href="/" class="navbar-logo">
      <img src="/wagerproofGreenDark.png" alt="WagerProof" width="28" height="28" />
      <span>WagerProof</span>
    </a>
    <div class="navbar-links">
      <a href="/">Home</a>
      <a href="/blog">Blog</a>
      <a href="/support">Support</a>
    </div>
  </div>
</nav>`
}

function getFooter() {
  return `<footer>
  <p>&copy; ${new Date().getFullYear()} WagerProof. All rights reserved.</p>
  <p style="margin-top:0.5rem;">
    <a href="/privacy-policy">Privacy Policy</a> &middot;
    <a href="/terms-and-conditions">Terms of Service</a> &middot;
    <a href="/support">Support</a>
  </p>
</footer>`
}

async function readArticleJson(dataDir, collectionSlug, articleSlug) {
  const filePath = path.join(dataDir, 'en', collectionSlug, `${articleSlug}.json`)
  try {
    const content = await fs.readFile(filePath, 'utf8')
    return JSON.parse(content)
  } catch {
    return null
  }
}

function renderContentBlocksHtml(content) {
  return content.map(block => {
    switch (block.type) {
      case 'paragraph':
        return `<p>${escapeHtml(block.text)}</p>`
      case 'heading':
        return `<h${block.level || 2}>${escapeHtml(block.text)}</h${block.level || 2}>`
      case 'list': {
        const tag = block.ordered ? 'ol' : 'ul'
        const items = (block.items || []).map(i => `<li>${escapeHtml(i)}</li>`).join('\n')
        return `<${tag}>${items}</${tag}>`
      }
      case 'callout':
        return `<div class="callout callout-${block.variant || 'info'}"><p>${escapeHtml(block.text)}</p></div>`
      case 'steps':
        return (block.steps || []).map((s, i) =>
          `<div class="step-item"><div class="step-num">${i + 1}</div><div class="step-text"><strong>${escapeHtml(s.title)}</strong><p>${escapeHtml(s.description)}</p></div></div>`
        ).join('\n')
      case 'divider':
        return '<hr style="margin: 2rem 0; border-color: #e5e7eb;" />'
      default:
        return ''
    }
  }).join('\n')
}

function buildFAQSchema(article) {
  const content = article.content || []
  const faqEntries = []

  if (article.title && article.description) {
    faqEntries.push({
      '@type': 'Question',
      name: article.title.replace(/^How to /i, 'How do I '),
      acceptedAnswer: { '@type': 'Answer', text: article.description }
    })
  }

  for (let i = 0; i < content.length; i++) {
    if (content[i].type === 'heading' && content[i].text) {
      let answerParts = []
      for (let j = i + 1; j < content.length; j++) {
        if (content[j].type === 'heading') break
        if (content[j].type === 'paragraph') answerParts.push(content[j].text)
        if (content[j].type === 'steps') answerParts.push((content[j].steps || []).map((s, idx) => `${idx+1}. ${s.title}: ${s.description}`).join(' '))
        if (content[j].type === 'list') answerParts.push((content[j].items || []).join('. '))
        if (content[j].type === 'callout') answerParts.push(content[j].text)
      }
      if (answerParts.length > 0) {
        faqEntries.push({
          '@type': 'Question',
          name: content[i].text,
          acceptedAnswer: { '@type': 'Answer', text: answerParts.join(' ') }
        })
      }
    }
  }

  if (faqEntries.length < 2) return null
  return { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqEntries }
}

function renderPage({ title, description, canonicalUrl, bodyHtml, jsonLd = [], cssBundlePath }) {
  const jsonLdScripts = jsonLd.map(ld =>
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`
  ).join('\n')

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<link rel="icon" type="image/png" href="/wagerproofGreenDark.png" />
<meta name="ssg-generated" content="true" data-build-time="${new Date().toISOString()}" />
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeHtml(description)}" />
<link rel="canonical" href="${canonicalUrl}" />
<meta name="robots" content="index, follow" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${canonicalUrl}" />
<meta property="og:title" content="${escapeHtml(title)}" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="${SITE_URL}/wagerproof-landing.png" />
<meta property="og:site_name" content="WagerProof" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:title" content="${escapeHtml(title)}" />
<meta name="twitter:description" content="${escapeHtml(description)}" />
<meta name="twitter:image" content="${SITE_URL}/wagerproof-landing.png" />
<meta name="twitter:site" content="@wagerproof" />
${jsonLdScripts}
${cssBundlePath ? `<link rel="stylesheet" href="${cssBundlePath}" />` : ''}
${getThemeScript()}
<style>${getSupportStyles()}</style>
</head>
<body>
<div class="ssg-content">
${getNavbar()}
<main class="support-container">
${bodyHtml}
</main>
${getFooter()}
</div>
<div id="root"></div>
<script type="module" src="/src/main.tsx"></script>
<script>
var observer = new MutationObserver(function() {
  if (document.getElementById('root') && document.getElementById('root').children.length > 0) {
    document.body.classList.add('react-loaded');
    observer.disconnect();
  }
});
observer.observe(document.getElementById('root'), { childList: true });
</script>
</body>
</html>`
}

const COLLECTIONS = [
  { slug: 'getting-started', title: 'Getting Started', description: 'Learn the basics of WagerProof and how to get set up', articles: ['what-is-wagerproof', 'free-vs-pro', 'supported-sports', 'navigating-the-app'] },
  { slug: 'predictions-and-models', title: 'Predictions & Models', description: 'Understand how our ML models generate predictions and how to read them', articles: ['how-predictions-work', 'reading-game-cards', 'betting-trends-explained', 'live-scoreboard'] },
  { slug: 'ai-agents', title: 'AI Agents & WagerBot', description: 'Create personalized virtual picks experts and use our AI assistant', articles: ['what-are-ai-agents', 'creating-an-agent', 'agent-performance-tracking', 'agent-leaderboard', 'using-wagerbot'] },
  { slug: 'plans-and-payments', title: 'Plans & Payments', description: 'Subscriptions, billing, and refund information', articles: ['how-to-subscribe', 'how-to-cancel', 'refund-request', 'restore-purchase'] },
  { slug: 'your-account', title: 'Your Account', description: 'Manage your login, password, and profile settings', articles: ['creating-an-account', 'forgot-password', 'delete-account', 'managing-notifications'] },
  { slug: 'troubleshooting', title: 'Troubleshooting', description: 'Quick solutions to common problems', articles: ['contact-support', 'app-not-loading', 'report-a-bug', 'predictions-not-showing'] },
]

async function findViteBundles(distDir) {
  const indexHtml = await fs.readFile(path.join(distDir, 'index.html'), 'utf8')
  const jsMatch = indexHtml.match(/src="(\/assets\/index-[^"]+\.js)"/)
  const cssMatch = indexHtml.match(/href="(\/assets\/index-[^"]+\.css)"/)
  return { js: jsMatch ? jsMatch[1] : null, css: cssMatch ? cssMatch[1] : null }
}

async function writeHtml(html, outPath, jsBundlePath) {
  if (jsBundlePath) {
    html = html.replace(
      '<script type="module" src="/src/main.tsx"></script>',
      `<script type="module" src="${jsBundlePath}"></script>`
    )
  }
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, html, 'utf8')
}

async function main() {
  const distDir = path.join(process.cwd(), 'dist')
  const dataDir = path.join(process.cwd(), 'src', 'data', 'support')

  try { await fs.access(distDir) } catch {
    throw new Error(`dist directory not found. Run 'vite build' first.`)
  }

  const bundles = await findViteBundles(distDir)
  if (bundles.css) console.log(`Found CSS bundle: ${bundles.css}`)
  if (bundles.js) console.log(`Found JS bundle: ${bundles.js}`)

  const supportUrls = []
  let pageCount = 0

  // Load all article metadata
  const articleMetas = {}
  for (const col of COLLECTIONS) {
    for (const slug of col.articles) {
      const article = await readArticleJson(dataDir, col.slug, slug)
      if (article) articleMetas[slug] = article
    }
  }

  // Generate homepage
  const collectionCards = COLLECTIONS.map(col => {
    return `<a href="/support/${col.slug}" class="collection-card">
      <h3>${escapeHtml(col.title)}</h3>
      <p>${escapeHtml(col.description)}</p>
      <p style="font-size:0.8rem;color:#9ca3af;margin-top:0.5rem;">${col.articles.length} articles</p>
    </a>`
  }).join('\n')

  const homeHtml = renderPage({
    title: 'Support Center - WagerProof',
    description: 'Get help with WagerProof. Find answers about predictions, AI Agents, subscriptions, and more.',
    canonicalUrl: `${SITE_URL}/support`,
    cssBundlePath: bundles.css,
    jsonLd: [{
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'WagerProof Support Center',
      description: 'Get help with WagerProof sports betting analytics platform.',
      url: `${SITE_URL}/support`,
      publisher: { '@type': 'Organization', name: 'WagerProof' }
    }],
    bodyHtml: `
  <div class="support-header">
    <h1 class="support-title">Support Center</h1>
    <p class="support-desc">How can we help you today?</p>
  </div>
  <div class="collection-grid">${collectionCards}</div>`
  })

  await writeHtml(homeHtml, path.join(distDir, 'support', 'index.html'), bundles.js)
  supportUrls.push({ path: '/support', priority: '0.8' })
  pageCount++

  // Generate collection pages
  for (const col of COLLECTIONS) {
    const articleLinks = col.articles.map(slug => {
      const meta = articleMetas[slug]
      const title = meta?.title || slug.replace(/-/g, ' ')
      return `<a href="/support/${col.slug}/${slug}" class="article-card"><span>${escapeHtml(title)}</span></a>`
    }).join('\n')

    const colHtml = renderPage({
      title: `${col.title} - WagerProof Support`,
      description: col.description,
      canonicalUrl: `${SITE_URL}/support/${col.slug}`,
      cssBundlePath: bundles.css,
      jsonLd: [{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Support', item: `${SITE_URL}/support` },
          { '@type': 'ListItem', position: 2, name: col.title }
        ]
      }],
      bodyHtml: `
  <div class="breadcrumb">
    <a href="/support">Support Center</a> &rsaquo; <span>${escapeHtml(col.title)}</span>
  </div>
  <h1 class="support-title" style="text-align:left;margin-bottom:0.25rem;">${escapeHtml(col.title)}</h1>
  <p class="support-desc" style="text-align:left;margin-bottom:1.5rem;">${escapeHtml(col.description)}</p>
  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:0.75rem;padding:1.5rem;">
    ${articleLinks}
  </div>`
    })

    await writeHtml(colHtml, path.join(distDir, 'support', col.slug, 'index.html'), bundles.js)
    supportUrls.push({ path: `/support/${col.slug}`, priority: '0.7' })
    pageCount++

    // Generate article pages
    for (const slug of col.articles) {
      const article = articleMetas[slug]
      if (!article) {
        console.warn(`Missing article: ${col.slug}/${slug}`)
        continue
      }

      const contentHtml = renderContentBlocksHtml(article.content || [])
      const jsonLd = [
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: article.title,
          description: article.description,
          dateModified: article.lastUpdated,
          mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE_URL}/support/${col.slug}/${slug}` },
          publisher: { '@type': 'Organization', name: 'WagerProof' }
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Support', item: `${SITE_URL}/support` },
            { '@type': 'ListItem', position: 2, name: col.title, item: `${SITE_URL}/support/${col.slug}` },
            { '@type': 'ListItem', position: 3, name: article.title }
          ]
        }
      ]

      const faqSchema = buildFAQSchema(article)
      if (faqSchema) jsonLd.push(faqSchema)

      // Build related articles HTML
      let relatedHtml = ''
      if (article.relatedArticles && article.relatedArticles.length > 0) {
        const relLinks = article.relatedArticles.map(relSlug => {
          const meta = articleMetas[relSlug]
          const relTitle = meta?.title || relSlug.replace(/-/g, ' ')
          const relCol = COLLECTIONS.find(c => c.articles.includes(relSlug))
          const colSlug = relCol ? relCol.slug : col.slug
          return `<a href="/support/${colSlug}/${relSlug}" class="related-article-link">${escapeHtml(relTitle)}</a>`
        }).join('\n        ')
        relatedHtml = `
    <div class="related-articles">
      <h2>Related Articles</h2>
      <div class="related-articles-list">
        ${relLinks}
      </div>
    </div>`
      }

      const artHtml = renderPage({
        title: `${article.title} - WagerProof Support`,
        description: article.description,
        canonicalUrl: `${SITE_URL}/support/${col.slug}/${slug}`,
        cssBundlePath: bundles.css,
        jsonLd,
        bodyHtml: `
  <div class="breadcrumb">
    <a href="/support">Support Center</a> &rsaquo;
    <a href="/support/${col.slug}">${escapeHtml(col.title)}</a> &rsaquo;
    <span>${escapeHtml(article.title)}</span>
  </div>
  <div class="article-content">
    <h1>${escapeHtml(article.title)}</h1>
    <p class="meta-date">Last updated: ${article.lastUpdated}</p>
    ${contentHtml}
    ${relatedHtml}
  </div>`
      })

      await writeHtml(artHtml, path.join(distDir, 'support', col.slug, slug, 'index.html'), bundles.js)
      supportUrls.push({ path: `/support/${col.slug}/${slug}`, priority: '0.6' })
      pageCount++
    }
  }

  // Write support URLs for sitemap integration
  await fs.writeFile(
    path.join(distDir, '.support-urls.json'),
    JSON.stringify(supportUrls, null, 2),
    'utf8'
  )

  console.log(`Generated ${pageCount} support pages`)
  console.log(`Wrote ${supportUrls.length} support URLs to .support-urls.json`)
}

main().catch(err => {
  console.error('Support build failed:', err.message)
  process.exit(1)
})
