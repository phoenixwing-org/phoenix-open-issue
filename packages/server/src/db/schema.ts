import type { PnwDbAdapter } from 'phoenix-wing/db/pnwDbAdapter'
import { ensurePendingOrgUnit } from '../utils/pendingOrgUnit.js'

export function runSchema(db: PnwDbAdapter): void {
  // ---- 迁移：列增量添加 ----
  const migrations = [
    `ALTER TABLE users ADD COLUMN approved INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE issueLists ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE dict ADD COLUMN tags TEXT NOT NULL DEFAULT ''`,
  ]
  for (const sql of migrations) {
    try { db.exec(sql) } catch { /* column already exists */ }
  }

  // ---- 建表 ----
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      passwordHash TEXT NOT NULL,
      displayName TEXT,
      orgUnitId TEXT,
      approved INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orgUnits (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unitType TEXT NOT NULL CHECK(unitType IN ('group','department','division')),
      parentId TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS issueLists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      listType TEXT NOT NULL CHECK(listType IN ('yearly','monthly','project','custom')),
      ownerId TEXT NOT NULL,
      orgUnitId TEXT,
      archived INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS issueListMembers (
      id TEXT PRIMARY KEY,
      listId TEXT NOT NULL,
      userId TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor' CHECK(role IN ('owner','admin','editor','reporter','viewer')),
      joinedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS issues (
      id TEXT PRIMARY KEY,
      listId TEXT NOT NULL,
      issueNo TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','closed','cancelled')),
      closeReason TEXT,
      closedBy TEXT,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
      severity TEXT NOT NULL DEFAULT 'minor',
      category TEXT,
      detectionPhase TEXT,
      reporterId TEXT,
      assigneeId TEXT,
      dueDate TEXT,
      completedAt TEXT,
      containment TEXT DEFAULT '',
      rootCause TEXT DEFAULT '',
      correctiveAction TEXT DEFAULT '',
      sortOrder INTEGER DEFAULT 0,
      createdBy TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_issues_issueNo ON issues(listId, issueNo);
    CREATE INDEX IF NOT EXISTS idx_issues_category ON issues(listId, category);
    CREATE INDEX IF NOT EXISTS idx_issues_detectionPhase ON issues(listId, detectionPhase);

    CREATE TABLE IF NOT EXISTS checkpoints (
      id TEXT PRIMARY KEY,
      issueId TEXT NOT NULL,
      checkpointDate TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','done','skipped')),
      responsibleUserId TEXT,
      sortOrder INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pushRecords (
      id TEXT PRIMARY KEY,
      fromListId TEXT NOT NULL,
      toListId TEXT NOT NULL,
      issueId TEXT NOT NULL,
      pushedBy TEXT NOT NULL,
      pushedAt TEXT DEFAULT (datetime('now')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected')),
      handledBy TEXT,
      handledAt TEXT,
      rejectReason TEXT,
      note TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS dict (
      id TEXT PRIMARY KEY,
      groupName TEXT NOT NULL,
      value TEXT NOT NULL,
      label TEXT NOT NULL,
      sortOrder INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now'))
    );
  `)

  ensurePendingOrgUnit(db)
}
