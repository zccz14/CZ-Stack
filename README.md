# CZ-Stack

CZ-Stack 是一份面向新项目启动的 TypeScript monorepo 模板，当前首版基线已经落地 **Web 前端、Hono API、oclif CLI、contract 中心与 SQLite-first 的后端服务默认落地姿态**，并通过统一脚本、共享契约与分层验证入口保持协作一致。

## 模板定位

- **Balanced core + optional modules**：先交付一套足够强、可直接落地的核心基础设施，再按需叠加数据库扩展、SDK 生成、文档站等可选能力。
- **强约定基础设施，弱约定业务布局**：工具链、契约与验证流程统一；业务目录名不要求固定为 `apps/`、`packages/` 或 `services/`。
- **contract 作为单一事实源**：API、Web、CLI 与文档入口围绕同源协议工作，避免接口类型与文档双写漂移。

## 快速开始

1. 安装依赖：`pnpm install`
   - 如果使用 `pnpm install --ignore-scripts`（或 `pnpm bootstrap`），安装后需在仓库根目录额外执行一次 `pnpm exec husky`，以启用 `.husky/pre-commit`。
2. 运行仓库 lint：`pnpm lint`
3. 运行类型检查：`pnpm typecheck`
4. 运行全部测试：`pnpm test`
5. 运行构建与 smoke：`pnpm build && pnpm smoke`
6. 查看验证说明：[`docs/architecture/validation.md`](docs/architecture/validation.md)

## 模块入口

- [`modules/contract`](modules/contract) — `@cz-stack/contract`，导出 Zod schema、OpenAPI 文档与 typed client。
- [`modules/api`](modules/api) — `@cz-stack/api`，提供 `/health`、`/openapi.json`、`/docs` 等 API 入口。
- [`modules/web`](modules/web) — `@cz-stack/web`，提供消费共享 contract 的 Vite + React Web app。
- [`modules/cli`](modules/cli) — `@cz-stack/cli`，提供复用共享 client 的 oclif CLI。
- [`tests`](tests) — contract / api / cli / web 的统一验证入口。

配套文档入口：

- [`docs/architecture/module-roles.md`](docs/architecture/module-roles.md)
- [`docs/architecture/repo-conventions.md`](docs/architecture/repo-conventions.md)
- [`docs/architecture/validation.md`](docs/architecture/validation.md)
- [`docs/api/README.md`](docs/api/README.md)

## 首版模板包含能力

- pnpm workspace + TypeScript + Biome + tsdown 的统一工程基线。
- 以 `@cz-stack/contract` 为中心的 OpenAPI + Zod 同源协议层。
- Hono API、React Web、oclif CLI 三类交付形态的最小可运行实现。
- 后端服务默认优先采用 SQLite 等嵌入式存储，不预置共享 db 包。
- 当业务需要更重数据库能力时，后端服务可直接接入 Postgres 等方案。
- Vitest、Playwright、CLI smoke、Changesets 与 release-aware CI 基线。
- API 文档入口由 contract 同源驱动，API 服务内置 `/openapi.json` 与 `/docs`。

## 首版模板不包含能力

- 不强制生成 SDK；仅保留围绕 contract 扩展的位点。
- 不内置 ORM、migration 工具或其他预绑定数据层方案。
- 不强制固定目录结构，`modules/` 只是首版示例容器。
- 不覆盖 Bun-first、多语言模板或一次性预装所有增强模块的路线。

## 快速验证命令

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm smoke`
- `pnpm openapi:check`
- `pnpm release:check`

各命令的预期结果与失败排查起点见 [`docs/architecture/validation.md`](docs/architecture/validation.md)。

## 模块角色概览

仓库按“模块角色”组织，而不是强制目录名称。首版示例使用 `modules/` 作为物理容器，但约束重点始终是角色与依赖方向：

- `contract-package`：协议与类型事实源。
- `api-service`：消费 contract 的 Hono 服务，并在服务内部负责数据库接入与持久化实现。
- `web-app`：消费 contract 的浏览器应用。
- `cli-tool`：消费 contract 的命令行工具。
- `tooling-package`：共享脚本、配置与工程工具封装。
- `docs-site`：展示由 contract 同源生成的文档入口。

详细约束见：

- [`docs/architecture/module-roles.md`](docs/architecture/module-roles.md)
- [`docs/architecture/repo-conventions.md`](docs/architecture/repo-conventions.md)

当前仓库尚未接入专用 Markdown lint / link checker；文档变更除运行仓库现有命令外，还应人工核对 Markdown 链接、相对路径与命令示例是否与当前实现一致。
