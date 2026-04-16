import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const docsDir = new URL("../", import.meta.url);
const distDir = new URL("../dist/", import.meta.url);
const scalarConfigPath = new URL("../scalar.config.json", import.meta.url);
const scalarConfig = JSON.parse(await readFile(scalarConfigPath, "utf8"));
const require = createRequire(import.meta.url);
const scalarCliPath = require.resolve("@scalar/cli/index.js");

const reservePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Failed to reserve a local port for Scalar CLI"));
        return;
      }
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(address.port);
      });
    });
  });

const waitForServer = async (url, attempts = 50) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return await response.text();
      }
    } catch {
      // keep polling until the server is ready
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`Timed out waiting for Scalar CLI at ${url}`);
};

await rm(distDir, { force: true, recursive: true });
await rm(new URL("../.runtime-dist/", import.meta.url), {
  force: true,
  recursive: true,
});
await rm(new URL("../tsconfig.tsbuildinfo", import.meta.url), { force: true });
await mkdir(distDir, { recursive: true });

const port = await reservePort();
const inputPath = fileURLToPath(new URL(scalarConfig.input, docsDir));
const scalarServer = spawn(
  process.execPath,
  [scalarCliPath, "document", "serve", inputPath, "--port", String(port), "--once"],
  {
    cwd: fileURLToPath(docsDir),
    stdio: ["ignore", "pipe", "pipe"],
  },
);

let stderr = "";
scalarServer.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

let html = "";

try {
  html = await waitForServer(`http://127.0.0.1:${port}/`);
} finally {
  await new Promise((resolve, reject) => {
    scalarServer.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Scalar CLI exited with code ${code}${stderr ? `\n${stderr}` : ""}`,
        ),
      );
    });
  });
}

await writeFile(new URL("./index.html", distDir), html, "utf8");
await readFile(new URL("./index.html", distDir), "utf8");
