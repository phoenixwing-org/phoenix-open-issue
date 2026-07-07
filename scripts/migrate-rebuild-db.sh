#!/bin/sh
# 用原生 sqlite3 从旧库 dump 重建新库（保留 passwordHash，优先于 JSON 导入）
#
# 用法（在项目根目录）：
#   sh scripts/migrate-rebuild-db.sh data/open-issue.sqlite.broken data/open-issue.sqlite
#
# 前提：宿主机已安装 sqlite3

set -e

OLD="${1:?旧库路径}"
NEW="${2:?新库路径}"

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "错误: 未找到 sqlite3，请先安装（apt install sqlite3）"
  exit 1
fi

TMP="$(mktemp)"
trap 'rm -f "$TMP"' EXIT

echo ">> 从旧库导出 SQL..."
sqlite3 "$OLD" .dump > "$TMP"

echo ">> 写入新库..."
rm -f "$NEW" "${NEW}-wal" "${NEW}-shm" "${NEW}.lock"
sqlite3 "$NEW" < "$TMP"

echo ">> 完成: $NEW"
echo ">> 请启动 node-sqlite3-wasm 服务验证；若仍失败，改用 migrate-export-backup.mjs 导出 JSON 再导入"
