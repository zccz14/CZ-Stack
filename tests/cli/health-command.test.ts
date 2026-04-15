import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { once } from "node:events";
import { spawn } from "node:child_process";

import { afterEach, describe, expect, it } from "vitest";

const repoRoot = new URL("../../", import.meta.url);
const cliPackageUrl = new URL("../../modules/cli/package.json", import.meta.url);
const cliBinUrl = new URL("../../modules/cli/bin/dev.js", import.meta.url);

const runningServers = new Set<ReturnType<typeof createServer>>();

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

describe("cli health command", () => {
  it("publishes the expected cli package manifest", async () => {
    const cliPackage = JSON.parse(await readFile(cliPackageUrl, "utf8")) as {
      name: string;
      bin: Record<string, string>;
    };

    expect(cliPackage.name).toBe("@cz-stack/cli");
    expect(cliPackage.bin).toEqual({
      "cz-stack": "bin/dev.js",
    });
  });

  it("starts from the dev entry, honors --base-url, and prints a structured success result", async () => {
    const server = await startHealthServer();

    const child = spawn(
      process.execPath,
      [cliBinUrl.pathname, "health", "--base-url", server.baseUrl],
      {
        cwd: repoRoot,
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
