# 第三方登录设计目录

更新时间：2026-07-16

## 目标

在保留现有账号密码登录、用户审批、禁用和权限体系的前提下，引入可扩展的第三方登录能力。第一家提供方考虑飞书，后续可以用相同接口接入其他 OAuth/OIDC 提供方。

本目录记录已经落地的实现、配置方法和后续验收边界，不包含真实应用密钥；未启用或配置不完整时，登录页不会显示飞书入口。

## 实现状态

2026-07-16 已完成首期代码：

- 通用第三方身份、OAuth 事务和一次性登录票据数据模型。
- SQLite 与 PostgreSQL 建表/迁移适配。
- 飞书授权链接、授权码换票、用户信息读取和租户白名单校验。
- 已有本地账号绑定、精确身份登录、用户解绑和管理员撤销。
- 登录页、OAuth 回调页、设置“登录方式”和组织人员管理入口。
- 长期身份绑定进入完整备份；临时 OAuth 数据和飞书令牌不进入备份。
- 默认关闭、启动配置校验、站内返回地址白名单、基础限流和自动化测试。

真实飞书端到端验收仍需要在开放平台创建测试应用、配置回调地址并提供测试租户 `tenant_key`。本地已经用隔离实例验证启用/关闭、授权链接生成和接口安全规则。

## 当前结论

1. 首期采用“绑定已有账号”模式：用户先登录本系统，再到“登录方式”中绑定飞书。绑定完成后才允许使用飞书登录。
2. 第三方身份与本地用户是一对多关系：一个本地用户可以绑定多个提供方身份；同一个飞书身份只能绑定一个本地用户。
3. 使用 `tenant_key + open_id` 作为飞书应用内的稳定身份主体，并同时记录 `union_id`、`user_id` 等快照用于排查和未来扩展。
4. 不按邮箱、手机号、姓名自动关联现有账号。飞书文档说明邮箱和手机号来自管理员导入，并非实时验证信息，不能据此安全地自动认领账号。
5. 登录用途只临时使用飞书用户访问令牌读取身份，读取后立即丢弃，不保存 access token 或 refresh token。
6. 飞书授权码不是配置项。它由飞书回调临时返回，有效期短且只能使用一次，必须由服务端立即交换令牌，不能写入配置、数据库长期保存或日志。
7. 飞书不可用时不影响本地账号密码登录。

## 目录内容

- [飞书OAuth设计.md](./飞书OAuth设计.md)：完整流程、账号关联策略、接口和安全约束。
- [配置示例.md](./配置示例.md)：服务端配置项、控制台设置和密钥管理要求。
- [数据模型.sql](./数据模型.sql)：兼容当前 SQLite/PostgreSQL 迁移方式的数据表草案。
- [实施清单.md](./实施清单.md)：分阶段开发、测试和验收清单。

## 当前首期范围

当前版本完成以下闭环：

1. 管理员在服务端配置飞书应用和允许登录的租户。
2. 已登录用户发起绑定，服务端记录一次性 OAuth 事务。
3. 回调后精确绑定飞书身份与当前本地用户。
4. 登录页在配置有效时显示“使用飞书登录”。
5. 已绑定身份可登录；未绑定身份只提示先绑定或联系管理员，不自动创建或合并账号。
6. 用户可以查看和解除绑定；解除最后一种可用登录方式时必须阻止操作。
7. 管理员可以查看用户绑定状态并撤销异常绑定。

自动创建用户、组织同步、通讯录同步和代表用户调用飞书开放平台都不属于首期范围。

## 与现有项目的衔接点

- 继续由本项目签发 JWT；飞书令牌不替代本项目会话。
- 飞书登录成功后仍检查 `approved`、`disabled` 和 `tokenVersion`。
- 撤销绑定、禁用用户和管理员强制退出时，按现有规则递增 `tokenVersion`。
- 新表需要同时加入 SQLite 与 PostgreSQL 迁移，并纳入完整备份；OAuth 临时事务和任何令牌不得进入用户数据导出。
- Provider 代码位于 `packages/server/src/auth/providers/`，飞书请求格式集中在 `FeishuAuthProvider`，通用事务和本地账号关联由 `ExternalAuthService` 处理。

## 官方资料

- [获取 OAuth 授权码](https://open.feishu.cn/document/authentication-management/access-token/obtain-oauth-code?lang=zh-CN)
- [网页应用免登流程](https://open.feishu.cn/document/common-capabilities/sso/web-application-end-user-consent/guide)
- [获取登录用户信息](https://open.feishu.cn/document/server-docs/authentication-management/login-state-management/get)
- [用户 ID 类型说明](https://open.feishu.cn/document/contact-v3/user/batch?lang=zh-CN)
- [权限列表](https://open.feishu.cn/document/server-docs/application-scope/scope-list)
