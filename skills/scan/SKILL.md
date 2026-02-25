---
name: scan
description: Scan the codebase for duplicated code using jscpd and present ranked results with actionable suggestions
user-invocable: true
allowed-tools: Bash, Read, Grep, Glob
argument-hint: "[--min-tokens=50] [--min-lines=5] [--path=src/]"
---

# DRYwall Scan

Scan the codebase for code duplication and present actionable results.

## Steps

1. Check if a `.drywallrc.json` config file exists in the project root. If it does, use it as default settings. User-provided arguments override config file values.

2. Run jscpd with JSON output. Use the version from `.drywallrc.json` `"jscpdVersion"` if set, otherwise default to `4.0.8`. Pass `--gitignore` by default so that files excluded by `.gitignore` are automatically skipped. If `.drywallrc.json` sets `"respectGitignore": false`, omit the `--gitignore` flag.
   ```
   npx jscpd@<version> --reporters json --output /tmp/drywall-report --gitignore $ARGUMENTS .
   ```
   Apply any relevant flags from arguments or config (e.g., `--min-tokens`, `--min-lines`, `--ignore`).

3. Read the JSON report from `/tmp/drywall-report/jscpd-report.json`.

4. Parse and rank the duplicates by impact (lines * occurrences), highest first.

5. Present the top 10 results in a clear format:
   - Source file and lines
   - Duplicate file and lines
   - Number of duplicated lines and tokens
   - A brief suggestion for how to consolidate (extract to shared utility, parameterize, etc.)

6. Summarize overall duplication statistics: total clones found, total duplicated lines, duplication percentage.

7. If no duplication is found, confirm the codebase is clean.
