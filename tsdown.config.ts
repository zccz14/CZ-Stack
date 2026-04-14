import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  clean: true,
  dts: true,
  format: ["esm", "cjs"],
  sourcemap: true,
  treeshake: true,
  outDir: "dist",
  // 可发布包复用该构建基线；Web 应用继续使用 Vite 原生构建链。
});
