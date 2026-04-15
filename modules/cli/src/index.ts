import { pathToFileURL } from "node:url";

import HealthCommand from "./commands/health.js";

const commands = {
  health: HealthCommand,
} as const;

export type CliCommandName = keyof typeof commands;

export const run = async (argv = process.argv.slice(2)) => {
  const [commandName, ...commandArgv] = argv;

  if (!commandName) {
    throw new Error(`missing command (available: ${Object.keys(commands).join(", ")})`);
  }

  const command = commands[commandName as CliCommandName];

  if (!command) {
    throw new Error(`unknown command: ${commandName}`);
  }

  await command.run(commandArgv);
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "unexpected error";

    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  });
}
