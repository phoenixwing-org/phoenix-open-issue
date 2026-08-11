#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sqlitePattern = /sqlite|node-sqlite3-wasm|DB_DRIVER\s*=\s*sqlite|\.sqlite3?\b/ig

const productionPatterns = [
  /^packages\/(?:server|web|core)\/src\//,
  /^packages\/(?:server|web|core)\/package\.json$/,
  /^packages\/server\/\.env[^/]*$/,
  /^pnpm-lock\.yaml$/,
  /^(?:Dockerfile|docker-compose[^/]*|\.github\/workflows\/)/,
]

/**
 * Temporary ceiling while the last real SQLite archive/import rehearsal is
 * still missing. Deleting evidence is allowed; adding a new file or increasing
 * any remaining production/current-doc occurrence fails the no-regression gate.
 */
export const SQLITE_TRANSITION_BASELINE = Object.freeze({
  production: Object.freeze({
    'packages/server/package.json': 1,
    'packages/server/.env.sqlite.example': 4,
    'packages/server/src/main.ts': 1,
    'packages/server/src/db/dictDedupe.ts': 1,
    'packages/server/src/db/externalAuthSchema.ts': 1,
    'packages/server/src/db/schema.ts': 1,
    'packages/server/src/db/connection.ts': 9,
    'packages/server/src/db/migrations.ts': 7,
    'packages/server/src/db/pnwDbAdapter.ts': 3,
    'pnpm-lock.yaml': 8,
    'packages/server/src/db/pnw/pnwDbConfig.ts': 10,
    'packages/server/src/db/pnw/pnwDbTypes.ts': 4,
    'packages/server/src/db/pnw/pnwSqliteAdapter.ts': 4,
  }),
  currentDocs: Object.freeze({
    '.claude/rules/no-better-sqlite3.md': 7,
  }),
})

export function classifySqliteEvidence(relativePath, currentDocs = new Set()) {
  if (currentDocs.has(relativePath)) return 'currentDocs'
  if (relativePath.endsWith('.md')) return 'historicalOrDraftDocs'
  if (productionPatterns.some(pattern => pattern.test(relativePath))) return 'production'
  return 'testsToolsOrImporter'
}

export function findSqliteEvidence(source) {
  const matches = []
  for (const match of source.matchAll(sqlitePattern)) {
    matches.push({
      line: source.slice(0, match.index).split('\n').length,
      token: match[0],
    })
  }
  return matches
}

export function findSqliteBaselineRegressions(
  report,
  baseline = SQLITE_TRANSITION_BASELINE,
) {
  const errors = []
  for (const category of ['production', 'currentDocs']) {
    const limits = baseline[category] ?? {}
    for (const entry of report?.[category] ?? []) {
      const limit = limits[entry.path]
      if (limit === undefined) {
        errors.push(`${category} 新增 SQLite 证据文件：${entry.path}`)
      } else if (entry.matches.length > limit) {
        errors.push(
          `${category} SQLite 证据超过过渡基线：${entry.path} `
          + `${entry.matches.length} > ${limit}`,
        )
      }
    }
  }
  return errors
}

function workspaceFiles() {
  return execFileSync('rg', ['--files', '--hidden', '-g', '!.git/**', '-0'], {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  }).split('\0').filter(Boolean)
}

async function main() {
  const check = process.argv.slice(2).includes('--check')
  const baselineCheck = process.argv.slice(2).includes('--baseline-check')
  const summaryOnly = process.argv.slice(2).includes('--summary')
  const manifest = JSON.parse(await readFile(path.join(repoRoot, 'docs/document-manifest.json'), 'utf8'))
  const currentDocs = new Set(
    manifest.entries.filter(entry => entry.status === 'current').map(entry => entry.path),
  )
  const report = {
    production: [],
    currentDocs: [],
    historicalOrDraftDocs: [],
    testsToolsOrImporter: [],
  }

  for (const relativePath of workspaceFiles()) {
    let source
    try {
      source = await readFile(path.join(repoRoot, relativePath), 'utf8')
    } catch {
      continue
    }
    const matches = findSqliteEvidence(source)
    if (matches.length === 0) continue
    const category = classifySqliteEvidence(relativePath, currentDocs)
    report[category].push({ path: relativePath, matches })
  }

  const summary = Object.fromEntries(
    Object.entries(report).map(([category, entries]) => [category, {
      files: entries.length,
      matches: entries.reduce((sum, entry) => sum + entry.matches.length, 0),
    }]),
  )
  process.stdout.write(`${JSON.stringify(summaryOnly ? { summary } : { summary, report }, null, 2)}\n`)

  if (check && (report.production.length > 0 || report.currentDocs.length > 0)) {
    process.stderr.write('[sqlite-cleanup] production/current docs still contain SQLite evidence\n')
    process.exitCode = 1
  }
  if (baselineCheck) {
    const regressions = findSqliteBaselineRegressions(report)
    if (regressions.length) {
      process.stderr.write(`${regressions.join('\n')}\n`)
      process.exitCode = 1
    } else {
      process.stderr.write('[sqlite-cleanup] no production/current-doc regression from transitional baseline\n')
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main()
}
