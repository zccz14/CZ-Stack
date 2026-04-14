# 模块角色约定

本文定义 CZ-Stack 模板中的模块角色、允许依赖方向，以及必须禁止的反向依赖规则。约束重点是角色边界，而不是固定目录名称。

以下角色是模板目标状态下的约定；当前仓库仍处于 root tooling + docs baseline 阶段，尚未实现全部角色模块。

## 角色清单

### `contract-package`

- 职责：维护 OpenAPI、Zod schema、共享类型、未来 SDK 生成位点。
- 允许依赖：仅允许依赖极少量与协议表达直接相关的基础库。
- 被谁依赖：`api-service`、`web-app`、`cli-tool`、`docs-site`、`tooling-package`。
- 禁止：反向依赖任何应用层、服务层、数据库层或文档展示实现。

### `api-service`

- 职责：基于 contract 暴露 HTTP API、组装运行时依赖、接入数据边界。
- 允许依赖：`contract-package`、`db-adapter`、必要的 `tooling-package`。
- 被谁依赖：通常只被运行入口、测试与部署配置消费。
- 禁止：要求 `contract-package` 反向依赖服务实现；禁止把 Web/CLI 运行时逻辑下沉进 API 服务。

### `web-app`

- 职责：提供浏览器端界面，复用 contract 定义的接口类型与错误模型。
- 允许依赖：`contract-package`、必要的 `tooling-package`。
- 被谁依赖：通常只被前端构建与测试入口消费。
- 禁止：反向驱动 `contract-package`、`api-service` 或 `db-adapter` 的设计。

### `cli-tool`

- 职责：提供命令行交互，复用 contract 与共享客户端能力。
- 允许依赖：`contract-package`、必要的 `tooling-package`。
- 被谁依赖：通常只被 CLI 运行入口、测试与发布流程消费。
- 禁止：要求 API 或 contract 为 CLI 专门维护第二套协议定义。

### `db-adapter`

- 职责：定义 SQLite-first 的数据访问边界与默认适配实现，不预绑定 ORM。
- 允许依赖：数据库驱动、必要的基础库、少量 `tooling-package`。
- 被谁依赖：`api-service` 或其他需要数据访问能力的服务模块。
- 禁止：反向依赖 `api-service`、`web-app`、`cli-tool`；禁止把具体业务 HTTP 语义写入数据库边界。

### `tooling-package`

- 职责：沉淀共享脚本、工程配置 helper、生成命令或验证工具。
- 允许依赖：基础工程依赖，必要时可依赖 `contract-package` 做生成或校验。
- 被谁依赖：任意模块按需消费。
- 禁止：承载业务运行时核心逻辑；禁止通过工具层反向要求应用层提供实现细节。

### `docs-site`

- 职责：展示 README、架构说明与由 contract 同源生成的 API 文档。
- 允许依赖：`contract-package`、必要的 `tooling-package`。
- 被谁依赖：通常只被文档部署流程消费。
- 禁止：维护第二份手写 API 规范；禁止让 contract 依赖 docs-site 的展示实现。

## 依赖方向

推荐依赖方向如下：

```text
contract-package -> shared protocol source
api-service -----> contract-package, db-adapter, tooling-package
web-app ---------> contract-package, tooling-package
cli-tool --------> contract-package, tooling-package
docs-site -------> contract-package, tooling-package
db-adapter ------> base libraries only
tooling-package -> base libraries / optional contract-package
```

## 禁止反向依赖规则

1. `contract-package` 不得反向依赖 `api-service`、`web-app`、`cli-tool`、`db-adapter` 或 `docs-site`。
2. `db-adapter` 不得反向依赖任何上层交付模块。
3. `docs-site` 只能展示由 contract 同源生成的内容，不得成为协议事实源。
4. `web-app` 与 `cli-tool` 可以消费 contract，但不得要求 contract 为各自维护分叉协议。
5. `tooling-package` 可以服务多角色模块，但不得吸收应用层专属业务逻辑，避免形成隐式反向依赖。

## 落地判断标准

- 当目录或包名发生变化时，只要角色职责与依赖方向仍满足上述规则，即视为符合模板约定。
- 当新增模块时，应先判定其角色，再决定它依赖哪些既有角色，而不是先套用固定物理目录名。
