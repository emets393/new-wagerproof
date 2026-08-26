import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { SITE_URL, ROOT, absoluteUrl, escapeHtml, loadEditorialSystem } from './lib/guides.mjs'

const DIST = path.join(ROOT, 'dist')
const failures = []

function fail(message) {
  failures.push(message)
}

function count(text, pattern) {
  return [...text.matchAll(pattern)].length
}

function assertCount(text, pattern, expected, context) {
  const actual = count(text, pattern)
  if (actual !== expected) fail(`${context}: expected ${expected} match(es) for ${pattern}, found ${actual}`)
}

function getAttributeTag(html, attribute, value) {
  const tags = html.match(/<meta\b[^>]*>/gi) || []
  return tags.filter((tag) => new RegExp(`\\b${attribute}=["']${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(tag))
}

function getTagAttribute(tag, attribute) {
  const match = new RegExp(`\\b${attribute}=["']([^"']*)["']`, 'i').exec(tag)
  return match?.[1] ?? null
}

function jsonLdBlocks(html, context) {
  const blocks = []
  for (const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      blocks.push(JSON.parse(match[1]))
    } catch (error) {
      fail(`${context}: invalid JSON-LD: ${error.message}`)
    }
  }
  return blocks
}

function flattenSchemas(value, output = []) {
  if (Array.isArray(value)) {
    for (const item of value) flattenSchemas(item, output)
  } else if (value && typeof value === 'object') {
    if (value['@type']) output.push(value)
    if (Array.isArray(value['@graph'])) flattenSchemas(value['@graph'], output)
  }
  return output
}

function routeFile(route) {
  return path.join(DIST, route.replace(/^\//, ''), 'index.html')
}

async function exists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function editorialHtmlRoutes() {
  const routes = []
  async function walk(directory) {
    if (!await exists(directory)) return
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const filePath = path.join(directory, entry.name)
      if (entry.isDirectory()) await walk(filePath)
      else if (entry.isFile() && entry.name === 'index.html') {
        const relative = path.relative(DIST, filePath).split(path.sep).join('/')
        routes.push(`/${relative.replace(/index\.html$/, '')}`)
      }
    }
  }
  await walk(path.join(DIST, 'guides'))
  await walk(path.join(DIST, 'blog'))
  return routes.sort()
}

function imageDimensions(buffer) {
  if (buffer.length >= 24 && buffer.subarray(1, 4).toString() === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) }
  }
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    let offset = 12
    while (offset + 8 <= buffer.length) {
      const chunk = buffer.toString('ascii', offset, offset + 4)
      const size = buffer.readUInt32LE(offset + 4)
      const data = offset + 8
      if (chunk === 'VP8X' && data + 10 <= buffer.length) {
        const width = 1 + buffer[data + 4] + (buffer[data + 5] << 8) + (buffer[data + 6] << 16)
        const height = 1 + buffer[data + 7] + (buffer[data + 8] << 8) + (buffer[data + 9] << 16)
        return { width, height }
      }
      if (chunk === 'VP8 ' && data + 10 <= buffer.length) {
        const marker = buffer.indexOf(Buffer.from([0x9d, 0x01, 0x2a]), data)
        if (marker >= data && marker + 7 <= data + size) {
          return { width: buffer.readUInt16LE(marker + 3) & 0x3fff, height: buffer.readUInt16LE(marker + 5) & 0x3fff }
        }
      }
      if (chunk === 'VP8L' && data + 5 <= buffer.length && buffer[data] === 0x2f) {
        const bits = buffer.readUInt32LE(data + 1)
        return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
      }
      offset = data + size + (size % 2)
    }
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue }
      const marker = buffer[offset + 1]
      const length = buffer.readUInt16BE(offset + 2)
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) }
      }
      if (!length) break
      offset += 2 + length
    }
  }
  throw new Error('unsupported image format')
}

async function verifyImage(relativePath, width, height, context) {
  const filePath = path.join(DIST, relativePath.replace(/^\//, ''))
  if (!await exists(filePath)) {
    fail(`${context}: missing image ${relativePath}`)
    return
  }
  try {
    const dimensions = imageDimensions(await fs.readFile(filePath))
    if (dimensions.width !== width || dimensions.height !== height) {
      fail(`${context}: ${relativePath} is ${dimensions.width}x${dimensions.height}, expected ${width}x${height}`)
    }
  } catch (error) {
    fail(`${context}: cannot inspect ${relativePath}: ${error.message}`)
  }
}

function verifyExactMeta(html, attribute, name, expectedContent, context) {
  const tags = getAttributeTag(html, attribute, name)
  if (tags.length !== 1) {
    fail(`${context}: expected exactly one ${attribute}=${name}, found ${tags.length}`)
    return
  }
  if (getTagAttribute(tags[0], 'content') !== expectedContent) {
    fail(`${context}: ${name} content mismatch`)
  }
}

function verifyAnalytics(html, context) {
  assertCount(html, /https:\/\/app\.rybbit\.io\/api\/script\.js/g, 1, context)
  assertCount(html, /data-site-id="e8e280617e67"/g, 1, context)
  assertCount(html, /mixpanel\.init\('1346df53bbd034722047aa8a96d5321e'/g, 1, context)
  assertCount(html, /https:\/\/connect\.facebook\.net\/en_US\/fbevents\.js/g, 1, context)
  assertCount(html, /fbq\('init','1731090704521232'\)/g, 1, context)
  assertCount(html, /facebook\.com\/tr\?id=1731090704521232&amp;ev=PageView&amp;noscript=1/g, 1, context)
  const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((match) => match[1])
  for (const attributes of scripts) {
    const allowed = attributes.includes('type="application/ld+json"')
      || attributes.includes('data-editorial-script="theme"')
      || attributes.includes('data-editorial-script="mixpanel"')
      || attributes.includes('data-editorial-script="meta-pixel"')
      || attributes.includes('data-editorial-script="guides"')
      || attributes.includes('src="https://app.rybbit.io/api/script.js"')
    if (!allowed) fail(`${context}: unexpected executable script attributes: ${attributes.trim()}`)
  }
}

function verifyNoStaticOwnershipConflicts(html, context) {
  const forbidden = [
    ['React root', /id=["']root["']/i],
    ['source entry module', /\/src\/main\.tsx/i],
    ['SPA module', /<script\b[^>]*type=["']module["']/i],
    ['Ghost domain', /wagerproof\.ghost\.io/i],
    ['Ghost image host', /storage\.ghost\.io/i],
    ['automation image host', /assets\.seobotai\.com/i],
    ['hidden SEO block', /seo-only/i],
    ['unsafe iframe', /<iframe\b/i],
    ['unsafe event handler', /\son(?:error|load|click)=/i],
    ['javascript URL', /javascript:/i],
    ['literal Markdown heading', /(?:^|>)\s*#{1,6}\s+\w/m],
    ['literal Markdown link', /\[[^\]]+\]\([^\)]+\)/],
  ]
  for (const [label, pattern] of forbidden) {
    if (pattern.test(html)) fail(`${context}: contains ${label}`)
  }
}

function verifyCommonDocument(html, page, context) {
  assertCount(html, /<title>[^<]+<\/title>/g, 1, context)
  if (!html.includes(`<title>${escapeHtml(page.title)}</title>`)) fail(`${context}: title mismatch`)
  verifyExactMeta(html, 'name', 'description', page.description, context)
  verifyExactMeta(html, 'name', 'robots', page.robots || 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1', context)
  const canonicalTags = (html.match(/<link\b[^>]*rel="canonical"[^>]*>/g) || [])
  if (canonicalTags.length !== 1 || getTagAttribute(canonicalTags[0], 'href') !== absoluteUrl(page.canonicalPath)) {
    fail(`${context}: canonical missing, duplicated, or incorrect`)
  }
  assertCount(html, /<h1\b/g, 1, context)
  verifyExactMeta(html, 'property', 'og:title', page.title, context)
  verifyExactMeta(html, 'property', 'og:description', page.description, context)
  verifyExactMeta(html, 'property', 'og:url', absoluteUrl(page.canonicalPath), context)
  verifyExactMeta(html, 'property', 'og:type', page.type, context)
  verifyExactMeta(html, 'property', 'og:image', absoluteUrl(page.image), context)
  verifyExactMeta(html, 'name', 'twitter:card', 'summary_large_image', context)
  verifyExactMeta(html, 'name', 'twitter:title', page.title, context)
  verifyExactMeta(html, 'name', 'twitter:description', page.description, context)
  verifyExactMeta(html, 'name', 'twitter:url', absoluteUrl(page.canonicalPath), context)
  verifyExactMeta(html, 'name', 'twitter:image', absoluteUrl(page.image), context)
  assertCount(html, /rel="alternate" type="application\/rss\+xml"/g, 1, context)
  verifyAnalytics(html, context)
  verifyNoStaticOwnershipConflicts(html, context)
}

function verifyArticleSchemas(html, guide, context) {
  const blocks = jsonLdBlocks(html, context)
  const schemas = flattenSchemas(blocks)
  const types = schemas.map((schema) => schema['@type'])
  const articleType = guide.layout === 'release' ? 'BlogPosting' : 'Article'
  if (types.filter((type) => type === articleType).length !== 1) fail(`${context}: expected one ${articleType} schema`)
  if (types.filter((type) => type === 'Person').length !== 1) fail(`${context}: expected one Person schema`)
  if (types.filter((type) => type === 'BreadcrumbList').length !== 1) fail(`${context}: expected one BreadcrumbList schema`)
  const article = schemas.find((schema) => schema['@type'] === articleType)
  if (article) {
    if (article.headline !== guide.title || article.description !== guide.description) fail(`${context}: Article text mismatch`)
    if (article.datePublished !== guide.publishedAt || article.dateModified !== guide.updatedAt) fail(`${context}: Article dates mismatch`)
    if (article.mainEntityOfPage?.['@id'] !== absoluteUrl(guide.canonicalPath)) fail(`${context}: Article canonical mismatch`)
    if (article.author?.['@id'] !== `${SITE_URL}/guides/#chris-habib`) fail(`${context}: Article author identity mismatch`)
    if (article.publisher?.legalName !== 'WagerProof, LLC') fail(`${context}: publisher legal identity missing`)
  }
  const person = schemas.find((schema) => schema['@type'] === 'Person')
  if (person) {
    if (person['@context'] !== 'https://schema.org') fail(`${context}: Person schema.org context missing`)
    for (const key of ['name', 'jobTitle', 'url', 'image', 'knowsAbout', 'worksFor']) {
      if (!person[key]) fail(`${context}: Person missing ${key}`)
    }
    if (person.name !== 'Chris Habib' || person.worksFor?.name !== 'Red Honey') fail(`${context}: Person identity mismatch`)
  }
  const breadcrumb = schemas.find((schema) => schema['@type'] === 'BreadcrumbList')
  if (breadcrumb?.itemListElement?.at(-1)?.item !== absoluteUrl(guide.canonicalPath)) fail(`${context}: breadcrumb canonical mismatch`)

  if (guide.layout === 'feature') {
    const itemList = schemas.find((schema) => schema['@type'] === 'ItemList')
    if (!itemList || itemList.itemListElement?.length !== guide.apps.length) fail(`${context}: ranked ItemList missing or wrong size`)
    else guide.apps.forEach((app, index) => {
      const item = itemList.itemListElement[index]
      if (item.position !== app.rank || item.name !== app.name || item.url !== app.officialUrl) fail(`${context}: ranked ItemList mismatch for ${app.name}`)
    })
  }
  if (guide.faqs?.length) {
    const faq = schemas.find((schema) => schema['@type'] === 'FAQPage')
    if (!faq || faq.mainEntity?.length !== guide.faqs.length) fail(`${context}: FAQ schema missing or wrong size`)
    else guide.faqs.forEach((entry, index) => {
      const schemaEntry = faq.mainEntity[index]
      if (schemaEntry.name !== entry.question || schemaEntry.acceptedAnswer?.text !== entry.answer) fail(`${context}: FAQ schema mismatch at ${index + 1}`)
      if (!html.includes(`<summary>${escapeHtml(entry.question)}<span`) || !html.includes(`<p data-faq-answer>${escapeHtml(entry.answer)}</p>`)) fail(`${context}: FAQ visible text mismatch at ${index + 1}`)
    })
  }
  if (guide.howTo) {
    const howTo = schemas.find((schema) => schema['@type'] === 'HowTo')
    if (!howTo || howTo.step?.length !== guide.howTo.steps.length) fail(`${context}: HowTo schema missing or wrong size`)
    else guide.howTo.steps.forEach((step, index) => {
      const schemaStep = howTo.step[index]
      if (schemaStep.position !== index + 1 || schemaStep.name !== step.name || schemaStep.text !== step.text) fail(`${context}: HowTo schema mismatch at ${index + 1}`)
      if (!html.includes(`<h3>${escapeHtml(step.name)}</h3><p>${escapeHtml(step.text)}</p>`)) fail(`${context}: HowTo visible text mismatch at ${index + 1}`)
    })
  }
}

async function verifyArticleOutput(guide, guideMap, html) {
  const context = guide.canonicalPath
  verifyCommonDocument(html, {
    title: `${guide.seoTitle} | WagerProof`,
    description: guide.description,
    canonicalPath: guide.canonicalPath,
    image: guide.hero.socialSrc,
    type: 'article',
  }, context)
  if (!html.includes(`<h1>${escapeHtml(guide.title)}</h1>`)) fail(`${context}: visible H1 text mismatch`)
  if (!html.includes('Founder and product lead at WagerProof')) fail(`${context}: author role missing`)
  if (!html.includes('/guides/authors/chris-habib-v1.webp')) fail(`${context}: author avatar missing`)
  for (const date of [guide.updatedAt, guide.reviewedAt]) {
    if (!html.includes(date)) fail(`${context}: visible date ${date} missing`)
  }
  const heroPattern = new RegExp(`<img src="${guide.hero.src.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}" width="1672" height="941" alt="${escapeHtml(guide.hero.alt).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`)
  if (!heroPattern.test(html)) fail(`${context}: complete hero markup missing`)
  await verifyImage(guide.hero.src, 1672, 941, context)
  await verifyImage(guide.hero.socialSrc, 1200, 630, context)
  if (!html.includes(escapeHtml(guide.hero.caption)) || !html.includes(escapeHtml(guide.hero.source))) fail(`${context}: visible hero caption/source missing`)
  const readMoreMatch = /<section class="read-more[\s\S]*?<div class="read-more__grid">([\s\S]*?)<\/div><\/section>/.exec(html)
  if (!readMoreMatch) fail(`${context}: Read more section missing`)
  else {
    assertCount(readMoreMatch[1], /class="guide-card /g, 4, `${context} Read more`)
    for (const slug of guide.relatedSlugs) {
      const related = guideMap.get(slug)
      if (!readMoreMatch[1].includes(`href="${related.canonicalPath}"`) || !readMoreMatch[1].includes(`src="${related.hero.src}"`)) fail(`${context}: related card ${slug} missing or not image-based`)
    }
  }
  if (guide.layout === 'feature') {
    for (const app of guide.apps) {
      if (!html.includes(`data-app-name="${escapeHtml(app.name)}"`)) fail(`${context}: ranked app review missing for ${app.name}`)
      if (count(html, new RegExp(app.icon.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) < 2) fail(`${context}: app icon not used in table and review for ${app.name}`)
      const iconFile = path.join(DIST, app.icon.replace(/^\//, ''))
      if (!await exists(iconFile)) fail(`${context}: missing app icon file ${app.icon}`)
    }
    assertCount(html, /data-app-name=/g, guide.apps.length, `${context} ranked reviews`)
    if (!html.toLowerCase().includes('documentation-based')) fail(`${context}: documentation-based limitation missing`)
  }
  if (guide.layout === 'release') {
    if (!html.includes(guide.release.version) || !html.includes(guide.release.releaseDate)) fail(`${context}: release version/date missing`)
    for (const shot of guide.release.screenshots) {
      if (!html.includes(`src="${shot.src}"`) || !html.includes(escapeHtml(shot.caption))) fail(`${context}: release screenshot missing ${shot.src}`)
      await verifyImage(shot.src, shot.width, shot.height, context)
    }
  }
  verifyArticleSchemas(html, guide, context)
}

async function verifyHub(route, title, description, image, guides) {
  const html = await fs.readFile(routeFile(route), 'utf8')
  const context = route
  verifyCommonDocument(html, { title, description, canonicalPath: route, image, type: 'website' }, context)
  const schemas = flattenSchemas(jsonLdBlocks(html, context))
  if (schemas.filter((schema) => schema['@type'] === 'CollectionPage').length !== 1) fail(`${context}: CollectionPage schema missing`)
  const itemList = schemas.find((schema) => schema['@type'] === 'ItemList')
  if (!itemList || itemList.numberOfItems !== guides.length || itemList.itemListElement?.length !== guides.length) fail(`${context}: ItemList schema missing or wrong size`)
  else guides.forEach((guide, index) => {
    const item = itemList.itemListElement[index]
    if (item.position !== index + 1 || item.url !== absoluteUrl(guide.canonicalPath)) fail(`${context}: ItemList mismatch for ${guide.slug}`)
  })
  for (const guide of guides) {
    if (!html.includes(guide.canonicalPath)) fail(`${context}: canonical guide link missing for ${guide.slug}`)
  }
  return html
}

function parseRedirects(text) {
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map((line) => {
    const [from, to, status] = line.split(/\s+/)
    return { from, to, status }
  })
}

function verifyRedirects(text, migration) {
  const rules = parseRedirects(text)
  if (rules[0]?.from !== 'https://www.wagerproof.bet/*' || rules[0]?.to !== 'https://wagerproof.bet/:splat' || rules[0]?.status !== '301!') fail('_redirects: apex normalization must be first')
  if (rules.at(-1)?.from !== '/*' || rules.at(-1)?.to !== '/index.html' || rules.at(-1)?.status !== '200') fail('_redirects: SPA fallback must be last')
  const guide404 = rules.findIndex((rule) => rule.from === '/guides/*' && rule.status === '404')
  const blog404 = rules.findIndex((rule) => rule.from === '/blog/*' && rule.status === '404')
  if (guide404 < 0 || blog404 < 0 || guide404 >= rules.length - 1 || blog404 >= rules.length - 1) fail('_redirects: editorial namespace 404 rules must precede fallback')
  const ruleKey = new Map(rules.map((rule) => [`${rule.from}|${rule.to}|${rule.status}`, rule]))
  for (const rule of rules.filter((candidate) => candidate.status.startsWith('301') && candidate.from.startsWith('/') && candidate.to.startsWith('/'))) {
    const normalizedFrom = rule.from.replace(/\/+$/, '') || '/'
    const normalizedTo = rule.to.replace(/\/+$/, '') || '/'
    if (normalizedFrom === normalizedTo) fail(`_redirects: Netlify-normalized self redirect forbidden for ${rule.from}`)
  }
  for (const entry of migration.entries) {
    const source = entry.sourcePath.replace(/\/$/, '')
    const recommendation = entry.recommendation
    if (recommendation.disposition === 'move_301') {
      for (const variant of [source, `${source}/`]) {
        if (!ruleKey.has(`${variant}|${recommendation.targetPath}|301!`)) fail(`_redirects: move missing ${variant}`)
      }
      if (['/', '/guides/', '/blog/'].includes(recommendation.targetPath)) fail(`_redirects: broad hub redirect forbidden for ${source}`)
    }
    if (recommendation.disposition === 'retire_404') {
      for (const variant of [source, `${source}/`]) {
        if (!ruleKey.has(`${variant}|/404.html|404`)) fail(`_redirects: retirement missing ${variant}`)
      }
    }
  }
  const exactSources = rules.filter((rule) => !rule.from.includes('*') && !/^https?:/.test(rule.from)).map((rule) => rule.from)
  const duplicates = exactSources.filter((source, index) => exactSources.indexOf(source) !== index)
  if (duplicates.length) fail(`_redirects: duplicate exact source rules: ${[...new Set(duplicates)].join(', ')}`)
}

function parseSitemap(xml) {
  const entries = new Map()
  for (const match of xml.matchAll(/<url>([\s\S]*?)<\/url>/g)) {
    const loc = /<loc>([^<]+)<\/loc>/.exec(match[1])?.[1]
    const lastmod = /<lastmod>([^<]+)<\/lastmod>/.exec(match[1])?.[1] || null
    if (loc) entries.set(loc, { lastmod, body: match[1] })
  }
  return entries
}

function verifySitemap(xml, guides) {
  const entries = parseSitemap(xml)
  const expectedEditorial = new Map([
    [`${SITE_URL}/guides/`, guides.reduce((latest, guide) => guide.updatedAt > latest ? guide.updatedAt : latest, '0000-00-00')],
    [`${SITE_URL}/guides/all/`, guides.reduce((latest, guide) => guide.updatedAt > latest ? guide.updatedAt : latest, '0000-00-00')],
    ...guides.map((guide) => [absoluteUrl(guide.canonicalPath), guide.updatedAt]),
  ])
  for (const [url, lastmod] of expectedEditorial) {
    const entry = entries.get(url)
    if (!entry) fail(`sitemap: missing ${url}`)
    else if (entry.lastmod !== lastmod) fail(`sitemap: ${url} lastmod ${entry.lastmod}, expected ${lastmod}`)
  }
  const canonicalSet = new Set(guides.map((guide) => absoluteUrl(guide.canonicalPath)))
  for (const [url] of entries) {
    if (url.startsWith(`${SITE_URL}/blog/`) && !canonicalSet.has(url)) fail(`sitemap: legacy noncanonical blog URL present ${url}`)
  }
  for (const guide of guides) {
    const entry = entries.get(absoluteUrl(guide.canonicalPath))
    if (entry && !entry.body.includes(`<image:loc>${SITE_URL}${guide.hero.src}</image:loc>`)) fail(`sitemap: image discovery missing for ${guide.slug}`)
  }
}

function verifyFeed(xml, guides) {
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((match) => match[1])
  if (items.length !== guides.length) fail(`feed: expected ${guides.length} items, found ${items.length}`)
  const links = new Set(items.map((item) => /<link>([^<]+)<\/link>/.exec(item)?.[1]))
  for (const guide of guides) {
    const url = absoluteUrl(guide.canonicalPath)
    if (!links.has(url)) fail(`feed: missing ${url}`)
    const item = items.find((candidate) => candidate.includes(`<link>${url}</link>`))
    if (!item?.includes(`<guid isPermaLink="true">${url}</guid>`)) fail(`feed: canonical guid mismatch for ${guide.slug}`)
    if (!item?.includes(`${SITE_URL}${guide.hero.src}`)) fail(`feed: image missing for ${guide.slug}`)
  }
  if (!xml.includes(`<atom:link href="${SITE_URL}/guides/feed.xml" rel="self" type="application/rss+xml" />`)) fail('feed: self link missing')
}

async function verifyInternalReferences(htmlByRoute, redirectText) {
  const redirectSources = new Set(parseRedirects(redirectText).map((rule) => rule.from).filter((source) => !source.includes('*') && !/^https?:/.test(source)))
  const knownSpa = new Set(['/', '/mcp', '/support', '/privacy-policy', '/terms-and-conditions', '/mobile-app', '/press-kit', '/free-picks', '/ai-agents'])
  for (const [route, html] of htmlByRoute) {
    for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const value = match[1]
      if (value.startsWith('#')) {
        const id = decodeURIComponent(value.slice(1))
        if (id && !html.includes(`id="${escapeHtml(id)}"`)) fail(`${route}: broken fragment ${value}`)
        continue
      }
      if (/^(?:https?:|\/\/|mailto:|tel:|data:)/.test(value)) continue
      const pathname = value.split(/[?#]/)[0]
      if (!pathname.startsWith('/')) continue
      if (knownSpa.has(pathname) || redirectSources.has(pathname)) continue
      const localPath = path.join(DIST, pathname.replace(/^\//, ''))
      const routeIndex = path.join(localPath, 'index.html')
      if (!await exists(localPath) && !await exists(routeIndex)) fail(`${route}: broken internal reference ${value}`)
    }
    for (const match of html.matchAll(/<img\b[^>]*src="(https?:\/\/[^"]+)"/g)) {
      if (!match[1].startsWith('https://www.facebook.com/tr?')) fail(`${route}: remote editorial image ${match[1]}`)
    }
  }
}

async function verifySourceOwnership() {
  const app = await fs.readFile(path.join(ROOT, 'src', 'App.tsx'), 'utf8')
  if (/path=["']\/(?:blog|guides)/.test(app) || /startsWith\(['"]\/(?:blog|guides)/.test(app)) fail('src/App.tsx still owns an editorial canonical namespace')
  if (/\bBlog(?:Post)?\b/.test(app)) fail('src/App.tsx still imports a Blog component')
  for (const file of ['src/pages/Blog.tsx', 'src/pages/BlogPost.tsx', 'src/hooks/useBlogPosts.ts', 'scripts/build-blog.mjs', 'scripts/verify-blog-build.mjs']) {
    if (await exists(path.join(ROOT, file))) fail(`retired Ghost/React ownership file still exists: ${file}`)
  }
  const packageJson = await fs.readFile(path.join(ROOT, 'package.json'), 'utf8')
  if (packageJson.includes('@tryghost/content-api') || packageJson.includes('build:blog') || packageJson.includes('verify:blog')) fail('package.json still depends on live Ghost build ownership')
  const netlify = await fs.readFile(path.join(ROOT, 'netlify.toml'), 'utf8')
  if (netlify.includes('[[redirects]]')) fail('netlify.toml has handwritten redirects that can shadow generated route order')
}

async function main() {
  const { guides, guideMap, migration } = await loadEditorialSystem()
  const expectedRoutes = ['/guides/', '/guides/all/', ...guides.map((guide) => guide.canonicalPath)]
  const htmlByRoute = new Map()
  const actualRoutes = await editorialHtmlRoutes()
  const expectedSortedRoutes = [...expectedRoutes].sort()
  if (JSON.stringify(actualRoutes) !== JSON.stringify(expectedSortedRoutes)) {
    fail(`generated editorial route set mismatch\nexpected: ${expectedSortedRoutes.join(', ')}\nactual: ${actualRoutes.join(', ')}`)
  }
  for (const route of expectedRoutes) {
    const file = routeFile(route)
    if (!await exists(file)) {
      fail(`missing generated route ${route}`)
      continue
    }
    htmlByRoute.set(route, await fs.readFile(file, 'utf8'))
  }
  if (htmlByRoute.size !== guides.length + 2) fail(`expected ${guides.length + 2} generated editorial routes, found ${htmlByRoute.size}`)

  if (htmlByRoute.has('/guides/')) await verifyHub(
    '/guides/',
    'WagerProof Guides: sports research without the certainty theater',
    'Original guides about sports research apps, odds, line movement, player props, model methodology, tracking, releases, and responsible use.',
    guides.find((guide) => guide.featured)?.hero.socialSrc || guides[0].hero.socialSrc,
    guides,
  )
  if (htmlByRoute.has('/guides/') && !htmlByRoute.get('/guides/').includes('class="featured-card__media" href="/guides/best-sports-betting-research-apps/" tabindex="-1" aria-hidden="true"')) {
    fail('/guides/: duplicate featured-card image link must be hidden from the accessibility tree')
  }
  if (htmlByRoute.has('/guides/all/')) await verifyHub(
    '/guides/all/',
    'All WagerProof Guides | WagerProof',
    'Browse every maintained WagerProof guide by topic, including odds fundamentals, market research, methodology, player props, performance, releases, and responsible use.',
    guides[0].hero.socialSrc,
    guides,
  )
  for (const guide of guides) {
    const html = htmlByRoute.get(guide.canonicalPath)
    if (html) await verifyArticleOutput(guide, guideMap, html)
  }

  const cssPath = path.join(DIST, 'guides', 'guides-v1.css')
  const jsPath = path.join(DIST, 'guides', 'guides-v1.js')
  if (!await exists(cssPath) || !await exists(jsPath)) fail('scoped Guides CSS/JS bundle missing')
  else {
    const css = await fs.readFile(cssPath, 'utf8')
    const js = await fs.readFile(jsPath, 'utf8')
    for (const token of ['@media (max-width: 360px)', '@media (max-width: 640px)', '@media (max-width: 820px)', '@media (prefers-reduced-motion: reduce)', 'grid-template-columns: repeat(4', 'overflow-x: auto']) {
      if (!css.includes(token)) fail(`guides CSS missing required responsive/accessibility token: ${token}`)
    }
    if (/body\s*\{[^}]*overflow:\s*hidden/s.test(css)) fail('guides CSS clips page scrolling on body')
    if (!js.includes("search.closest('.find-guides, .all-guides')") || !js.includes("results.querySelectorAll('[data-guide-row]')")) {
      fail('guide search must stay scoped to its own result container')
    }
  }

  const redirectText = await fs.readFile(path.join(DIST, '_redirects'), 'utf8')
  verifyRedirects(redirectText, migration)
  verifySitemap(await fs.readFile(path.join(DIST, 'sitemap.xml'), 'utf8'), guides)
  verifyFeed(await fs.readFile(path.join(DIST, 'guides', 'feed.xml'), 'utf8'), guides)
  await verifyInternalReferences(htmlByRoute, redirectText)
  await verifySourceOwnership()

  const notFound = await fs.readFile(path.join(DIST, '404.html'), 'utf8')
  verifyExactMeta(notFound, 'name', 'robots', 'noindex,follow', '404.html')
  assertCount(notFound, /<h1\b/g, 1, '404.html')
  verifyNoStaticOwnershipConflicts(notFound, '404.html')
  verifyAnalytics(notFound, '404.html')

  const blogIndex = path.join(DIST, 'blog', 'index.html')
  if (await exists(blogIndex)) fail('dist/blog/index.html must not exist because /blog redirects to /guides/')
  const humanManifest = await fs.readFile(path.join(ROOT, 'content', 'migrations', 'ghost-url-migration-manifest.md'), 'utf8')
  if (count(humanManifest, /^\| \d+ \|/gm) !== 100) fail('human migration manifest must list exactly 100 URL rows')
  const dispositionLabels = { keep_rewrite: 'KEEP + rewrite', move_301: 'MOVE 301', retire_404: 'RETIRE 404' }
  migration.entries.forEach((entry, index) => {
    const recommendation = entry.recommendation
    const target = recommendation.targetPath ? `\`${recommendation.targetPath}\`` : '—'
    const clean = (value) => String(value).replaceAll('|', '\\|').replaceAll(/\s+/g, ' ').trim()
    const expectedRow = `| ${index + 1} | \`${entry.sourcePath}\` | ${clean(entry.title)} | ${entry.publishedAt.slice(0, 10)} | ${entry.updatedAt.slice(0, 10)} | ${dispositionLabels[recommendation.disposition]} | ${target} | ${clean(recommendation.rationale)} |`
    if (!humanManifest.includes(expectedRow)) fail(`human migration manifest mismatch for ${entry.sourcePath}`)
  })

  if (failures.length) {
    console.error(`Generated editorial verification failed with ${failures.length} issue(s):`)
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
    return
  }
  console.log(`Verified ${guides.length} articles, 2 directories, 20 title/social images, ${migration.entries.length} legacy dispositions, sitemap, RSS, route ownership, internal links, schema, and exact-once analytics.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
