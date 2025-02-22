import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  treeshake: true,
  clean: true,
  dts: false,
  platform: "browser",
  splitting: true,
  minify: true,
});
