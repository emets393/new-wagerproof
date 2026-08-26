import fs from 'node:fs/promises'
import http from 'node:http'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const DIST = path.join(ROOT, 'dist')
const HOST = process.env.PREVIEW_HOST || '127.0.0.1'
const PORT = Number(process.env.PORT || 8082)

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.xml', 'application/xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.csv', 'text/csv; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.woff2', 'font/woff2'],
  ['.mp4', 'video/mp4'],
])

function compileRule(line) {
  const [from, to, rawStatus] = line.trim().split(/\s+/)
  const force = rawStatus.endsWith('!')
  const status = Number(rawStatus.replace('!', ''))
  const escaped = from.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '(.*)')
  return { from, to, status, force, regex: new RegExp(`^${escaped}$`) }
}

async function loadRules() {
  const text = await fs.readFile(path.join(DIST, '_redirects'), 'utf8')
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#')).map(compileRule)
}

function safePathname(rawUrl) {
  const pathname = decodeURIComponent(new URL(rawUrl, `http://${HOST}:${PORT}`).pathname)
  if (pathname.includes('\0') || pathname.split('/').includes('..')) throw new Error('Unsafe path')
  return pathname
}

async function resolveStatic(pathname) {
  const relative = pathname.replace(/^\/+/, '')
  const candidates = pathname.endsWith('/')
    ? [path.join(DIST, relative, 'index.html')]
    : [path.join(DIST, relative), path.join(DIST, `${relative}.html`)]
  for (const candidate of candidates) {
    const normalized = path.resolve(candidate)
    if (!normalized.startsWith(`${path.resolve(DIST)}${path.sep}`) && normalized !== path.resolve(DIST, 'index.html')) continue
    try {
      const stat = await fs.stat(normalized)
      if (stat.isFile()) return normalized
      if (stat.isDirectory()) return { directory: true }
    } catch {
      // Try the next static candidate.
    }
  }
  return null
}

function matchRule(rule, pathname) {
  if (/^https?:\/\//.test(rule.from)) return null
  const match = rule.regex.exec(pathname)
  if (!match) return null
  let target = rule.to
  if (match[1] !== undefined) target = target.replace(':splat', match[1]).replace('*', match[1])
  return target
}

async function sendFile(res, filePath, status = 200) {
  const bytes = await fs.readFile(filePath)
  const extension = path.extname(filePath).toLowerCase()
  res.writeHead(status, {
    'Content-Type': MIME.get(extension) || 'application/octet-stream',
    'Content-Length': bytes.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  res.end(bytes)
}

const rules = await loadRules()
const server = http.createServer(async (req, res) => {
  try {
    const pathname = safePathname(req.url || '/')

    for (const rule of rules.filter((item) => item.force)) {
      const target = matchRule(rule, pathname)
      if (!target) continue
      res.writeHead(rule.status, { Location: target, 'Cache-Control': 'no-store' })
      res.end()
      return
    }

    const staticFile = await resolveStatic(pathname)
    if (staticFile?.directory) {
      res.writeHead(301, { Location: `${pathname}/`, 'Cache-Control': 'no-store' })
      res.end()
      return
    }
    if (typeof staticFile === 'string') {
      await sendFile(res, staticFile)
      return
    }

    for (const rule of rules.filter((item) => !item.force)) {
      const target = matchRule(rule, pathname)
      if (!target) continue
      if (rule.status >= 300 && rule.status < 400) {
        res.writeHead(rule.status, { Location: target, 'Cache-Control': 'no-store' })
        res.end()
        return
      }
      const targetFile = path.join(DIST, target.replace(/^\//, ''))
      await sendFile(res, targetFile, rule.status)
      return
    }

    await sendFile(res, path.join(DIST, '404.html'), 404)
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(`Preview server error: ${error.message}`)
  }
})

server.listen(PORT, HOST, () => {
  console.log(`WagerProof production preview: http://${HOST}:${PORT}/guides/`)
})

function close() {
  server.close(() => process.exit(0))
}

process.on('SIGINT', close)
process.on('SIGTERM', close)
