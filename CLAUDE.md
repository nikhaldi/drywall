# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DRYwall is a Claude Code plugin for detecting and eliminating code duplication. It uses [jscpd](https://github.com/kucherenko/jscpd) as its detection engine.

## Architecture

The plugin has three components that work together:

- **MCP Server** (source: `src/detect-duplication.js`, built: `servers/detect-duplication.js`) — A Node.js MCP server providing the `detect_code_duplication` tool. Reads `.drywallrc.json`, runs jscpd, and returns structured results ranked by impact. The skill and agent both use this tool for detection. Bundled via esbuild for distribution (no `node_modules` needed at runtime).

- **Skill** (`skills/scan/SKILL.md`) — User-invocable command `/drywall:scan` that calls the MCP tool and presents the top 10 duplicates with consolidation suggestions.

- **Agent** (`agents/dedup-refactor.md`) — Autonomous refactoring agent (Sonnet, max 30 turns) that calls the MCP tool, classifies duplicates (exact/near/structural), plans consolidation, refactors code, and verifies changes.

## Configuration

Projects using DRYwall configure via `.drywallrc.json` at project root. Keys `jscpdVersion` and `respectGitignore` are DRYwall-specific; all other keys are passed through as jscpd CLI flags (camelCase is converted to kebab-case). User arguments override config file values.

## Development

- `npm install` — install dependencies
- `npm run build` — bundle `src/detect-duplication.js` to `servers/detect-duplication.js`
- The bundle must be rebuilt and committed after changes to `src/detect-duplication.js`
- `npm test` — run unit tests (Node.js built-in test runner)
- Tests live in `test/**/*.test.js` and cover `src/lib.js` (helpers extracted for testability)
- `test/fixtures/` contains a sample codebase with intentional duplication for manual testing
