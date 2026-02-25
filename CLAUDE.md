# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DRYwall is a Claude Code plugin for detecting and eliminating code duplication. It uses [jscpd](https://github.com/kucherenko/jscpd) as its detection engine. The project is in early development — the MCP server is a stub with jscpd integration pending.

## Architecture

The plugin has three components that work together:

- **MCP Server** (`servers/detect-duplication.js`) — A Node.js MCP server providing the `detect_code_duplication` tool. Claude invokes this automatically for refactoring/deduplication tasks. Uses `@modelcontextprotocol/sdk` for server/stdio transport. Currently a stub returning `not_implemented`.

- **Skill** (`skills/scan/SKILL.md`) — User-invocable command `/drywall:scan` that runs jscpd, parses the JSON report, ranks duplicates by impact (lines × occurrences), and presents top 10 results with consolidation suggestions.

- **Agent** (`agents/dedup-refactor.md`) — Autonomous refactoring agent (Sonnet, max 30 turns) that detects duplicates, classifies them (exact/near/structural), plans consolidation, refactors code, and verifies changes.

All three components share the same detection pipeline: run jscpd → output JSON to `/tmp/drywall-report/jscpd-report.json` → parse and rank by impact.

## Configuration

Projects using DRYwall configure via `.drywallrc.json` at project root with `minTokens`, `minLines`, and `ignore` (glob patterns). User arguments override config file values.

## Installation

Installed as a Claude Code plugin via `/plugin install drywall`. The MCP server is an executable Node.js script (shebang `#!/usr/bin/env node`).

## Development Notes

- No build step or package.json — the server is a standalone ES module script
- No test suite currently exists
- The main implementation work remaining is wiring jscpd into the MCP server's `CallToolRequestSchema` handler (see TODO at `servers/detect-duplication.js:71-75`)
