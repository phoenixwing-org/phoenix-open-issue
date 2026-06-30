import type Database from 'better-sqlite3'

export function runSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT,
      passwordHash TEXT NOT NULL,
      displayName TEXT,
      orgUnitId TEXT,
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
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved','closed','cancelled')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low','medium','high','critical')),
      severity TEXT NOT NULL DEFAULT 'minor' CHECK(severity IN ('fatal','major','minor','trivial')),
      reporterId TEXT,
      assigneeId TEXT,
      dueDate TEXT,
      completedAt TEXT,
      closeReason TEXT CHECK(closeReason IN ('completed','cancelled','duplicate','transferred','unreproducible')),
      closedBy TEXT,
      sortOrder INTEGER DEFAULT 0,
      createdBy TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

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
  `)
}
