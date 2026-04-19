# Global CORS For API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 `@cz-stack/api` 的全部路由启用全局开放 CORS，固定返回 `Access-Control-Allow-Origin: *`，统一处理浏览器 `OPTIONS` 预检，并在文档中明确 CORS 不是后端访问控制机制。

**Architecture:** 在 `modules/api/src/app.ts` 的应用入口一次性注册 Hono 官方 `cors` 中间件，并放在现有路由注册之前，让 `/health`、`/openapi.json` 和未来新增路由自动继承同一策略。测试继续复用 `modules/api/test/health-route.test.ts` 的成品产物集成方式，先让 CORS 断言失败，再做最小实现与文档更新，不引入额外配置、helper 或按环境分支。

**Tech Stack:** TypeScript、pnpm、Hono、Vitest、Biome。

---

## 文件结构与职责映射

- Modify: `modules/api/src/app.ts` - 引入并注册全局 `cors` 中间件，固定 `origin: "*"`，保证中间件先于路由生效，并在实现附近声明 CORS 不是访问控制。
- Modify: `modules/api/test/health-route.test.ts` - 追加针对普通请求和 `OPTIONS` 预检的全局 CORS 集成断言，并用源码边界断言防止实现回退到逐路由配置或缺失说明。
- Modify: `docs/api/README.md` - 补充模板默认开放 CORS 的说明，明确其目的仅是浏览器跨域兼容，不替代鉴权、ACL 或网络隔离。

## 实施约束

- 只实现 spec 中定义的“全局开放 CORS”，不新增 origin allowlist、运行时开关、环境变量或按路径差异化策略。
- `origin` 必须固定为 `"*"`，不能改成读取请求头、动态回调或条件逻辑。
- `OPTIONS` 预检必须由全局 CORS 处理，不新增手写 `app.options(...)` 业务路由。
- 现有 `/health` 与 `/openapi.json` 的状态码、响应体和 OpenAPI 契约保持不变。
- 文档只能强调浏览器兼容边界，不能把 CORS 描述为授权、ACL、内网保护或匿名访问控制方案。
- 实现步骤必须遵循 TDD：先改测试制造失败，再做最小实现让其通过。

### Task 1: 用 TDD 为 API 入口补上全局 CORS

**Files:**
- Modify: `modules/api/test/health-route.test.ts`
- Modify: `modules/api/src/app.ts`

- [ ] **Step 1: 先在 `modules/api/test/health-route.test.ts` 写出失败测试，收紧全局 CORS 基线**

在现有 `describe("api package baseline", ...)` 中新增两个请求级断言，并扩展源码边界断言，先要求 dist 构建产物和源码同时体现全局 CORS 行为。保留已有健康检查与 `/openapi.json` 用例不变。

```ts
  it("adds wildcard CORS headers to regular API responses", async () => {
    const app = apiModule.createApp();

    const response = await app.request(contractModule.healthPath, {
      method: "GET",
      headers: {
        origin: "https://frontend.example",
      },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("handles preflight requests through the global CORS middleware", async () => {
    const app = apiModule.createApp();

    const response = await app.request(contractModule.healthPath, {
      method: "OPTIONS",
      headers: {
        origin: "https://frontend.example",
        "access-control-request-method": "GET",
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-methods")).toContain("GET");
  });

  it("keeps the CORS policy global and documented in the app boundary", async () => {
    const apiSource = await readFile(apiSourceUrl, "utf8");

    expect(apiSource).toContain('import { cors } from "hono/cors";');
    expect(apiSource).toContain('app.use("*", cors({ origin: "*" }));');
    expect(apiSource).toContain("CORS only handles browser compatibility");
    expect(apiSource).not.toContain('app.options(');
  });
```

- [ ] **Step 2: 运行定向 API 测试，确认新基线先失败**

Run: `pnpm test:build-fixtures && pnpm exec vitest run --config vitest.workspace.ts --project api modules/api/test/health-route.test.ts`
Expected: FAIL；新增 `GET` 响应缺少 `access-control-allow-origin`，`OPTIONS` 预检返回 `404` 或 `405`/缺少允许头，且源码断言尚未找到 `hono/cors` 导入与 `app.use("*", cors({ origin: "*" }))`。

- [ ] **Step 3: 在 `modules/api/src/app.ts` 写最小实现，统一注册全局 CORS**

只在应用入口增加 Hono 官方 CORS 中间件，并把注释放在注册点附近，明确它是浏览器兼容层，不是后端授权边界。不要新增 helper、配置文件或逐路由 `OPTIONS` 处理器。

```ts
import { openApiDocument } from "@cz-stack/contract";
import { Hono } from "hono";
import { cors } from "hono/cors";

import { registerHealthRoute } from "./routes/health.js";

export const createApp = () => {
  const app = new Hono();

  // CORS only handles browser compatibility. Do not treat it as backend access control.
  app.use("*", cors({ origin: "*" }));

  registerHealthRoute(app);

  app.get("/openapi.json", (context) => context.json(openApiDocument, 200));

  return app;
};
```

