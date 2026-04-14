# API 文档入口说明

CZ-Stack 的 API 文档入口必须与 `contract-package` **同源生成**，而不是维护第二份手写规范。

当前仓库尚未产出 contract 包或可渲染的 API 文档 artifact；本文说明的是后续任务必须满足的入口与生成原则。

## 基本原则

1. `contract-package` 是协议事实源，负责导出 OpenAPI 描述、Zod schema 与共享类型。
2. `api-service` 应直接消费这份 contract，保证运行实现与文档描述不漂移。
3. `docs-site` 或其他展示入口只负责渲染、托管与导航，不负责重新编写 API 规范。

## 推荐展示链路

```text
contract-package (OpenAPI + Zod)
        -> generate/export OpenAPI document
        -> api-service exposes docs endpoint or artifact
        -> docs-site / README links to rendered API docs
```

## 为什么不维护第二份手写规范

- 手写规范容易与服务实现、类型定义和测试输入输出产生漂移。
- contract 同源生成可以让 Web、API、CLI、文档展示共享同一套协议定义。
- 未来若接入 SDK 生成，也应继续围绕 contract 扩展，而不是新增独立文档事实源。

## 首版落地要求

- 在 contract 模块中保留 OpenAPI 文档导出入口。
- API 文档链接应指向由 contract 生成或导出的结果。
- README 与架构文档只说明入口与生成方式，不复制手写接口细节。

当前仓库的文档目标是先明确入口与生成原则；具体 contract 导出、API 文档产物与展示实现将在后续模块任务中接入。
