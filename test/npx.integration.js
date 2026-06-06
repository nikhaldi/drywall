import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildArgs,
  parseReport,
  runJscpd,
  createReportDir,
  normalizeScanPath,
  DEFAULT_VERSION,
} from "../src/lib.js";

const FIXTURES = join(
  dirname(fileURLToPath(import.meta.url)),
  "fixtures",
  "src",
);

// Real npx execution. Unlike the unit tests, this drives resolveNpx -> execFile
// end to end against an actual `npx jscpd@<version>` invocation, so it's the one
// test that exercises the Windows npx-spawn fix (node + npx-cli.js, no shell) on
// the Windows CI leg, and — via the absolute FIXTURES path through
// normalizeScanPath — the absolute-path glob fix too. It fetches jscpd on a cold
// runner, hence the long timeout and its own `test:integration` target (kept out
// of the hermetic, offline unit suite).
describe("runJscpd (real npx execution)", () => {
  it(
    "runs jscpd via npx and writes a parseable, non-empty report",
    { timeout: 120_000 },
    async () => {
      const { reportDir, reportPath } = await createReportDir();
      const args = buildArgs({ respectGitignore: false }, {}, reportDir);
      // Absolute path, normalized the same way the server does it.
      args.push(normalizeScanPath(FIXTURES));

      // The assertion that matters for the Windows fix: the spawn itself
      // succeeds (no ENOENT/EINVAL) and produces output.
      await assert.doesNotReject(runJscpd(DEFAULT_VERSION, args));

      // And the run is real, not a silently-empty report: the fixtures contain
      // known duplication, so clones > 0 proves jscpd actually scanned the path.
      const report = await parseReport(await readFile(reportPath, "utf8"));
      assert.ok(
        report.summary.clones > 0,
        "expected jscpd to find duplication in fixtures",
      );
    },
  );
});
