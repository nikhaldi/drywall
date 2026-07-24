import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import {
  camelToKebab,
  jscpdMajor,
  buildArgs,
  runJscpd,
  parseReport,
  DEFAULT_MAX_DUPLICATES,
  DEFAULT_MAX_FRAGMENT_LENGTH,
} from "../src/lib.js";

const TEST_REPORT_DIR = "/tmp/test-report";

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

describe("jscpdMajor", () => {
  it("extracts the major version", () => {
    assert.equal(jscpdMajor("4.0.9"), 4);
    assert.equal(jscpdMajor("5.0.12"), 5);
    assert.equal(jscpdMajor("10.1.0-beta.1"), 10);
  });
});

describe("buildArgs", () => {
  it("emits no gitignore flag by default (5.x respects .gitignore itself)", () => {
    const args = buildArgs({}, {}, TEST_REPORT_DIR);
    assert.ok(!args.includes("--gitignore"));
    assert.ok(!args.includes("--no-gitignore"));
  });

  it("emits --no-gitignore when respectGitignore is false", () => {
    const args = buildArgs({ respectGitignore: false }, {}, TEST_REPORT_DIR);
    assert.ok(args.includes("--no-gitignore"));
    assert.ok(!args.includes("--gitignore"));
  });

  it("emits --gitignore by default for a jscpd 4.x pin", () => {
    const args = buildArgs({ jscpdVersion: "4.2.5" }, {}, TEST_REPORT_DIR);
    assert.ok(args.includes("--gitignore"));
    assert.ok(!args.includes("--no-gitignore"));
  });

  it("omits --gitignore for a 4.x pin when respectGitignore is false", () => {
    const args = buildArgs(
      { jscpdVersion: "4.2.5", respectGitignore: false },
      {},
      TEST_REPORT_DIR,
    );
    assert.ok(!args.includes("--gitignore"));
    assert.ok(!args.includes("--no-gitignore"));
  });

  it("converts camelCase config keys to kebab-case flags", () => {
    const args = buildArgs({ minTokens: 30 }, {}, TEST_REPORT_DIR);
    const idx = args.indexOf("--min-tokens");
    assert.ok(idx !== -1);
    assert.equal(args[idx + 1], "30");
  });

  it("tool args override config values", () => {
    const args = buildArgs(
      { minTokens: 30 },
      { minTokens: 50 },
      TEST_REPORT_DIR,
    );
    const idx = args.indexOf("--min-tokens");
    assert.equal(args[idx + 1], "50");
    // should only appear once
    assert.equal(args.lastIndexOf("--min-tokens"), idx);
  });

  it("joins --ignore array into one comma-separated value", () => {
    const args = buildArgs(
      {},
      { ignore: ["**/test/**", "**/vendor/**"] },
      TEST_REPORT_DIR,
    );
    const idx = args.indexOf("--ignore");
    assert.notEqual(idx, -1);
    assert.equal(args[idx + 1], "**/test/**,**/vendor/**");
    // must appear exactly once — a repeated flag would be last-wins in jscpd
    assert.equal(args.lastIndexOf("--ignore"), idx);
  });

  it("comma-joins list flags (ignore, ignorePattern, format)", () => {
    for (const [key, flag] of [
      ["ignore", "--ignore"],
      ["ignorePattern", "--ignore-pattern"],
      ["format", "--format"],
    ]) {
      const args = buildArgs({}, { [key]: ["a", "b"] }, TEST_REPORT_DIR);
      const idx = args.indexOf(flag);
      assert.notEqual(idx, -1, `${flag} missing`);
      assert.equal(args[idx + 1], "a,b", `${flag} not comma-joined`);
      assert.equal(args.lastIndexOf(flag), idx, `${flag} duplicated`);
    }
  });

  it("accepts a single-element list flag", () => {
    const args = buildArgs({}, { ignore: ["**/test/**"] }, TEST_REPORT_DIR);
    const idx = args.indexOf("--ignore");
    assert.equal(args[idx + 1], "**/test/**");
  });

  it("throws when a non-list option is given an array", () => {
    assert.throws(
      () => buildArgs({}, { pattern: ["**/*.js", "**/*.ts"] }, TEST_REPORT_DIR),
      /does not accept multiple values/,
    );
  });

  it("passes formatsExts through as a single string value", () => {
    const args = buildArgs(
      {},
      { formatsExts: "javascript:es,es6;dart:dt" },
      TEST_REPORT_DIR,
    );
    const idx = args.indexOf("--formats-exts");
    assert.notEqual(idx, -1);
    assert.equal(args[idx + 1], "javascript:es,es6;dart:dt");
  });

  it("handles boolean true as flag without value", () => {
    const args = buildArgs({}, { silent: true }, TEST_REPORT_DIR);
    assert.ok(args.includes("--silent"));
  });

  it("skips boolean false", () => {
    const args = buildArgs({}, { silent: false }, TEST_REPORT_DIR);
    assert.ok(!args.includes("--silent"));
  });

  it("skips DRYwall-specific keys", () => {
    const args = buildArgs(
      { jscpdVersion: "5.0.0", respectGitignore: true, path: "src/" },
      {},
      TEST_REPORT_DIR,
    );
    assert.ok(!args.includes("--jscpd-version"));
    assert.ok(!args.includes("--respect-gitignore"));
    assert.ok(!args.includes("--path"));
  });

  it("always appends --reporters json and --output", () => {
    const args = buildArgs({}, {}, TEST_REPORT_DIR);
    const reportersIdx = args.indexOf("--reporters");
    assert.ok(reportersIdx !== -1);
    assert.equal(args[reportersIdx + 1], "json");
    const outputIdx = args.indexOf("--output");
    assert.ok(outputIdx !== -1);
    assert.equal(args[outputIdx + 1], TEST_REPORT_DIR);
  });

  it("rejects a user-supplied reporters value", () => {
    assert.throws(
      () => buildArgs({}, { reporters: ["console"] }, TEST_REPORT_DIR),
      /not configurable/,
    );
    assert.throws(
      () => buildArgs({ reporters: "console" }, {}, TEST_REPORT_DIR),
      /not configurable/,
    );
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

  it("truncates long fragments", async () => {
    const longFragment = "x".repeat(DEFAULT_MAX_FRAGMENT_LENGTH + 100);
    const report = JSON.stringify({
      duplicates: [
        {
          firstFile: {
            name: "a.js",
            startLoc: { line: 1 },
            endLoc: { line: 5 },
          },
          secondFile: {
            name: "b.js",
            startLoc: { line: 1 },
            endLoc: { line: 5 },
          },
          lines: 5,
          fragment: longFragment,
        },
      ],
      statistics: {},
    });
    const result = await parseReport(report);
    assert.ok(result.duplicates[0].fragment.length < longFragment.length);
    assert.ok(result.duplicates[0].fragment.endsWith("[...truncated]"));
  });

  it("does not truncate short fragments", async () => {
    const shortFragment = "const x = 1;";
    const report = JSON.stringify({
      duplicates: [
        {
          firstFile: {
            name: "a.js",
            startLoc: { line: 1 },
            endLoc: { line: 2 },
          },
          secondFile: {
            name: "b.js",
            startLoc: { line: 1 },
            endLoc: { line: 2 },
          },
          lines: 2,
          fragment: shortFragment,
        },
      ],
      statistics: {},
    });
    const result = await parseReport(report);
    assert.equal(result.duplicates[0].fragment, shortFragment);
  });

  it("limits to DEFAULT_MAX_DUPLICATES results", async () => {
    const duplicates = Array.from(
      { length: DEFAULT_MAX_DUPLICATES + 10 },
      (_, i) => ({
        firstFile: {
          name: "a.js",
          startLoc: { line: i },
          endLoc: { line: i + 1 },
        },
        secondFile: {
          name: "b.js",
          startLoc: { line: i },
          endLoc: { line: i + 1 },
        },
        lines: i + 1,
        fragment: "x",
      }),
    );
    const report = JSON.stringify({ duplicates, statistics: {} });
    const result = await parseReport(report);
    assert.equal(result.duplicates.length, DEFAULT_MAX_DUPLICATES);
    // should keep the highest-impact ones (sorted by lines desc)
    assert.equal(result.duplicates[0].lines, DEFAULT_MAX_DUPLICATES + 10);
  });

  it("respects custom maxDuplicates", async () => {
    const duplicates = Array.from({ length: 10 }, (_, i) => ({
      firstFile: {
        name: "a.js",
        startLoc: { line: i },
        endLoc: { line: i + 1 },
      },
      secondFile: {
        name: "b.js",
        startLoc: { line: i },
        endLoc: { line: i + 1 },
      },
      lines: i + 1,
      fragment: "x",
    }));
    const report = JSON.stringify({ duplicates, statistics: {} });
    const result = await parseReport(report, { maxDuplicates: 3 });
    assert.equal(result.duplicates.length, 3);
  });

  it("respects custom maxFragmentLength", async () => {
    const report = JSON.stringify({
      duplicates: [
        {
          firstFile: {
            name: "a.js",
            startLoc: { line: 1 },
            endLoc: { line: 5 },
          },
          secondFile: {
            name: "b.js",
            startLoc: { line: 1 },
            endLoc: { line: 5 },
          },
          lines: 5,
          fragment: "x".repeat(200),
        },
      ],
      statistics: {},
    });
    const result = await parseReport(report, { maxFragmentLength: 50 });
    assert.ok(result.duplicates[0].fragment.endsWith("[...truncated]"));
    assert.ok(result.duplicates[0].fragment.length < 200);
  });

  // jscpd 5.x report shape: empty fragment, file names relative to the
  // scanned path instead of the working directory.
  const FIXTURE = "test/fixtures/src/admin-service.js";

  function v5Report(name, startLine, endLine) {
    return JSON.stringify({
      duplicates: [
        {
          firstFile: {
            name,
            startLoc: { line: startLine },
            endLoc: { line: endLine },
          },
          secondFile: {
            name,
            startLoc: { line: startLine },
            endLoc: { line: endLine },
          },
          lines: endLine - startLine + 1,
          fragment: "",
        },
      ],
      statistics: {},
    });
  }

  it("reconstructs an empty fragment from the source file", async () => {
    const result = await parseReport(v5Report(FIXTURE, 1, 3));
    const expected = readFileSync(FIXTURE, "utf8")
      .split("\n")
      .slice(0, 3)
      .join("\n");
    assert.equal(result.duplicates[0].fragment, expected);
  });

  it("resolves scan-path-relative file names", async () => {
    const result = await parseReport(v5Report("src/admin-service.js", 1, 2), {
      scanPath: "test/fixtures",
    });
    const dup = result.duplicates[0];
    assert.equal(dup.firstFile, join("test/fixtures", "src/admin-service.js"));
    assert.equal(dup.secondFile, dup.firstFile);
    const expected = readFileSync(FIXTURE, "utf8")
      .split("\n")
      .slice(0, 2)
      .join("\n");
    assert.equal(dup.fragment, expected);
  });

  it("leaves names unchanged and fragment empty when the file is missing", async () => {
    const result = await parseReport(v5Report("nope/missing.js", 1, 2), {
      scanPath: "test/fixtures",
    });
    assert.equal(result.duplicates[0].firstFile, "nope/missing.js");
    assert.equal(result.duplicates[0].fragment, "");
  });

  it("truncates reconstructed fragments", async () => {
    const result = await parseReport(v5Report(FIXTURE, 1, 20), {
      maxFragmentLength: 30,
    });
    assert.ok(result.duplicates[0].fragment.endsWith("[...truncated]"));
  });
});

// jscpd 5.x reports include end-exclusive UTF-8 byte offsets
// (startLoc/endLoc.position), letting parseReport read just the fragment's
// byte range instead of the whole file. 4.x positions are token indices, so
// the byte path is gated on jscpdMajor >= 5.
describe("parseReport byte-position fragments", () => {
  // Multibyte header makes byte and character offsets diverge, so these
  // assertions fail if positions are ever misread as character offsets.
  const HEADER = "// Grüße 🎉🎉 café résumé 🚀\n";
  const BODY = "function f(a, b) {\n  return a + b;\n}";
  const START = Buffer.byteLength(HEADER);
  const END = START + Buffer.byteLength(BODY);

  let file;

  before(async () => {
    const dir = await mkdtemp(join(tmpdir(), "drywall-test-"));
    file = join(dir, "multibyte.js");
    await writeFile(file, HEADER + BODY + "\n");
  });

  after(() => rm(dirname(file), { recursive: true, force: true }));

  function report(startPos, endPos) {
    return JSON.stringify({
      duplicates: [
        {
          firstFile: {
            name: file,
            startLoc: { line: 2, position: startPos },
            endLoc: { line: 4, position: endPos },
          },
          secondFile: {
            name: file,
            startLoc: { line: 2, position: startPos },
            endLoc: { line: 4, position: endPos },
          },
          lines: 3,
          fragment: "",
        },
      ],
      statistics: {},
    });
  }

  it("reads the fragment via byte offsets for 5.x reports", async () => {
    const result = await parseReport(report(START, END), { jscpdMajor: 5 });
    assert.equal(result.duplicates[0].fragment, BODY);
  });

  it("truncates on characters even when the byte read is capped", async () => {
    const result = await parseReport(report(START, END), {
      jscpdMajor: 5,
      maxFragmentLength: 10,
    });
    const frag = result.duplicates[0].fragment;
    assert.equal(frag, BODY.slice(0, 10) + "\n[...truncated]");
  });

  it("caps the byte read below the full span without leaking split characters", async () => {
    // 50 four-byte emoji = 200 bytes; with maxFragmentLength 10 only
    // 10 * 4 + 4 = 44 bytes are read, then truncation applies on characters.
    const dir = await mkdtemp(join(tmpdir(), "drywall-test-"));
    const emojiFile = join(dir, "emoji.js");
    const emoji = "🎉".repeat(50);
    await writeFile(emojiFile, emoji);
    try {
      const raw = JSON.stringify({
        duplicates: [
          {
            firstFile: {
              name: emojiFile,
              startLoc: { line: 1, position: 0 },
              endLoc: { line: 1, position: Buffer.byteLength(emoji) },
            },
            secondFile: {
              name: emojiFile,
              startLoc: { line: 1, position: 0 },
              endLoc: { line: 1, position: Buffer.byteLength(emoji) },
            },
            lines: 1,
            fragment: "",
          },
        ],
        statistics: {},
      });
      const result = await parseReport(raw, {
        jscpdMajor: 5,
        maxFragmentLength: 10,
      });
      const frag = result.duplicates[0].fragment;
      assert.equal(frag, "🎉".repeat(5) + "\n[...truncated]");
      assert.ok(!frag.includes("�"), "leaked a split character");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("ignores positions for pre-5.x reports (token indices, not offsets)", async () => {
    // Line-based fallback must kick in: lines 2-4 of the file.
    const result = await parseReport(report(START, END), { jscpdMajor: 4 });
    const expected = (HEADER + BODY + "\n").split("\n").slice(1, 4).join("\n");
    assert.equal(result.duplicates[0].fragment, expected);
  });

  it("falls back to the line-based read when positions are unusable", async () => {
    const result = await parseReport(report(null, undefined), {
      jscpdMajor: 5,
    });
    const expected = (HEADER + BODY + "\n").split("\n").slice(1, 4).join("\n");
    assert.equal(result.duplicates[0].fragment, expected);
  });
});

describe("runJscpd", () => {
  it("rejects invalid version strings", () => {
    assert.throws(
      () => runJscpd("../../malicious-pkg", []),
      /Invalid jscpd version/,
    );
    assert.throws(() => runJscpd("jscpd@evil", []), /Invalid jscpd version/);
    assert.throws(
      () => runJscpd("1.0.0; rm -rf /", []),
      /Invalid jscpd version/,
    );
  });
});
