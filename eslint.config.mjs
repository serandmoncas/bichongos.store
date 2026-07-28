import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // .claude/worktrees/<name>/.next is a nested build cache from a git
    // worktree living inside this checkout — ".next/**" only anchors at
    // the config root, it doesn't recurse into nested directories the
    // way .gitignore patterns do, so it must be excluded explicitly.
    "**/.claude/**",
  ]),
]);

export default eslintConfig;
