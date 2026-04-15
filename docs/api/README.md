# API 文档入口说明

CZ-Stack 的 API 文档入口必须与 `contract-package` **同源生成**，而不是维护第二份手写规范。

当前仓库已经落地 `@cz-stack/contract` 与 `@cz-stack/api`：

- `@cz-stack/contract` 导出 OpenAPI 文档、Zod schema 与共享 client。
- `@cz-stack/api` 提供 `/openapi.json` 文档数据入口，不再内置 `/docs` 展示页面。

因此，本文说明的是**当前基线如何访问和维护 API 文档数据入口**，以及文档展示职责不属于 API 服务本身。

## 基本原则

1. `contract-package` 是协议事实源，负责导出 OpenAPI 描述、Zod schema 与共享类型。
2. `api-service` 应直接消费这份 contract，保证运行实现与文档描述不漂移。
3. `docs-site` 或其他展示入口只负责渲染、托管与导航，不负责重新编写 API 规范。
4. SDK 生成若后续接入，也只能围绕 contract 扩展，不能另起一份 API 描述。

## 推荐展示链路

```text
contract-package (OpenAPI + Zod)
        -> export openApiDocument
        -> api-service exposes /openapi.json
        -> README / docs-site link to the exported OpenAPI document
```

## 当前仓库的实际入口

- 合同文档源：`modules/contract/src/openapi.ts`
- API 文档 JSON：`modules/api` 启动后访问 `/openapi.json`
- API 文档展示：应由 API 之外的独立文档入口承载
- 仓库导航入口：[`../../README.md`](../../README.md) 与 [`../architecture/validation.md`](../architecture/validation.md)

如果需要本地检查当前 API 侧文档出口，可先运行 `PORT=3100 pnpm --filter ./modules/api run dev`，再访问 `http://localhost:3100/openapi.json`。

## 为什么不维护第二份手写规范

- 手写规范容易与服务实现、类型定义和测试输入输出产生漂移。
- contract 同源生成可以让 Web、API、CLI、文档展示共享同一套协议定义。
- 未来若接入 SDK 生成，也应继续围绕 contract 扩展，而不是新增独立文档事实源。

## 首版落地要求

- 在 contract 模块中保留 OpenAPI 文档导出入口。
- API 文档链接应指向由 contract 生成或导出的结果。
- README 与架构文档只说明入口与生成方式，不复制手写接口细节。
- `pnpm openapi:check` 应持续通过，确保 contract 导出的 OpenAPI 文档与 API 暴露入口没有脱节。

## 非目标

- 不在仓库文档中复制一份手写 endpoint 说明。
- 不要求首版必须生成独立 SDK 包。
- 不把任何 API 内置展示实现视为协议事实源；真实事实源仍然是 contract 导出。
