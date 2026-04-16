import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "contract",
          include: ["tests/contracts/contract-package.test.ts"],
        },
      },
      {
        test: {
          name: "api",
          include: ["tests/api/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "cli",
          include: ["tests/cli/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "repo",
          include: ["tests/repo/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "docs",
          include: ["tests/docs/**/*.test.ts"],
        },
      },
    ],
  },
});
