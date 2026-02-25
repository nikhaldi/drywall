---
name: scan
description: Scan the codebase for duplicated code using jscpd and present ranked results with actionable suggestions
user-invocable: true
argument-hint: "[--min-tokens=50] [--min-lines=5] [--path=src/]"
---

# DRYwall Scan

Scan the codebase for code duplication and present actionable results.

## Steps

1. Call the `detect_code_duplication` MCP tool immediately — do not read any config files or explore the codebase first, the tool handles all configuration automatically. If the user provided arguments, pass them as the `options` object (converting `--min-tokens=50` to `{"minTokens": 50}`, etc.). If the user specified a path, pass it as the `path` parameter.

2. The tool returns a JSON result with `summary` (clones, duplicatedLines, percentage, totalLines) and `duplicates` (already ranked by impact, highest first).

3. Present the top 10 results in a clear format:
   - Source file and lines
   - Duplicate file and lines
   - Number of duplicated lines and tokens
   - A brief suggestion for how to consolidate (extract to shared utility, parameterize, etc.)

4. Summarize overall duplication statistics: total clones found, total duplicated lines, duplication percentage.

5. If no duplication is found, confirm the codebase is clean.
