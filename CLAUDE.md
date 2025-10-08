# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build System
- **Build entire project**: `npm run build` (builds all packages)
- **Build with sandbox**: `npm run build:all` (includes Docker sandbox container)
- **Bundle for distribution**: `npm run bundle`
- **Clean build artifacts**: `npm run clean`

### Testing
- **Run unit tests**: `npm run test` (runs tests in all packages)
- **Run integration tests**: `npm run test:e2e`
- **Run all integration tests**: `npm run test:integration:all`
- **Run tests with CI coverage**: `npm run test:ci`

### Code Quality
- **Lint code**: `npm run lint` (check for issues)
- **Fix linting issues**: `npm run lint:fix`
- **Format code**: `npm run format`
- **Type check**: `npm run typecheck`
- **Full preflight check**: `npm run preflight` (runs format, lint, build, typecheck, and tests)

### Development Workflow
- **Start CLI from source**: `npm start`
- **Start in debug mode**: `npm run debug`
- **Start in development mode**: `DEV=true npm start`

### Single Test Execution
Navigate to specific package and use vitest:
```bash
cd packages/cli
npm run test -- --reporter=verbose path/to/specific.test.ts
```

## Architecture Overview

This is a monorepo with a clear separation of concerns:

### Core Packages
- **`packages/cli/`**: Frontend terminal interface built with React/Ink
  - Handles user input, display rendering, and UI interactions
  - Main entry point: `packages/cli/src/gemini.tsx`
  - Contains all UI components, themes, and command processors

- **`packages/core/`**: Backend logic and API communication
  - Orchestrates Gemini API interactions and tool execution
  - Tool registry and execution logic
  - Core services for file operations, shell execution, Git, etc.
  - Main exports in `packages/core/src/index.ts`

- **`packages/test-utils/`**: Shared testing utilities
- **`packages/vscode-ide-companion/`**: VSCode extension companion

### Key Interaction Flow
1. CLI package captures user input
2. Core package constructs prompts and calls Gemini API
3. If tools are requested, core package executes them (with user approval for unsafe operations)
4. Results flow back through core to CLI for display

### Tool System
- Tools are located in `packages/core/src/tools/`
- Each tool implements a standard interface for Gemini function calling
- Built-in tools: file operations, shell commands, web search, MCP servers
- Extensible through MCP (Model Context Protocol) servers

## Configuration and Context

### Settings Management
- Global settings: `~/.gemini/settings.json`
- Project settings: `.gemini/settings.json`
- Environment variables loaded from `.env` files
- Hierarchical precedence: defaults → system → user → project → env vars → CLI args

### Context Files (GEMINI.md)
- Project-specific instructions for the AI model
- Loaded hierarchically from project root up to subdirectories
- Use `/memory show` and `/memory refresh` commands to manage context
- Critical for providing project-specific coding guidelines and context

## Development Patterns

### TypeScript Configuration
- Strict TypeScript configuration with comprehensive error checking
- ESM modules throughout (`"type": "module"`)
- Composite project setup for incremental builds
- Target ES2022, Node.js 20+ required

### Testing Framework
- Vitest for unit tests with React Testing Library
- Integration tests use actual CLI execution
- MSW for API mocking
- Test setup files in each package's root

### Code Style
- ESLint with TypeScript rules and import restrictions
- License headers required on all files (`@license` format)
- Prettier for formatting
- No default exports preferred in CLI package
- React functional components with hooks

### React/Ink Architecture
- Terminal UI built with Ink (React for CLIs)
- Context-based state management
- Custom hooks for terminal-specific functionality (keyboard, completion, etc.)
- Streaming responses with real-time updates

## Important Files to Understand

### Entry Points
- `packages/cli/src/gemini.tsx` - Main CLI application
- `packages/core/src/index.ts` - Core package exports
- `bundle/gemini.js` - Built CLI executable

### Configuration
- `package.json` (root) - Workspace setup and scripts
- `tsconfig.json` - TypeScript configuration
- `eslint.config.js` - Linting rules
- `esbuild.config.js` - Build configuration

### Core Services
- `packages/core/src/core/geminiChat.ts` - Main chat orchestration
- `packages/core/src/tools/tool-registry.ts` - Tool management
- `packages/cli/src/services/CommandService.ts` - Slash command handling

## Security and Sandboxing

### Sandboxing Options
- macOS: Uses Seatbelt (sandbox-exec) with configurable profiles
- Cross-platform: Docker/Podman containerization
- Custom sandbox profiles via `.gemini/sandbox-macos-*.sb` files
- Automatic sandboxing in YOLO mode

### Tool Safety
- Read-only tools auto-approve by default
- Write/execute tools require user confirmation
- Configurable via `autoAccept` and approval modes
- MCP servers can be trusted to bypass confirmations

## Build and Bundle System

- Custom build scripts in `scripts/` directory
- ESBuild for fast TypeScript compilation
- Asset bundling for distribution
- Incremental builds supported
- Docker sandbox image building integrated

Run `npm run preflight` before submitting changes to ensure all checks pass.