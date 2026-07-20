export interface PnwCompiledSql {
  text: string
  parameterCount: number
}

const PROJECT_IDENTIFIERS = new Set([
  'users', 'orgUnits', 'issueLists', 'issueListMembers', 'issues', 'checkpoints',
  'pushRecords', 'issueListLinks', 'dict', 'systemFlags', 'poiFunctions', 'schemaMigrations',
  'externalIdentities', 'oauthLoginAttempts', 'oauthLoginTickets', 'externalBindRequests',
  'id', 'username', 'email', 'passwordHash', 'displayName', 'orgUnitId', 'approved',
  'disabled', 'systemRole', 'tokenVersion', 'createdAt', 'updatedAt', 'name', 'unitType', 'parentId',
  'description', 'listType', 'ownerId', 'archived', 'isDeleted', 'deletedAt', 'listId',
  'userId', 'role', 'joinedAt', 'issueNo', 'title', 'status', 'closeReason', 'closedBy',
  'priority', 'severity', 'category', 'detectionPhase', 'reporterId', 'assigneeId',
  'dueDate', 'completedAt', 'containment', 'rootCause', 'correctiveAction', 'sortOrder',
  'functionId', 'createdBy', 'issueId', 'checkpointDate', 'responsibleUserId',
  'fromListId', 'toListId', 'pushedBy', 'pushedAt', 'handledBy', 'handledAt',
  'rejectReason', 'note', 'attentionLevel', 'attentionUpdatedAt', 'attentionUpdatedBy',
  'linkedAt', 'linkedBy', 'groupName', 'value', 'label', 'enabled', 'tags', 'key',
  'platform', 'externalId', 'functionName', 'targetYear', 'clientGroup', 'developGroup',
  'appliedAt', 'memberCount', 'issueCount', 'ownerName', 'myRole', 'issueTitle',
  'fromListName', 'toListName', '_attentionLevel', '_functionName', '_functionPlatform',
  '_functionExternalId',
  'provider', 'providerSubject', 'tenantKey', 'openId', 'unionId', 'providerUserId',
  'avatarUrl', 'metadataJson', 'linkSource', 'linkedByUserId', 'lastLoginAt',
  'lastSyncedAt', 'revokedAt', 'purpose', 'stateHash',
  'returnTo', 'expiresAt', 'usedAt', 'failureCode', 'ticketHash',
  'identityId', 'proposedUsername', 'proposedDisplayName', 'boundUserId',
  'handledByUserId', 'handledAt', 'note', 'profileTokenHash', 'profileTokenExpiresAt',
  'lastSeenAt',
])

/**
 * 将项目统一使用的 ? 占位符转换为 PostgreSQL $1/$2。
 * 字符串、标识符、行注释、块注释和 dollar-quoted 字符串中的 ? 保持不变。
 */
export function pnwCompilePostgresParams(sql: string): PnwCompiledSql {
  let output = ''
  let parameterCount = 0
  let i = 0

  while (i < sql.length) {
    const char = sql[i]
    const next = sql[i + 1]

    if (char === "'") {
      const end = copyQuoted(sql, i, "'")
      output += sql.slice(i, end)
      i = end
      continue
    }
    if (char === '"') {
      const end = copyQuoted(sql, i, '"')
      output += sql.slice(i, end)
      i = end
      continue
    }
    if (char === '-' && next === '-') {
      const end = sql.indexOf('\n', i + 2)
      const stop = end === -1 ? sql.length : end
      output += sql.slice(i, stop)
      i = stop
      continue
    }
    if (char === '/' && next === '*') {
      const end = sql.indexOf('*/', i + 2)
      const stop = end === -1 ? sql.length : end + 2
      output += sql.slice(i, stop)
      i = stop
      continue
    }
    if (char === '$') {
      const match = sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/)
      if (match) {
        const delimiter = match[0]
        const end = sql.indexOf(delimiter, i + delimiter.length)
        const stop = end === -1 ? sql.length : end + delimiter.length
        output += sql.slice(i, stop)
        i = stop
        continue
      }
    }
    if (char === '?') {
      parameterCount++
      output += `$${parameterCount}`
      i++
      continue
    }
    if (/[A-Za-z_]/.test(char)) {
      let end = i + 1
      while (end < sql.length && /[A-Za-z0-9_]/.test(sql[end])) end++
      const token = sql.slice(i, end)
      output += PROJECT_IDENTIFIERS.has(token) ? `"${token}"` : token
      i = end
      continue
    }

    output += char
    i++
  }

  return { text: output, parameterCount }
}

function copyQuoted(sql: string, start: number, quote: "'" | '"'): number {
  let i = start + 1
  while (i < sql.length) {
    if (sql[i] === quote) {
      if (sql[i + 1] === quote) {
        i += 2
        continue
      }
      return i + 1
    }
    i++
  }
  return sql.length
}
