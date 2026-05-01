import fs from 'fs'
import path from 'path'

/**
 * Next only reliably loads `.env*` from `frontend/`. Prisma reads `DATABASE_URL` at runtime.
 * `loadEnvConfig` from `@next/env` often skips parent folders, so we merge known `.env` paths
 * by hand (same idea as dotenv): repo root first, then `frontend/`, later files override.
 */
const bootstrapped = { done: false as boolean }

function parseEnvLines(content: string, set: (key: string, val: string) => void) {
  for (let line of content.split('\n')) {
    line = line.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq <= 0) continue
    const key = line.slice(0, eq).trim()
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue
    let val = line.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    } else {
      const hash = val.search(/\s+#/)
      if (hash !== -1) val = val.slice(0, hash).trim()
    }
    if (val === '') continue
    set(key, val)
  }
}

function mergeEnvFile(filePath: string, env: Record<string, string>) {
  if (!fs.existsSync(filePath)) return
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    parseEnvLines(content, (key, val) => {
      env[key] = val
    })
  } catch {
    /* ignore unreadable files */
  }
}

function run() {
  if (bootstrapped.done) return
  bootstrapped.done = true

  const cwd = process.cwd()
  const files: string[] = []

  if (path.basename(cwd) === 'frontend' && fs.existsSync(path.join(cwd, '..', 'package.json'))) {
    const root = path.join(cwd, '..')
    files.push(
      path.join(root, '.env'),
      path.join(root, '.env.local'),
      path.join(cwd, '.env'),
      path.join(cwd, '.env.local'),
    )
  } else if (fs.existsSync(path.join(cwd, 'frontend', 'package.json'))) {
    files.push(
      path.join(cwd, '.env'),
      path.join(cwd, '.env.local'),
      path.join(cwd, 'frontend', '.env'),
      path.join(cwd, 'frontend', '.env.local'),
    )
  } else {
    files.push(path.join(cwd, '.env'), path.join(cwd, '.env.local'), path.join(cwd, '..', '.env'), path.join(cwd, '..', '.env.local'))
  }

  const merged: Record<string, string> = {}
  for (const f of files) mergeEnvFile(f, merged)

  for (const [key, val] of Object.entries(merged)) {
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = val
    }
  }
}

run()
