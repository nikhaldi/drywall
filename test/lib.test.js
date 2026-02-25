import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  camelToKebab,
  buildArgs,
  parseReport,
  REPORT_DIR,
  DRYWALL_KEYS,
} from "../src/lib.js";

describe("camelToKebab", () => {
  it("converts single boundary", () => {
    assert.equal(camelToKebab("minTokens"), "min-tokens");
  });

  it("converts multiple boundaries", () => {
    assert.equal(camelToKebab("minLinesLimit"), "min-lines-limit");
  });

  it("leaves lowercase unchanged", () => {
    assert.equal(camelToKebab("format"), "format");
  });

  it("leaves already-kebab unchanged", () => {
    assert.equal(camelToKebab("min-tokens"), "min-tokens");
  });
});

describe("buildArgs", () => {
  it("adds --gitignore by default", () => {
    const args = buildArgs({}, {});
    assert.ok(args.includes("--gitignore"));
  });

  it("omits --gitignore when respectGitignore is false", () => {
    const args = buildArgs({ respectGitignore: false }, {});
    assert.ok(!args.includes("--gitignore"));
  });

  it("converts camelCase config keys to kebab-case flags", () => {
    const args = buildArgs({ minTokens: 30 }, {});
    const idx = args.indexOf("--min-tokens");
    assert.ok(idx !== -1);
    assert.equal(args[idx + 1], "30");
  });

  it("tool args override config values", () => {
    const args = buildArgs({ minTokens: 30 }, { minTokens: 50 });
    const idx = args.indexOf("--min-tokens");
    assert.equal(args[idx + 1], "50");
    // should only appear once
    assert.equal(args.lastIndexOf("--min-tokens"), idx);
  });

  it("handles array values as repeated flags", () => {
    const args = buildArgs({}, { ignore: ["**/test/**", "**/vendor/**"] });
    const indices = args.reduce(
      (acc, v, i) => (v === "--ignore" ? [...acc, i] : acc),
      [],
    );
    assert.equal(indices.length, 2);
    assert.equal(args[indices[0] + 1], "**/test/**");
    assert.equal(args[indices[1] + 1], "**/vendor/**");
  });

  it("handles boolean true as flag without value", () => {
    const args = buildArgs({}, { silent: true });
    assert.ok(args.includes("--silent"));
  });

  it("skips boolean false", () => {
    const args = buildArgs({}, { silent: false });
    assert.ok(!args.includes("--silent"));
  });

  it("skips DRYwall-specific keys", () => {
    const args = buildArgs(
      { jscpdVersion: "5.0.0", respectGitignore: true, path: "src/" },
      {},
    );
    assert.ok(!args.includes("--jscpd-version"));
    assert.ok(!args.includes("--respect-gitignore"));
    assert.ok(!args.includes("--path"));
  });

  it("always appends --reporters json and --output", () => {
    const args = buildArgs({}, {});
    const reportersIdx = args.indexOf("--reporters");
    assert.ok(reportersIdx !== -1);
    assert.equal(args[reportersIdx + 1], "json");
    const outputIdx = args.indexOf("--output");
    assert.ok(outputIdx !== -1);
    assert.equal(args[outputIdx + 1], REPORT_DIR);
  });
});

describe("parseReport", () => {
  const sampleReport = JSON.stringify({
    duplicates: [
      {
        firstFile: { name: "a.js", startLoc: { line: 1 }, endLoc: { line: 5 } },
        secondFile: {
          name: "b.js",
          startLoc: { line: 10 },
          endLoc: { line: 14 },
        },
        lines: 5,
        fragment: "const x = 1;",
      },
      {
        firstFile: {
          name: "c.js",
          startLoc: { line: 1 },
          endLoc: { line: 20 },
        },
        secondFile: {
          name: "d.js",
          startLoc: { line: 1 },
          endLoc: { line: 20 },
        },
        lines: 20,
        fragment: "function big() {}",
      },
    ],
    statistics: {
      total: {
        clones: 2,
        duplicatedLines: 25,
        percentage: 12.5,
        lines: 200,
      },
    },
  });

  it("extracts summary from statistics", async () => {
    const result = await parseReport(sampleReport);
    assert.deepEqual(result.summary, {
      clones: 2,
      duplicatedLines: 25,
      percentage: 12.5,
      totalLines: 200,
    });
  });

  it("sorts duplicates by lines descending", async () => {
    const result = await parseReport(sampleReport);
    assert.equal(result.duplicates.length, 2);
    assert.equal(result.duplicates[0].lines, 20);
    assert.equal(result.duplicates[1].lines, 5);
  });

  it("maps duplicate fields correctly", async () => {
    const result = await parseReport(sampleReport);
    const first = result.duplicates[0];
    assert.equal(first.firstFile, "c.js");
    assert.equal(first.firstStart, 1);
    assert.equal(first.firstEnd, 20);
    assert.equal(first.secondFile, "d.js");
    assert.equal(first.fragment, "function big() {}");
  });

  it("handles empty report", async () => {
    const result = await parseReport(
      JSON.stringify({ duplicates: [], statistics: {} }),
    );
    assert.deepEqual(result.summary, {
      clones: 0,
      duplicatedLines: 0,
      percentage: 0,
      totalLines: 0,
    });
    assert.equal(result.duplicates.length, 0);
  });

  it("handles missing fields gracefully", async () => {
    const result = await parseReport(JSON.stringify({}));
    assert.equal(result.duplicates.length, 0);
    assert.equal(result.summary.clones, 0);
  });
});
