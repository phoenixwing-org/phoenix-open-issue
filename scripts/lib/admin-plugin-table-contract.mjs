const createTablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:"([^"]+)"|([A-Za-z_][\w$]*))\s*\.\s*)?(?:"([^"]+)"|([A-Za-z_][\w$]*))/gi

/** Extract table definitions from immutable SQL migration artifacts. */
export function extractCreatedTables(sql) {
  const tables = []
  for (const match of sql.matchAll(createTablePattern)) {
    tables.push({
      schema: match[1] ?? match[2] ?? null,
      table: match[3] ?? match[4],
    })
  }
  return tables
}

/**
 * Require the backup ownership declaration, TypeORM entities and SQL-created
 * tables to describe one closed plugin-owned data set.
 */
export function validatePluginTableContract({ ownedTables, entityTables, migrationTables }) {
  const errors = []
  const owned = new Set(ownedTables)
  const entities = new Set(entityTables)
  const migrated = new Set()

  for (const definition of migrationTables) {
    if (definition.schema) {
      errors.push(`migration 不得创建 schema-qualified 表：${definition.schema}.${definition.table}`)
    }
    if (!/^oip_[a-z0-9_]+$/.test(definition.table)) {
      errors.push(`migration 创建了插件命名空间外的表：${definition.table}`)
      continue
    }
    migrated.add(definition.table)
    if (!owned.has(definition.table)) {
      errors.push(`migration 表未声明为插件数据/备份范围：${definition.table}`)
    }
  }

  for (const table of entities) {
    if (!owned.has(table)) errors.push(`实体表未声明为插件数据/备份范围：${table}`)
  }
  for (const table of owned) {
    if (!entities.has(table)) errors.push(`dataOwnership 表缺少插件 Entity：${table}`)
    if (!migrated.has(table)) errors.push(`dataOwnership 表缺少 migration CREATE TABLE：${table}`)
  }

  return errors
}
