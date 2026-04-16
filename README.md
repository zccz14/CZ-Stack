# CZ-Stack

CZ-Stack 是一份面向新项目启动的 TypeScript monorepo 模板，当前基线聚焦 **contract / API / Web / CLI** 四类核心模块，以及围绕它们组织的统一验证与发布流程。

## 核心口径

- `modules/contract/openapi/openapi.yaml` 是仓库内唯一可手工维护的 OpenAPI 事实源。
- 若部署环境对外提供 `/openapi.yaml`，那只是这份事实源的发布形态，不是另一份定义。
- `/openapi.json` 是从同一份契约导出的消费/传输形态，便于 API 运行时直接暴露 JSON 文档，但它不是事实源。
- 仓库不再内置 `modules/docs` 项目，也不再内置文档站点构建流程。

## 模板定位

- **面向 AI Agent 的最小开发闭环**：从 worktree、验证、提交、PR、checks 到合并与清理，形成可持续推进的自动化交付链路。
- **OpenAPI / contract 中心化**：API、Web、CLI 都围绕同一份 contract 工作，避免类型、测试输入输出与接口描述漂移。
- **SQLite-first 的后端默认姿态**：默认鼓励服务内部直接管理轻量存储，但不排斥按需升级到更重的数据方案。

## 环境前提

- Node.js 24 LTS+
- pnpm 10.15.0+

以下命令默认在仓库根目录执行。

## 快速开始

1. 安装依赖：`pnpm install`
   - 若使用 `pnpm install --ignore-scripts`（或 `pnpm bootstrap`），安装后需再执行一次 `pnpm exec husky` 启用 `.husky/pre-commit`。
2. 运行 lint：`pnpm lint`
3. 运行类型检查：`pnpm typecheck`
4. 运行测试：`pnpm test`
5. 运行构建与 smoke：`pnpm build && pnpm smoke`
6. 校验 OpenAPI 产物：`pnpm openapi:check`

## 模块入口

- [`modules/contract`](modules/contract) — `@cz-stack/contract`，维护 OpenAPI、Zod schema、shared client 与相关导出。
- [`modules/api`](modules/api) — `@cz-stack/api`，提供 `/health` 与 `/openapi.json` 等运行时入口。
- [`modules/web`](modules/web) — `@cz-stack/web`，消费共享 contract 的 Vite + React Web 应用。
- [`modules/cli`](modules/cli) — `@cz-stack/cli`，消费共享 contract 的 oclif CLI。
- [`tests`](tests) — contract / api / cli / repo / web 的统一验证入口。

配套文档入口：

- [`docs/architecture/module-roles.md`](docs/architecture/module-roles.md)
- [`docs/architecture/repo-conventions.md`](docs/architecture/repo-conventions.md)
- [`docs/architecture/validation.md`](docs/architecture/validation.md)
- [`docs/api/README.md`](docs/api/README.md)

## API 文档如何对外消费

推荐把 `modules/contract/openapi/openapi.yaml` 直接作为发布源对外托管；如果部署后提供 `/openapi.yaml`，该地址就是事实源文件的线上镜像。

当前仓库中的 API 服务仍保留 `/openapi.json`，用于直接暴露由 contract 导出的 JSON 版本，方便服务内集成、联调或工具消费。无论 YAML 还是 JSON，来源都必须回到同一份 `modules/contract/openapi/openapi.yaml`。

仓库本身不再维护内置文档站点；如需展示层，应由仓库外或未来独立入口读取 `/openapi.yaml` 或 `/openapi.json`，而不是在仓库内再维护一套文档站实现。

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

- `contract-package`：协议与类型事实源。
- `api-service`：消费 contract 的 HTTP 服务，并导出 `/openapi.json`。
- `web-app`：消费 contract 的浏览器应用。
- `cli-tool`：消费 contract 的命令行工具。
- `tooling-package`：共享脚本、配置与工程工具封装。

详细约束见：

- [`docs/architecture/module-roles.md`](docs/architecture/module-roles.md)
- [`docs/architecture/repo-conventions.md`](docs/architecture/repo-conventions.md)

当前仓库尚未接入专用 Markdown lint / link checker；文档变更除运行仓库现有命令外，还应人工核对 Markdown 链接、相对路径与命令示例是否与当前实现一致。
