# 方式 C：SQL dump 重建数据库

将 **better-sqlite3** 时代的旧库迁移到 **node-sqlite3-wasm**，通过宿主机原生 `sqlite3` 导出 SQL 再写入全新库文件。

- 保留原有数据与用户密码（不经过 JSON 导入）
- 数据库路径与 `pnpm dev` 一致：`data/open-issue.sqlite`（相对项目根目录）

---

## 前提

- 已在 **1Panel / Linux 服务器**上，项目目录一般为 `/www/wwwroot/phoenix-open-issue`（容器内为 `/app`）
- 已安装 `sqlite3` CLI
- 迁移前 **停止** 运行环境，避免并发写库

```bash
# 安装 sqlite3（Debian/Ubuntu）
apt update && apt install -y sqlite3

# 验证
sqlite3 --version
```

---

## 步骤

### 1. 进入项目根目录

```bash
cd /www/wwwroot/phoenix-open-issue
# 容器内则为：
# cd /app
```

### 2. 停止服务

在 1Panel 中停止 `phoenix-open-issue` 运行环境，或停止对应容器。

### 3. 备份旧库

```bash
cp data/open-issue.sqlite data/open-issue.sqlite.bak.$(date +%Y%m%d)
mv data/open-issue.sqlite data/open-issue.sqlite.broken
rm -f data/open-issue.sqlite-wal data/open-issue.sqlite-shm data/open-issue.sqlite.lock
```

### 4. 执行重建

**推荐：使用脚本**

```bash
# 若脚本报错 set: Illegal option -，先去掉 Windows 换行符
sed -i 's/\r$//' scripts/migrate-rebuild-db.sh

sh scripts/migrate-rebuild-db.sh \
  data/open-issue.sqlite.broken \
  data/open-issue.sqlite
```

**或：直接执行命令（等价）**

```bash
TMP=$(mktemp)
sqlite3 data/open-issue.sqlite.broken .dump > "$TMP"
rm -f data/open-issue.sqlite data/open-issue.sqlite-wal data/open-issue.sqlite-shm data/open-issue.sqlite.lock
sqlite3 data/open-issue.sqlite < "$TMP"
rm -f "$TMP"
echo "完成"
```

### 5. 构建并启动

```bash
pnpm install
pnpm dev
```
然后在 1Panel 中启动服务。

---

## 验证

启动后日志应类似：

```text
Database already has data, skipping seed.
Open Issue List Server running at http://0.0.0.0:3400
Database: /app/data/open-issue.sqlite
Mode:     unified (API + static)
```

检查项：

1. 浏览器访问 `http://服务器IP:3400`
2. 使用 **原账号密码** 登录
3. 抽查 lists、issues 等业务数据

---

## 失败时

若重建后仍报 `SQLite3Error: unable to open database file`，改用 **方式 D**（JSON 导出/导入）：

```bash
node scripts/migrate-export-backup.mjs data/open-issue.sqlite.broken > /tmp/backup-old.json
```

详见 `migrate-export-backup.mjs` 文件头注释。JSON 导入会重置所有用户密码为 `123456`。

---

## 回滚

```bash
# 停服务后
cp data/open-issue.sqlite.bak.YYYYMMDD data/open-issue.sqlite
# 恢复旧版代码与启动方式后再启动
```
