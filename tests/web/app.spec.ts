import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import process from "node:process";

import { expect, test } from "@playwright/test";

const workspaceRoot = process.cwd();

const getAvailablePort = async () =>
  await new Promise<number>((resolve, reject) => {
    const server = createServer();

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        reject(new Error("Failed to resolve an available port"));
        return;
      }

      const { port } = address;

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });

const waitForServer = async (url: string) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 30_000) {
    try {
      const response = await fetch(url);

      if (response.ok) {
        return;
      }
    } catch {
      // server not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url}`);
};

const startProcess = (command: string, args: string[], env: NodeJS.ProcessEnv) => {
  const child = spawn(command, args, {
    cwd: workspaceRoot,
    env,
    stdio: "inherit",
  });

  return child;
};

const stopProcess = async (child: ChildProcess | undefined) => {
  if (!child || child.exitCode !== null || child.killed) {
    return;
  }

  child.kill("SIGTERM");

  await new Promise<void>((resolve) => {
    child.once("exit", () => resolve());
    setTimeout(() => resolve(), 5_000);
  });
};

test.describe("web app", () => {
  let apiPort = 0;
  let apiServer: ChildProcess | undefined;
  let webPort = 0;
  let webServer: ChildProcess | undefined;

  test.beforeAll(async () => {
    apiPort = await getAvailablePort();
    webPort = await getAvailablePort();

    apiServer = startProcess("pnpm", ["exec", "tsx", "modules/api/src/server.ts"], {
      ...process.env,
      PORT: `${apiPort}`,
    });
    await waitForServer(`http://127.0.0.1:${apiPort}/health`);

    webServer = startProcess(
      "pnpm",
      ["--filter", "./modules/web", "exec", "vite", "--host", "127.0.0.1", "--port", `${webPort}`, "--strictPort"],
      {
        ...process.env,
        VITE_API_PROXY_TARGET: `http://127.0.0.1:${apiPort}`,
      },
    );
    await waitForServer(`http://127.0.0.1:${webPort}`);
  });

  test.afterAll(async () => {
    await stopProcess(webServer);
    await stopProcess(apiServer);
  });

  test("loads the health status from the contract-driven client", async ({ page }) => {
    await page.goto(`http://127.0.0.1:${webPort}`);

    await expect(page.getByRole("heading", { name: "CZ-Stack Web" })).toBeVisible();
    await expect(page.getByText("API health: ok")).toBeVisible();
  });

  test("shows the shared error state when the health request fails", async ({ page }) => {
    await page.route(`http://127.0.0.1:${webPort}/api/health`, async (route) => {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ code: "UNAVAILABLE", message: "offline" }),
      });
    });

    await page.goto(`http://127.0.0.1:${webPort}`);

    await expect(page.getByRole("heading", { name: "CZ-Stack Web" })).toBeVisible();
    await expect(page.getByText("API unavailable: offline")).toBeVisible();
  });
});
