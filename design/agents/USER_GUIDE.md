# Repository Guidelines

## Project Structure & Module Organization
Gemini CLI is an npm workspace with TypeScript packages under `packages/`. `packages/cli` hosts the terminal UI and slash commands, `packages/core` provides shared services, routing, and tools, `packages/a2a-server` exposes the agent-to-agent bridge, `packages/test-utils` supplies mocks, and `packages/vscode-ide-companion` powers the IDE companion. Top-level `integration-tests/` contains Vitest end-to-end suites, `docs/` stores product and process docs, and `scripts/` houses reusable Node helpers. Built bundles land in `bundle/`; regenerate them via scripts instead of editing by hand.

## Build, Test, and Development Commands
Run `npm install` once per clone to hydrate all workspaces. Use `npm run build` for a full compile, or `npm run build:all` when you need the sandbox image. `npm start` boots the CLI from source, while `npm run start:a2a-server` brings up the coordination server. `npm run test` executes workspace unit tests, `npm run test:e2e` runs `integration-tests/`, and `npm run preflight` chains lint, format, build, typecheck, and tests before a PR.

## Coding Style & Naming Conventions
Prettier (`.prettierrc.json`) enforces 2-space indentation, single quotes, trailing commas, and 80-character lines. ESLint rules in `eslint.config.js` cover import order, React hooks, and required Apache 2.0 license headers—keep them at the top of every source file. Favor `camelCase` for functions/variables, `PascalCase` for classes and React components, and `SCREAMING_SNAKE_CASE` for constants. Keep CLI command files under `packages/cli/src/ui/commands/` and colocate related utilities nearby.

## Testing Guidelines
Author unit specs next to code with a `*.test.ts` suffix. Run `npm run test` locally and prefer focused assertions over broad snapshot files. Smoke full flows with `npm run test:e2e`; set `GEMINI_SANDBOX=false` unless Docker/Podman support is required. Always finish with `npm run preflight` so formatting, linting, types, and coverage gates match CI expectations.

## Commit & Pull Request Guidelines
Write Conventional Commit messages (e.g., `feat(cli): add @mcp subcommand`) and keep changes scoped. Every PR must link an issue, describe the motivation, and update `docs/` or README content when behavior shifts. Share screenshots or recordings for UI updates, and request review only after `npm run preflight` passes. Follow the CLA and community guidelines before your first contribution.

## Security & Configuration Tips
Develop against Node.js 20.19.0 to mirror CI and avoid dependency mismatches. Use `.env.local` for credentials, and confirm secrets remain git-ignored. Enable sandboxing with `GEMINI_SANDBOX` when exercising shell or file tools, and refer to `SECURITY.md` for responsible disclosure steps.
