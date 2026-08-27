import fs from 'node:fs/promises'
import path from 'node:path'
import { marked } from 'marked'
import sanitizeHtml from 'sanitize-html'

export const SITE_URL = 'https://wagerproof.bet'
export const ROOT = process.cwd()
export const CONTENT_DIR = path.join(ROOT, 'content', 'guides')
export const MIGRATION_PATH = path.join(ROOT, 'content', 'migrations', 'ghost-corpus-audit.json')

const REQUIRED_STRINGS = [
  'layout', 'slug', 'canonicalPath', 'intent', 'title', 'shortTitle', 'seoTitle',
  'description', 'dek', 'category', 'publishedAt', 'updatedAt', 'reviewedAt',
  'author', 'disclosure', 'verdict',
]

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function absoluteUrl(value) {
  if (/^https?:\/\//.test(value)) return value
  return `${SITE_URL}${value.startsWith('/') ? value : `/${value}`}`
}

export function slugify(value) {
  return String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function formatDate(value) {
  const date = new Date(`${value}T12:00:00Z`)
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: ${value}`)
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC',
  }).format(date)
}

function assertString(object, key, context) {
  if (typeof object[key] !== 'string' || !object[key].trim()) {
    throw new Error(`${context}: missing non-empty ${key}`)
  }
}

function assertDate(value, context) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${context}: invalid YYYY-MM-DD date ${value}`)
  }
}

function assertLocalAsset(value, context) {
  if (!value.startsWith('/guides/')) throw new Error(`${context}: asset must be under /guides/: ${value}`)
  if (/^https?:/.test(value)) throw new Error(`${context}: remote asset is not allowed: ${value}`)
}