- [ ] **Step 4: 重新运行同一组 API 测试，确认最小实现已满足全局 CORS 基线**

Run: `pnpm test:build-fixtures && pnpm exec vitest run --config vitest.workspace.ts --project api modules/api/test/health-route.test.ts`
Expected: PASS；现有 `/health` 与 `/openapi.json` 用例继续通过，新增普通请求断言拿到 `Access-Control-Allow-Origin: *`，新增 `OPTIONS` 预检返回成功且包含允许方法头，源码边界断言确认 CORS 注册在应用入口且未引入 `app.options(...)`。

- [ ] **Step 5: 运行 API 包级测试命令，确认没有破坏现有类型/构建/格式基线**

Run: `pnpm --filter ./modules/api test`
Expected: PASS；`typecheck`、`biome check`、contract/api build 和 Vitest API 项目全部通过，说明全局 CORS 改动没有破坏 API 包的现有发布边界。

- [ ] **Step 6: 提交 Task 1 产物**

```bash
git add modules/api/src/app.ts modules/api/test/health-route.test.ts
git commit -m "feat: enable global cors for api routes"
```

### Task 2: 同步 API 文档边界说明

**Files:**
- Modify: `docs/api/README.md`

- [ ] **Step 1: 在 `docs/api/README.md` 补上模板默认开放 CORS 的说明**

把说明加在“基本原则”之后或“当前仓库的实际入口”之前，内容只覆盖 spec 要求的边界：所有 API 路由默认开放 CORS、`origin` 固定为 `"*"`、预检由全局中间件处理、CORS 不是后端访问控制。

```md
## CORS 默认边界

- `@cz-stack/api` 在应用入口对全部路由统一启用 CORS，并固定返回 `Access-Control-Allow-Origin: *`。
- 浏览器对现有公开接口发起 `OPTIONS` 预检时，应由同一套全局 CORS 中间件直接处理，而不是要求每个路由单独声明 `OPTIONS` 处理器。
- 这一策略只解决浏览器跨域兼容性，不承担鉴权、ACL、租户隔离或网络访问控制职责。
- 如果后端需要限制访问，必须通过独立的鉴权逻辑、网关策略或网络层手段实现，而不是依赖 CORS 白名单。
```

- [ ] **Step 2: 运行文档定向检查，确认 Markdown 改动干净**

Run: `pnpm exec biome check docs/api/README.md`
Expected: PASS；无 Markdown/format 诊断，文档结构保持现有风格。

- [ ] **Step 3: 做范围自检，确认文档没有超出 spec 扩写实现策略**

Run: `git diff -- docs/api/README.md`
Expected: diff 只新增 CORS 默认边界说明，不包含环境开关、白名单配置、Cookie 凭证策略扩展或任何把 CORS 描述成访问控制的表述。

- [ ] **Step 4: 提交 Task 2 产物**

```bash
git add docs/api/README.md
git commit -m "docs: clarify api cors defaults"
```

## 全量验证命令与预期结果

- `pnpm test:build-fixtures && pnpm exec vitest run --config vitest.workspace.ts --project api modules/api/test/health-route.test.ts` -> API 集成测试通过，确认普通请求和 `OPTIONS` 预检都继承全局开放 CORS。
- `pnpm --filter ./modules/api test` -> API 包的类型检查、Biome、构建与 Vitest 全部通过。
- `pnpm exec biome check docs/api/README.md` -> 文档检查通过。
- `git diff -- modules/api/src/app.ts modules/api/test/health-route.test.ts docs/api/README.md` -> diff 只包含全局 CORS 注册、测试补充和文档边界说明。
- `git diff --check` -> 无 trailing whitespace、冲突标记或补丁格式错误。

## 自检结果

- [x] 已覆盖 spec 的三个受影响文件：`modules/api/src/app.ts`、`modules/api/test/health-route.test.ts`、`docs/api/README.md`。
- [x] 已覆盖 spec 的核心目标：全局 CORS、`origin: "*"`、`OPTIONS` 预检、明确 CORS 非访问控制。
- [x] 计划保持最小实现，不引入 allowlist、运行时配置、逐路由 `OPTIONS` 处理器或契约变更。
- [x] 任务按 TDD 顺序展开：先失败测试，再最小实现，再回归验证。
- [x] 文档步骤没有扩展到 Cookie 凭证策略、鉴权改造、代理/浏览器集成测试或其他超出 spec 的主题。
- [x] 已消除占位符；所有步骤都给出了明确文件、命令、预期结果与代码/文档片段。
- [x] 本计划完成后应继续由 Sub Agent 执行，不提供 Inline Execution 选项。
