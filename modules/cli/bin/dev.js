#!/usr/bin/env node

import { createRequire } from "node:module";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);
const tsxLoader = require.resolve("tsx/esm");

const child = spawn(
  process.execPath,
  ["--import", tsxLoader, new URL("../src/index.ts", import.meta.url).pathname, ...process.argv.slice(2)],
  {
    stdio: "inherit",
  },
);

child.on("close", (code) => {
  process.exit(code ?? 1);
});
