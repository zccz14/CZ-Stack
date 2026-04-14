# CZ-Stack

CZ-Stack 是一份面向新项目启动的 TypeScript monorepo 模板，目标是逐步覆盖 **Web 前端、Hono API、oclif CLI** 三类核心交付形态，并通过共享 contract、统一工具链与验证入口保持协作一致。

## 模板定位

- **Balanced core + optional modules**：先交付一套足够强、可直接落地的核心基础设施，再按需叠加数据库、SDK 生成、文档站等可选模块。
- **强约定基础设施，弱约定业务布局**：工具链、契约与验证流程统一；业务目录名不要求固定为 `apps/`、`packages/` 或 `services/`。
- **contract 作为单一事实源**：API、Web、CLI 与文档入口围绕同源协议工作，避免接口类型与文档双写漂移。

## 快速开始

当前仓库仅完成 root tooling + docs baseline；具体模块实现会在后续任务中逐步落地。

1. 安装依赖：`pnpm install`
2. 运行基础校验：`pnpm validate`
3. 查看仓库角色说明：`docs/architecture/module-roles.md`
4. 查看仓库组织约定：`docs/architecture/repo-conventions.md`
5. 查看 API 文档入口说明：`docs/api/README.md`

## 模块角色概览

仓库按“模块角色”组织，而不是强制目录名称。首版示例使用 `modules/` 作为物理容器，但约束重点始终是角色与依赖方向：

- `contract-package`：协议与类型事实源。
- `api-service`：消费 contract 的 Hono 服务。
- `web-app`：消费 contract 的浏览器应用。
- `cli-tool`：消费 contract 的命令行工具。
- `db-adapter`：SQLite-first 的数据边界与适配实现。
- `tooling-package`：共享脚本、配置与工程工具封装。
- `docs-site`：展示由 contract 同源生成的文档入口。

详细约束见：

- `docs/architecture/module-roles.md`
- `docs/architecture/repo-conventions.md`

## 验证入口

- `pnpm lint`：仓库级格式与静态检查。
- `pnpm typecheck`：仓库级 TypeScript 检查。
- `pnpm test`：模块级测试入口聚合。
- `pnpm build`：模块级构建入口聚合。
- `pnpm smoke`：命令行 smoke 检查入口。
- `pnpm validate`：当前基础验证组合命令。

这些根级聚合命令已预留，但覆盖范围仍有限；在后续模块任务落地前，部分命令只会校验当前已存在的 root baseline。

当前专用 Markdown lint 尚未落地；文档变更应至少通过仓库现有校验命令，并人工核对文档链接、路径与命令是否一致。
