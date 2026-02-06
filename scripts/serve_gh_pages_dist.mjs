import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const distDir = path.resolve(__dirname, '..', 'dist')

const repo = (process.env.GH_PAGES_REPO || 'deadline').trim()
const port = Number(process.env.GH_PAGES_PORT || 4176)
const prefix = `/${repo}`

const contentTypeMap = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8'
}

function normalizePathname(urlPathname) {
  const raw = decodeURIComponent(urlPathname.split('?')[0])
  if (raw === '/' || raw === '') {
    return `${prefix}/`
  }

  return raw
}

function resolveCandidate(pathname) {
  if (!pathname.startsWith(prefix)) {
    return null
  }

  const remainder = pathname.slice(prefix.length)
  const asRelative = remainder === '' || remainder === '/' ? '/index.html' : remainder
  const normalized = path.posix.normalize(asRelative)
  if (normalized.includes('..')) {
    return null
  }

  const fullPath = path.join(distDir, normalized)
  if (!fullPath.startsWith(distDir)) {
    return null
  }

  if (existsSync(fullPath) && statSync(fullPath).isFile()) {
    return fullPath
  }

  const fallback = path.join(distDir, 'index.html')
  if (existsSync(fallback)) {
    return fallback
  }

  return null
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  const contentType = contentTypeMap[ext] || 'application/octet-stream'
  res.writeHead(200, {
    'content-type': contentType,
    'cache-control': ext === '.html' ? 'no-store' : 'public, max-age=3600'
  })
  createReadStream(filePath).pipe(res)
}

const server = createServer((req, res) => {
  const pathname = normalizePathname(req.url || '/')

  if (pathname === '/') {
    res.writeHead(302, { location: `${prefix}/` })
    res.end()
    return
  }

  const candidate = resolveCandidate(pathname)
  if (!candidate) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('not found')
    return
  }

  sendFile(res, candidate)
})

server.listen(port, '127.0.0.1', () => {
  console.log(`gh-pages preview listening on http://127.0.0.1:${port}${prefix}/`)
})
