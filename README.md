# DRYwall

A Claude Code plugin for detecting and eliminating code duplication using [jscpd](https://jscpd.dev/).

## Installation

Prerequisite: [Node.js](https://nodejs.org/) must be installed on your system (with `node` and `npx` binaries available to Claude Code).

```
/plugin install drywall
```

## Components

### Skill: `/drywall:scan`

Scans the current codebase for duplication and shows a ranked report of suggested deduplication refactorings. This is the simplest way to tackle some refactorings with manual control.

Invoke within a Claude Code session with:

```
/drywall:scan
/drywall:scan --min-tokens=100 --min-lines=10
```

Arguments are passed through as is to [jscpd](https://jscpd.dev/getting-started/configuration#cli-options). These arguments are additive (or override) defaults configured in `.drywallrc.json` (see Configuration below).

### MCP Tool: `detect_code_duplication`

Automatically invoked by Claude Code when your task involves refactoring or deduplication. Runs [jscpd](https://jscpd.dev/) under the hood and returns structured results.

Parameters:
- `path` — directory to scan (default: `.`)
- `minTokens` — minimum token count for a clone (default: `50`)
- `minLines` — minimum line count for a clone (default: `5`)
- `ignore` — glob patterns to exclude

### Agent: `dedup-refactor`

An autonomous agent that detects duplication and refactors it end-to-end — extracting shared utilities, updating call sites, and verifying the changes. Claude delegates to this agent for large deduplication tasks.

## Configuration

Create a `.drywallrc.json` in your project root to set defaults. Values correspond to [jscpd CLI options](https://jscpd.dev/getting-started/configuration#cli-options):

```json
{
  "minTokens": 50,
  "minLines": 5,
  "ignore": ["**/node_modules/**", "**/dist/**", "**/*.generated.*"],
  "respectGitignore": true,
  "jscpdVersion": "4.0.8"
}
```

- **`respectGitignore`** — `true` by default. Passes `--gitignore` to jscpd so that files excluded by `.gitignore` are automatically skipped. Set to `false` to disable.
- **`jscpdVersion`** — Pin the jscpd version used via `npx`. Defaults to `4.0.8` if not set.

## Status

Early development. The MCP server is currently a stub — jscpd integration is in progress.
