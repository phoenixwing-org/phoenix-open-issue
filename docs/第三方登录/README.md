# 第三方登录设计目录

更新时间：2026-07-20

## 目标

在保留现有账号密码登录、用户审批、禁用和权限体系的前提下，提供可扩展的第三方登录。第一家提供方为飞书；后续 OAuth/OIDC 共用同一套身份表与待审查队列表（按 `provider` 区分）。

本目录记录已落地实现、配置与验收边界，不含真实应用密钥。未启用或配置不完整时，登录页不显示飞书入口。

## 实现状态（归档：2026-07-20）

### 首期（2026-07-16）

- 通用第三方身份、OAuth 事务、一次性登录票据。
- PostgreSQL 版本化建表与迁移；飞书换票与租户白名单。旧本地数据库兼容只保留在历史导入边界。
- 精确身份登录、用户解绑、管理员撤销；备份不含令牌。

### 二期：管理员绑定 + 待审查（2026-07-20，已落地）

- 取消用户自助绑定；未绑定飞书登录写入 `externalBindRequests`。
- 用户可补填拟用用户名/姓名；管理员在组织页绑定已有账号或新建并绑定（`approved=1`，须设初始密码）。
- 迁移 `20260720-external-bind-requests`；设置 → 数据库修正 →「表结构补全」幂等校验上述表（「全部执行」会先跑此项）。
- 自动化覆盖待审查、绑定、新建撞名、备份、登录策略；**真实飞书端到端点检已通过**（2026-07-21，见 [飞书登录点检用例.md](./飞书登录点检用例.md)）。

设计与勾选清单见 [管理员绑定与待审查计划.md](./管理员绑定与待审查计划.md)（状态：已完成 / 归档）。

## 当前产品结论

1. **绑定仅管理员**：飞书登录未绑定 → 待审查；不自动建号、不按邮箱/姓名认领。
2. 本地用户仍是权限与组织唯一主体；飞书只作登录凭证。
3. 身份键：`provider + providerSubject`（飞书为 `tenant_key:open_id`）。
4. 不保存飞书 access / refresh token；授权码仅服务端一次性换票。
5. 飞书关闭时本地密码登录不受影响；**尚无**「禁用本地密码、仅允许飞书」开关。
6. 多提供方共用 `externalIdentities` 与 `externalBindRequests`，不要按系统拆业务表。

## 目录内容

| 文档 | 说明 | 状态 |
| --- | --- | --- |
| [管理员绑定与待审查计划.md](./管理员绑定与待审查计划.md) | 二期流程、表结构、接口与验收（已落地归档） | 已完成 |
| [飞书OAuth设计.md](./飞书OAuth设计.md) | 安全原则与协议细节；§3.1 自助绑定已被二期取代 | current（部分 superseded） |
| [飞书登录点检用例.md](./飞书登录点检用例.md) | 测试员手工点检步骤（TC-01～TC-10）；2026-07-21 全部通过 | current |
| [配置示例.md](./配置示例.md) | 环境变量与密钥管理 | current |
| [数据模型.sql](./数据模型.sql) | 含 `externalBindRequests` 的表草案 | current |
| [实施清单.md](./实施清单.md) | 分阶段勾选；真实飞书点检已通过 | draft |

## 操作入口（实现侧）

- 登录页：飞书登录 → 未绑定进入待审查补填页。
- 组织架构：管理员「第三方登录待审查」。
- 设置 → 登录方式：查看/解除已绑定身份（不可自助绑定）。
- 设置 → 数据库修正 → 表结构补全 / 全部执行：幂等补建第三方登录表。

## 与现有项目的衔接

- JWT 仍由本项目签发；飞书登录后仍校验 `approved` / `disabled` / `tokenVersion`。
- Provider：`packages/server/src/auth/providers/`；编排：`ExternalAuthService`。
- 长期身份与待审查进入完整备份；`oauthLoginAttempts` / `oauthLoginTickets` 不进备份。

## 官方资料

- [获取 OAuth 授权码](https://open.feishu.cn/document/authentication-management/access-token/obtain-oauth-code?lang=zh-CN)
- [网页应用免登流程](https://open.feishu.cn/document/common-capabilities/sso/web-application-end-user-consent/guide)
- [获取登录用户信息](https://open.feishu.cn/document/server-docs/authentication-management/login-state-management/get)
- [用户 ID 类型说明](https://open.feishu.cn/document/contact-v3/user/batch?lang=zh-CN)
- [权限列表](https://open.feishu.cn/document/server-docs/application-scope/scope-list)
