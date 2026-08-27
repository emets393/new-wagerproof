import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { CONTENT_DIR, loadEditorialSystem } from './lib/guides.mjs'

const BANNED = [
  { label: 'em dash', pattern: /—/g },
  { label: 'delve', pattern: /\bdelve(?:s|d|ing)?\b/gi },
  { label: 'unlock', pattern: /\bunlock(?:s|ed|ing)?\b/gi },
  { label: 'seamless', pattern: /\bseamless(?:ly)?\b/gi },
  { label: 'game changer', pattern: /\bgame[- ]changer\b/gi },
  { label: 'elevate', pattern: /\belevate(?:s|d|ing)?\b/gi },
  { label: 'in conclusion', pattern: /\bin conclusion\b/gi },
  { label: 'guaranteed profit', pattern: /\bguaranteed profits?\b/gi },
  { label: 'hidden SEO block', pattern: /seo-only/gi },
]

const DISALLOWED_PUBLISHED_HOSTS = [
  'wagerproof.ghost.io',
  'storage.ghost.io',
  'assets.seobotai.com',
]

function wordCount(value) {
  return value.trim().split(/\s+/).filter(Boolean).length
}

function sentenceOpenings(markdown) {
  const prose = markdown
    .replace(/^#{1,6}\s+.*$/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/\[[^\]]+\]\([^\)]+\)/g, '')
    .replace(/`[^`]+`/g, '')
  const openings = new Map()
  for (const sentence of prose.split(/[.!?](?:\s+|$)/)) {
    const words = sentence.trim().toLowerCase().match(/[a-z0-9']+/g)
    if (!words || words.length < 6) continue
    const opening = words.slice(0, 3).join(' ')
    openings.set(opening, (openings.get(opening) || 0) + 1)
  }
  return [...openings.entries()].filter(([, count]) => count >= 4)
}

async function main() {
  const { guides, migration } = await loadEditorialSystem()
  const failures = []

  for (const guide of guides) {
    const sourceFiles = ['guide.json', 'content.md', 'research.md', 'sources.json']
    const texts = await Promise.all(sourceFiles.map((file) => fs.readFile(path.join(CONTENT_DIR, guide.slug, file), 'utf8')))
    const combined = texts.join('\n')
    for (const rule of BANNED) {
      const matches = combined.match(rule.pattern)
      if (matches?.length) failures.push(`${guide.slug}: ${rule.label} (${matches.length})`)
    }
    for (const host of DISALLOWED_PUBLISHED_HOSTS) {
      if (combined.includes(host)) failures.push(`${guide.slug}: disallowed published host ${host}`)
    }
    if (/<(?:script|iframe|style)\b/i.test(guide.markdown)) failures.push(`${guide.slug}: raw executable HTML in content.md`)
    if (/^##\s+(Conclusion|Final thoughts?)\b/im.test(guide.markdown)) failures.push(`${guide.slug}: generic conclusion heading`)
    const minimum = guide.layout === 'release' ? 350 : guide.layout === 'feature' ? 450 : 550
    const words = wordCount(guide.markdown)
    if (words < minimum) failures.push(`${guide.slug}: ${words} content words, expected at least ${minimum}`)
    for (const [opening, count] of sentenceOpenings(guide.markdown)) {
      failures.push(`${guide.slug}: repeated sentence opening "${opening}" (${count} times)`)
    }
  }

  const dispositions = migration.entries.reduce((counts, entry) => {
    counts[entry.recommendation.disposition] = (counts[entry.recommendation.disposition] || 0) + 1
    return counts
  }, {})
  const expected = migration.summary.dispositions
  for (const [key, count] of Object.entries(expected)) {
    if (dispositions[key] !== count) failures.push(`migration disposition ${key}: expected ${count}, found ${dispositions[key] || 0}`)
  }
  if (Object.values(expected).reduce((sum, count) => sum + count, 0) !== 100) {
    failures.push('migration disposition summary must total 100')
  }

  if (failures.length) {
    console.error(`Editorial style check failed with ${failures.length} issue(s):`)
    for (const failure of failures) console.error(`- ${failure}`)
    process.exitCode = 1
    return
  }
  console.log(`Editorial style check passed for ${guides.length} guides and ${migration.entries.length} audited legacy URLs.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
