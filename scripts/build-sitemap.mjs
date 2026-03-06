import fs from 'fs/promises'
import path from 'path'

const SITE_URL = 'https://wagerproof.bet'

// Static pages with their priorities and change frequencies
const STATIC_PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/blog', priority: '0.8', changefreq: 'daily' },
  { path: '/free-picks', priority: '0.8', changefreq: 'daily' },
  { path: '/ai-agents', priority: '0.8', changefreq: 'weekly' },
  { path: '/mobile-app', priority: '0.7', changefreq: 'monthly' },
  { path: '/privacy-policy', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms-and-conditions', priority: '0.3', changefreq: 'yearly' },
  { path: '/press-kit', priority: '0.5', changefreq: 'monthly' },
]

async function main() {
  const distDir = path.join(process.cwd(), 'dist')
  const today = new Date().toISOString().split('T')[0]

  // Collect all URLs
  const urls = [...STATIC_PAGES]

  // Add blog URLs from pre-built blog pages
  try {
    const blogDir = path.join(distDir, 'blog')
    const entries = await fs.readdir(blogDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        urls.push({ path: `/blog/${entry.name}`, priority: '0.6', changefreq: 'monthly' })
      }
    }
  } catch { /* no blog dir yet */ }

  // Add support URLs from build-support output
  try {
    const supportUrlsPath = path.join(distDir, '.support-urls.json')
    const supportUrls = JSON.parse(await fs.readFile(supportUrlsPath, 'utf8'))
    for (const su of supportUrls) {
      urls.push({ path: su.path, priority: su.priority, changefreq: 'weekly' })
    }
  } catch { /* no support urls yet */ }

  // Generate sitemap XML
  const urlEntries = urls.map(u => `  <url>
    <loc>${SITE_URL}${u.path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n')

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`

  await fs.writeFile(path.join(distDir, 'sitemap.xml'), sitemap, 'utf8')
  console.log(`Generated sitemap.xml with ${urls.length} URLs`)
}

main().catch(err => {
  console.error('Sitemap build failed:', err.message)
  process.exit(1)
})