export function validateGuide(meta, sources, context) {
  for (const key of REQUIRED_STRINGS) assertString(meta, key, context)
  if (!['standard', 'feature', 'release'].includes(meta.layout)) {
    throw new Error(`${context}: unsupported layout ${meta.layout}`)
  }
  if (!/^\/[a-z0-9\-/]+\/$/.test(meta.canonicalPath)) {
    throw new Error(`${context}: canonicalPath must be a lowercase trailing-slash path`)
  }
  if (!['/guides/', '/blog/'].some((prefix) => meta.canonicalPath.startsWith(prefix))) {
    throw new Error(`${context}: canonicalPath must live under /guides/ or /blog/`)
  }
  for (const key of ['publishedAt', 'updatedAt', 'reviewedAt']) assertDate(meta[key], `${context}.${key}`)
  for (const key of ['nextReviewAt', 'lastTestedAt']) {
    if (meta[key]) assertDate(meta[key], `${context}.${key}`)
  }
  if (meta.updatedAt < meta.publishedAt) throw new Error(`${context}: updatedAt precedes publishedAt`)
  if (!Number.isInteger(meta.readingTimeMinutes) || meta.readingTimeMinutes < 1) {
    throw new Error(`${context}: readingTimeMinutes must be a positive integer`)
  }
  if (meta.author !== 'chris-habib') throw new Error(`${context}: unknown author ${meta.author}`)
  if (!meta.hero || typeof meta.hero !== 'object') throw new Error(`${context}: hero is required`)
  for (const key of ['src', 'socialSrc', 'alt', 'caption', 'source']) assertString(meta.hero, key, `${context}.hero`)
  assertLocalAsset(meta.hero.src, `${context}.hero.src`)
  assertLocalAsset(meta.hero.socialSrc, `${context}.hero.socialSrc`)
  if (meta.hero.width !== 1672 || meta.hero.height !== 941) throw new Error(`${context}: hero must be 1672x941`)
  if (meta.hero.socialWidth !== 1200 || meta.hero.socialHeight !== 630) throw new Error(`${context}: social image must be 1200x630`)
  if (!Array.isArray(meta.relatedSlugs) || meta.relatedSlugs.length !== 4 || new Set(meta.relatedSlugs).size !== 4) {
    throw new Error(`${context}: relatedSlugs must contain exactly four unique slugs`)
  }
  if (meta.relatedSlugs.includes(meta.slug)) throw new Error(`${context}: article cannot relate to itself`)
  if (!Array.isArray(meta.redirectAliases)) throw new Error(`${context}: redirectAliases must be an array`)
  for (const alias of meta.redirectAliases) {
    if (!/^\/[a-z0-9\-/]+\/?$/.test(alias)) throw new Error(`${context}: invalid redirect alias ${alias}`)
  }
  if (!Array.isArray(sources) || sources.length < 2) throw new Error(`${context}: at least two sources are required`)
  const sourceUrls = new Set()
  for (const [index, source] of sources.entries()) {
    for (const key of ['title', 'publisher', 'url', 'accessedAt', 'usedFor']) assertString(source, key, `${context}.sources[${index}]`)
    if (!/^https:\/\//.test(source.url)) throw new Error(`${context}: source URL must use https: ${source.url}`)
    if (sourceUrls.has(source.url)) throw new Error(`${context}: duplicate source URL ${source.url}`)
    sourceUrls.add(source.url)
    assertDate(source.accessedAt, `${context}.sources[${index}].accessedAt`)
  }
  if (meta.layout === 'feature') {
    if (!Array.isArray(meta.apps) || meta.apps.length < 5) throw new Error(`${context}: feature layout requires ranked apps`)
    const citedSourceUrls = new Set()
    const appIds = new Set()
    meta.apps.forEach((app, index) => {
      if (app.rank !== index + 1) throw new Error(`${context}: app ranks must be sequential`)
      for (const key of ['name', 'categoryLabel', 'icon', 'officialUrl', 'price', 'priceAsOf', 'priceSourceUrl', 'platforms']) {
        assertString(app, key, `${context}.apps[${index}]`)
      }
      const appId = slugify(app.name)
      if (appIds.has(appId)) throw new Error(`${context}: app names must produce unique heading IDs: ${app.name}`)
      appIds.add(appId)
      if (!/^https:\/\//.test(app.officialUrl)) throw new Error(`${context}.apps[${index}]: officialUrl must use https`)
      if (!sourceUrls.has(app.priceSourceUrl)) throw new Error(`${context}.apps[${index}]: priceSourceUrl is not in sources.json`)
      assertLocalAsset(app.icon, `${context}.apps[${index}].icon`)
      assertDate(app.priceAsOf, `${context}.apps[${index}].priceAsOf`)
      if (!app.review || typeof app.review !== 'object') throw new Error(`${context}.apps[${index}]: review is required`)
      if (!Array.isArray(app.review.paragraphs) || app.review.paragraphs.length < 2) {
        throw new Error(`${context}.apps[${index}]: review requires at least two paragraphs`)
      }
      app.review.paragraphs.forEach((paragraph, paragraphIndex) => {
        if (typeof paragraph !== 'string' || !paragraph.trim()) {
          throw new Error(`${context}.apps[${index}].review.paragraphs[${paragraphIndex}]: non-empty string required`)
        }
      })
      for (const key of ['chooseItFor', 'thinkTwiceBecause']) assertString(app.review, key, `${context}.apps[${index}].review`)
      if (app.review.highlights) {
        if (!Array.isArray(app.review.highlights) || app.review.highlights.length < 2) {
          throw new Error(`${context}.apps[${index}].review.highlights: at least two highlights required when present`)
        }
        app.review.highlights.forEach((highlight, highlightIndex) => {
          if (typeof highlight !== 'string' || !highlight.trim()) {
            throw new Error(`${context}.apps[${index}].review.highlights[${highlightIndex}]: non-empty string required`)
          }
        })
      }
      const reviewStrings = [
        ...app.review.paragraphs,
        ...(app.review.highlights || []),
        app.review.chooseItFor,
        app.review.thinkTwiceBecause,
      ]
      if (reviewStrings.some((value) => /\[[^\]]+\]\(https:\/\//.test(value))) {
        throw new Error(`${context}.apps[${index}]: review prose must keep links in sourceUrls`)
      }
      if (!Array.isArray(app.review.sourceUrls) || app.review.sourceUrls.length === 0 || new Set(app.review.sourceUrls).size !== app.review.sourceUrls.length) {
        throw new Error(`${context}.apps[${index}]: review.sourceUrls must contain unique official sources`)
      }
      if (!app.review.sourceUrls.includes(app.priceSourceUrl)) {
        throw new Error(`${context}.apps[${index}]: priceSourceUrl must appear in review.sourceUrls`)
      }
      for (const url of app.review.sourceUrls) {
        if (!sourceUrls.has(url)) throw new Error(`${context}.apps[${index}]: review source is not in sources.json: ${url}`)
        citedSourceUrls.add(url)
      }
    })
    for (const source of sources) {
      if (!citedSourceUrls.has(source.url)) throw new Error(`${context}: source is not cited inline: ${source.url}`)
    }
  }
  if (meta.layout === 'release') {
    if (!meta.release || typeof meta.release !== 'object') throw new Error(`${context}: release layout requires release metadata`)
    for (const key of ['version', 'releaseDate']) assertString(meta.release, key, `${context}.release`)
    assertDate(meta.release.releaseDate, `${context}.release.releaseDate`)
    if (!Array.isArray(meta.release.platforms) || meta.release.platforms.length === 0) throw new Error(`${context}: release platforms required`)
    if (!Array.isArray(meta.release.changes) || meta.release.changes.length < 3) throw new Error(`${context}: release changes required`)
    if (!Array.isArray(meta.release.screenshots) || meta.release.screenshots.length < 1) throw new Error(`${context}: release screenshots required`)
    for (const shot of meta.release.screenshots) {
      assertLocalAsset(shot.src, `${context}.release.screenshot`)
      if (!shot.width || !shot.height || !shot.alt || !shot.caption) throw new Error(`${context}: complete screenshot metadata required`)
    }
  }
  if (meta.faqs) {
    if (!Array.isArray(meta.faqs) || meta.faqs.length < 2) throw new Error(`${context}: FAQs require at least two entries`)
    for (const faq of meta.faqs) {
      assertString(faq, 'question', `${context}.faq`)
      assertString(faq, 'answer', `${context}.faq`)
    }
  }
  if (meta.howTo) {
    for (const key of ['name', 'description']) assertString(meta.howTo, key, `${context}.howTo`)
    if (!Array.isArray(meta.howTo.steps) || meta.howTo.steps.length < 3) throw new Error(`${context}: HowTo needs at least three steps`)
    for (const step of meta.howTo.steps) {
      assertString(step, 'name', `${context}.howTo.step`)
      assertString(step, 'text', `${context}.howTo.step`)
    }
  }
}

function renderMarkdown(markdown) {
  const headings = []
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^##\s+(.+?)\s*$/.exec(line)
    if (match) headings.push({ id: slugify(match[1].replace(/[`*_]/g, '')), label: match[1].replace(/[`*_]/g, '') })
  }
  const ids = [...headings]
  const parsed = marked.parse(markdown, { gfm: true, breaks: false })
  let html = sanitizeHtml(parsed, {
    allowedTags: [
      'p', 'a', 'strong', 'em', 'code', 'pre', 'blockquote', 'ul', 'ol', 'li',
      'h2', 'h3', 'h4', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'br',
    ],
    allowedAttributes: { a: ['href', 'title'], th: ['align'], td: ['align'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    enforceHtmlBoundary: true,
  })
  html = html.replace(/<h2>([\s\S]*?)<\/h2>/g, (full, label) => {
    const heading = ids.shift()
    if (!heading) return full
    return `<h2 id="${escapeHtml(heading.id)}">${label}</h2>`
  })
  html = html.replace(/<a href="(https:\/\/[^\"]+)"/g, '<a href="$1" rel="noopener noreferrer"')
  html = html
    .replaceAll('<table>', '<div class="table-scroll" tabindex="0" role="region" aria-label="Scrollable data table"><table>')
    .replaceAll('</table>', '</table></div>')
  return { html, headings }
}

export async function loadEditorialSystem() {
  const registry = JSON.parse(await fs.readFile(path.join(CONTENT_DIR, 'registry.json'), 'utf8'))
  if (registry.version !== 1 || !Number.isInteger(registry.expectedCount) || registry.expectedCount < 1) {
    throw new Error('registry.json must declare version 1 and a positive expectedCount')
  }
  if (!Array.isArray(registry.entries) || registry.entries.length !== registry.expectedCount) {
    throw new Error(`registry expected ${registry.expectedCount} entries but declares ${registry.entries?.length ?? 0}`)
  }
  const directories = (await fs.readdir(CONTENT_DIR, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  const registrySlugs = registry.entries.map((entry) => entry.slug).sort()
  if (JSON.stringify(directories) !== JSON.stringify(registrySlugs)) {
    throw new Error(`registry/content directory mismatch\nregistry: ${registrySlugs.join(', ')}\ndirectories: ${directories.join(', ')}`)
  }

  const guides = []
  for (const entry of registry.entries) {
    const directory = path.join(CONTENT_DIR, entry.slug)
    const [metaText, markdown, research, sourcesText] = await Promise.all([
      fs.readFile(path.join(directory, 'guide.json'), 'utf8'),
      fs.readFile(path.join(directory, 'content.md'), 'utf8'),
      fs.readFile(path.join(directory, 'research.md'), 'utf8'),
      fs.readFile(path.join(directory, 'sources.json'), 'utf8'),
    ])
    const meta = JSON.parse(metaText)
    const sources = JSON.parse(sourcesText)
    validateGuide(meta, sources, entry.slug)
    if (meta.slug !== entry.slug || meta.canonicalPath !== entry.canonicalPath || meta.intent !== entry.intent) {
      throw new Error(`${entry.slug}: registry and guide.json identity mismatch`)
    }
    const rendered = renderMarkdown(markdown)
    guides.push({ ...meta, sources, markdown, research, contentHtml: rendered.html, headings: rendered.headings })
  }

  const uniqueFields = ['slug', 'canonicalPath', 'intent', 'title', 'seoTitle', 'description']
  for (const field of uniqueFields) {
    const values = guides.map((guide) => guide[field].toLowerCase())
    if (new Set(values).size !== values.length) throw new Error(`duplicate guide ${field}`)
  }
  const guideMap = new Map(guides.map((guide) => [guide.slug, guide]))
  for (const guide of guides) {
    for (const related of guide.relatedSlugs) {
      if (!guideMap.has(related)) throw new Error(`${guide.slug}: missing related slug ${related}`)
    }
  }

  const migration = JSON.parse(await fs.readFile(MIGRATION_PATH, 'utf8'))
  if (!Array.isArray(migration.entries) || migration.entries.length !== 100) {
    throw new Error(`migration audit must contain exactly 100 entries, found ${migration.entries?.length ?? 0}`)
  }
  const sourcePaths = migration.entries.map((entry) => entry.sourcePath)
  if (new Set(sourcePaths).size !== sourcePaths.length) throw new Error('migration audit has duplicate source paths')
  const canonicals = new Set(guides.map((guide) => guide.canonicalPath))
  for (const entry of migration.entries) {
    const recommendation = entry.recommendation
    if (!['keep_rewrite', 'move_301', 'retire_404'].includes(recommendation?.disposition)) {
      throw new Error(`${entry.sourcePath}: invalid migration disposition`)
    }
    if (recommendation.disposition !== 'retire_404' && !canonicals.has(recommendation.targetPath)) {
      throw new Error(`${entry.sourcePath}: migration target is not canonical: ${recommendation.targetPath}`)
    }
    if (recommendation.disposition === 'move_301' && recommendation.redirectStatus !== 301) {
      throw new Error(`${entry.sourcePath}: move must specify redirectStatus 301`)
    }
    if (recommendation.disposition === 'retire_404' && recommendation.redirectStatus !== 404) {
      throw new Error(`${entry.sourcePath}: retirement must specify redirectStatus 404`)
    }
  }

  const dispositionCounts = {}
  const targetCounts = {}
  for (const entry of migration.entries) {
    const { disposition, targetPath } = entry.recommendation
    dispositionCounts[disposition] = (dispositionCounts[disposition] || 0) + 1
    if (targetPath) targetCounts[targetPath] = (targetCounts[targetPath] || 0) + 1
  }
  for (const key of ['keep_rewrite', 'move_301', 'retire_404']) {
    if (migration.summary?.dispositions?.[key] !== dispositionCounts[key]) {
      throw new Error(`migration summary mismatch for ${key}: summary ${migration.summary?.dispositions?.[key] ?? 0}, entries ${dispositionCounts[key] || 0}`)
    }
  }
  const acceptedDispositionCounts = { keep_rewrite: 4, move_301: 22, retire_404: 74 }
  for (const [key, expected] of Object.entries(acceptedDispositionCounts)) {
    if (dispositionCounts[key] !== expected) {
      throw new Error(`accepted migration policy drift for ${key}: expected ${expected}, found ${dispositionCounts[key] || 0}`)
    }
  }
  const targetKeys = new Set([...Object.keys(targetCounts), ...Object.keys(migration.summary?.targetCounts || {})])
  for (const target of targetKeys) {
    if ((migration.summary?.targetCounts?.[target] || 0) !== (targetCounts[target] || 0)) {
      throw new Error(`migration target summary mismatch for ${target}`)
    }
  }

  return { registry, guides, guideMap, migration }
}
