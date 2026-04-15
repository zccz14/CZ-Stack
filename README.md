# CZ-Stack

CZ-Stack 是一份面向新项目启动的 TypeScript monorepo 模板，当前首版基线已经落地 **Web 前端、Hono API、oclif CLI、contract 中心与 SQLite-first 的后端服务默认落地姿态**，并通过统一脚本、共享契约与分层验证入口保持协作一致。

**支持的业务交付形态：**

- 前端 Web：Vite + React 静态站点
- 后端 Service：Hono + SQLite-first
- CLI 工具：oclif
- API & SDK: OpenAPI Schema-first + Zod Schema + Playground
- Library：纯 TypeScript 包，通过 npm 发布

**为什么要做这个模板？**

固然，每个项目都单独配置一套技术栈和开发流程是完全可行的，甚至是更有利于跟进潮流的。然而，配置 Infra 的成本和复杂度不容忽视，动辄数十个小时的初始设置和 AI 开发量，对于很多快速试验项目而言非常不值得。由于它的变化速度较慢，而且是工程中的必需品，它是非常值得被复用、缓存、迭代的。

**设计要点：**

- **面向 AI Agent 重新设计**。深刻把握 AI 与人类开发者的区别。以面向 AI Agent 的流程、契约与验证为核心，构建适合 AI Agent 协作的开发环境。实现黑灯工厂式的 AI Agent 开发体验。以人类开发者不写一行代码、不审查一行代码、AI Agent 全权负责开发的目标，重新设计开发流程与工具链。
- **最小开发闭环**。从基线 origin/main 开 Git WorkTree 到验证基线、探索、开发、测试、提 GitHub PR、处理 review 和 checks，一旦通过所有自动检查就可以立即合并，直到 PR 合并，清理 WorkTree 并刷新主工作区本地基线的整个流程，形成一个**无人干预的可并行的最小闭环**。AI Agent 通过持续推进这个闭环，完成从需求到交付的全流程开发任务。
- **技术选型应对小型化业务上下文设计**。在 AI 时代，大部分 App 都是麻雀式的小型应用，适合快速开发、推广、迭代和废弃。然而，小型不意味着质量门槛可以降低，反而要求更高的开发效率和更高的质量保障，以及更开放的生态接入。
- **线性发布与快速迭代**。线性发布意味着没有复杂的版本管理和兼容性维护，一切变更都直接发布到生产环境上。出了问题直接修复并再次发布新版本即可。对于黑灯工厂来说，不可能在预发布阶段引入额外的人工来发现相比于开发环境更多的问题，因此不如追求极致的发布效率和快速迭代能力，来应对不可避免的生产问题。
- **为什么要 SQLite-First**？有很多原因，但最关键的是**影响面受控**。因为迭代自动化以后，降低业务影响面是非常重要的。一个大而全的数据库，可能会因为一个 Migration 的问题导致整个数据库不可用，影响所有业务线。而 SQLite-First 的方案，每个服务都可以独立维护一个轻量级的数据库，业务之间没有直接的耦合关系，某个服务的数据库出了问题，不会直接影响到其他服务的可用性。麻烦之处在于，开发者需要运维多个分散各处的数据库，但这在 AI 时代是完全可以接受的。SQLite 能够从容应对大多数业务挑战，而极少数业务，则可以采用特殊的方案解决。即便是未来数据量暴增了，再迁移到 PostgreSQL 也就是一个 Migration 的事了，不会有太大问题。

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
