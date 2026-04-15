import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = new URL("../../", import.meta.url);
const cliPackageUrl = new URL("../../modules/cli/package.json", import.meta.url);
const cliBinUrl = new URL("../../modules/cli/bin/dev.js", import.meta.url);
const cliRootUrl = new URL("../../modules/cli/", import.meta.url);
const cliCommandSourceUrl = new URL("../../modules/cli/src/commands/health.ts", import.meta.url);

const runningServers = new Set<ReturnType<typeof createServer>>();

const getImportSpecifiers = (source: string) => [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(([, specifier]) => specifier);

afterEach(async () => {
  await Promise.all(
    [...runningServers].map(async (server) => {
      runningServers.delete(server);
      server.close();
      await once(server, "close");
    }),
  );
});

const startHealthServer = async () => {
  const requests: string[] = [];
  const server = createServer((request, response) => {
    requests.push(request.url ?? "");

    if (request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: "ok" }));
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(JSON.stringify({ code: "UNAVAILABLE", message: "not found" }));
  });

  runningServers.add(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("expected tcp server address");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    requests,
  };
};

describe("cli package baseline", () => {
  it("publishes the expected cli package manifest", async () => {
    const cliPackage = JSON.parse(await readFile(cliPackageUrl, "utf8")) as {
      name: string;
      bin: Record<string, string>;
      oclif?: {
        bin?: string;
        commands?: {
          identifier?: string;
          strategy?: string;
          target?: string;
        };
      };
    };

    expect(cliPackage.name).toBe("@cz-stack/cli");
    expect(cliPackage.bin).toEqual({
      "cz-stack": "bin/dev.js",
    });
    expect(cliPackage.oclif).toEqual({
      bin: "cz-stack",
      commands: {
        identifier: "commands",
        strategy: "explicit",
        target: "./dist/index.mjs",
      },
    });
  });

  it("boots the published bin from built runtime instead of repo-only dev sources", async () => {
    const binSource = await readFile(cliBinUrl, "utf8");

    expect(binSource).toContain("../dist/index.mjs");
    expect(binSource).not.toContain("../src/index.ts");
    expect(binSource).not.toContain("tsx");
  });

  it("keeps base-url ownership in the CLI fetch wrapper", async () => {
    const commandSource = await readFile(cliCommandSourceUrl, "utf8");
    const importSpecifiers = getImportSpecifiers(commandSource);

    expect(importSpecifiers).toContain("@cz-stack/contract");
    expect(importSpecifiers.some((specifier) => specifier.includes("contract/generated"))).toBe(false);
    expect(commandSource).toMatch(/createContractClient\s*\(\s*\{[\s\S]*fetch\s*:/);
    expect(commandSource).not.toMatch(/createContractClient\s*\(\s*\{[\s\S]*baseUrl\s*:/);
    expect(commandSource).not.toMatch(/\bContractFetch\b/);
  });

  it("starts from the oclif entry, honors --base-url, and prints a structured success result", async () => {
    const server = await startHealthServer();

    const child = spawn(
      process.execPath,
      [cliBinUrl.pathname, "health", "--base-url", server.baseUrl],
      {
        cwd: cliRootUrl,
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );

    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];

    child.stdout.on("data", (chunk) => stdout.push(Buffer.from(chunk)));
    child.stderr.on("data", (chunk) => stderr.push(Buffer.from(chunk)));

    const [exitCode] = (await once(child, "close")) as [number | null];

    expect(exitCode).toBe(0);
    expect(server.requests).toEqual(["/health"]);
    expect(Buffer.concat(stderr).toString("utf8")).toBe("");
    expect(JSON.parse(Buffer.concat(stdout).toString("utf8"))).toEqual({
      ok: true,
      data: { status: "ok" },
    });
  });
});
