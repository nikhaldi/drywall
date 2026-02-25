# Test Fixtures

Sample codebase with intentional duplication for testing the `dedup-refactor` agent and `/drywall:scan` skill.

## Duplication Types

| Files | Type | Description |
|---|---|---|
| `user-service.js` + `admin-service.js` | Exact | Identical validation and query-building functions |
| `order-report.js` + `sales-report.js` | Near | Same reduce/aggregate logic, different field names (`amount` vs `revenue`) |
| `csv-export.js` | Structural | Three `exportXxxCsv` functions with the same headers→rows→join pattern |

## Running Manually

From this directory:

```bash
# Scan with the skill
cd test/fixtures
# then invoke /drywall:scan in a Claude Code session

# Or run jscpd directly
npx jscpd@4.0.8 --reporters json --output /tmp/drywall-report --min-tokens 30 --min-lines 5 src/
cat /tmp/drywall-report/jscpd-report.json

# Test the agent
# cd test/fixtures, then ask Claude Code to deduplicate the codebase
```

The `.drywallrc.json` in this directory sets `minTokens: 30` to catch the smaller clones.
