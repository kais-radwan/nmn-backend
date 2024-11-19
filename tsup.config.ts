import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["lib/yt.ts"],
    format: ["cjs", "esm", "iife"],
    splitting: false,
    sourcemap: false,
    clean: true,
    globalName: "YT",
    outDir: "./yt",
});
