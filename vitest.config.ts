import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["src/**/*.integration.test.ts", "node_modules"],
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/**/*.ts",
        "src/app/api/**/*.ts",
        "src/app/prieskumy/export-csv.ts",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/*.integration.test.ts",
        "src/app/**/page.tsx",
        "src/app/**/layout.tsx",
        "src/app/**/opengraph-image.tsx",
        "src/app/**/icon.tsx",
        "src/app/**/apple-icon.tsx",
        "src/app/**/favicon.ico",
        "src/lib/db/schema.ts",
      ],
      thresholds: {
        statements: 46,
        branches: 41,
        functions: 49,
        lines: 49,
      },
    },
  },
});
