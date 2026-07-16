# Linux 测试部署

> 适用于 v0.4.0 内部测试。建议 Node.js 20、pnpm 9、单机 SQLite。

## 1. 构建检查

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm install --frozen-lockfile
pnpm test
pnpm build
```

发布基线要求：测试和构建均成功；PostgreSQL 专用用例在未配置测试库时会明确跳过。

## 2. 配置

SQLite 部署：

```bash
cp packages/server/.env.sqlite.example packages/server/.env
```

PostgreSQL 部署请使用 `packages/server/.env.postgres.example`，具体步骤见 [PostgreSQL 部署与迁移](PostgreSQL部署与迁移.md)。

至少修改：

```dotenv
PORT=3400
JWT_SECRET=替换为足够长的随机字符串
INITIAL_ADMIN_PASSWORD=替换为至少12位的强密码
DB_PATH=/var/lib/open-issue/open-issue.sqlite
SERVE_STATIC=true
STATIC_DIR=../web/dist
```

创建持久化目录，并保证运行用户有读写权限：

```bash
sudo install -d -o openissue -g openissue /var/lib/open-issue
```

## 3. 启动

构建后 server 会同时托管 API 和前端静态文件：

```bash
pnpm start
```

健康检查：

```bash
curl http://127.0.0.1:3400/health
# {"status":"ok"}
```

## 4. systemd 示例

```ini
[Unit]
Description=Open Issue List
After=network.target

[Service]
Type=simple
User=openissue
WorkingDirectory=/opt/phoenix-open-issue
ExecStart=/usr/bin/pnpm start
Restart=on-failure
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

## 5. 上线前检查

1. 配置至少 12 位的 `INITIAL_ADMIN_PASSWORD`；它也是无密码备份导入后的重置密码。
2. 使用至少 32 位的随机 `JWT_SECRET`，不要提交 `.env`。生产启动会拒绝示例值和弱值。
3. 通过设置页导出一次数据库备份并验证可恢复。
4. 确认 `/var/lib/open-issue` 位于持久化磁盘。
5. 不执行 `pnpm seed force`，该命令会重建演示数据。
6. 升级前复制 SQLite 主文件及 `-wal`、`-shm`，或先停止服务再备份。

## 6. 升级流程

```bash
sudo systemctl stop open-issue
cp /var/lib/open-issue/open-issue.sqlite /var/lib/open-issue/open-issue.sqlite.bak
git pull
pnpm install --frozen-lockfile
pnpm test && pnpm build
sudo systemctl start open-issue
curl http://127.0.0.1:3400/health
```

应用启动时会运行幂等数据库迁移。出现迁移警告时，进入“设置 → 数据库修正”处理，不要直接删除数据库。
