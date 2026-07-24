import { execFile } from "node:child_process";
import { readFile, mkdtemp, open } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";

export const VERSION = DRYWALL_VERSION;
export const DEFAULT_VERSION = "5.0.12";

export function jscpdMajor(version) {
  return Number.parseInt(version, 10);
}

export async function createReportDir() {
  const dir = await mkdtemp(join(tmpdir(), "drywall-report-"));
  return { reportDir: dir, reportPath: join(dir, "jscpd-report.json") };
}
export const DRYWALL_KEYS = new Set([
  "jscpdVersion",
  "respectGitignore",
  "path",
  "maxDuplicates",
  "maxFragmentLength",
]);

export function camelToKebab(str) {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

// jscpd options that accept a comma-separated list in a single value. None of
// jscpd's options are variadic (all declared `[string]`, never `[string...]`),
// so a repeated flag is silently last-wins — these must be comma-joined into one
// value instead. (formatsExts/formatsNames also take lists but use a `;`/`,`
// nested syntax and are passed through as pre-formatted strings, not arrays.)
// reporters is intentionally absent: DRYwall always uses the json reporter (the
// server reads jscpd-report.json), so it is not user-configurable.
export const LIST_FLAGS = new Set(["ignore", "ignorePattern", "format"]);

export async function readConfig() {
  try {
    const raw = await readFile(".drywallrc.json", "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function buildArgs(config, toolArgs, reportDir) {
  const { jscpdVersion, respectGitignore, ...jscpdConfig } = config;
  const major = jscpdMajor(jscpdVersion || DEFAULT_VERSION);
  const merged = { ...jscpdConfig, ...toolArgs };
  const args = [];

  // jscpd 4.x ignores .gitignore unless --gitignore is passed; 5.x respects it
  // by default, removed --gitignore (unknown flags are hard errors), and only
  // has --no-gitignore to opt out.
  if (major >= 5) {
    if (respectGitignore === false) {
      args.push("--no-gitignore");
    }
  } else if (respectGitignore !== false) {
    args.push("--gitignore");
  }

  for (const [key, value] of Object.entries(merged)) {
    if (DRYWALL_KEYS.has(key)) continue;
    // DRYwall always uses the json reporter so the server can read the report;
    // a custom reporters value has no effect, so reject it rather than silently
    // drop or merge it.
    if (key === "reporters") {
      throw new Error(
        `"reporters" is not configurable in DRYwall; it always uses the ` +
          `json reporter that the server reads. Remove it from your config.`,
      );
    }
    const flag = `--${camelToKebab(key)}`;

    if (Array.isArray(value)) {
      if (!LIST_FLAGS.has(key)) {
        throw new Error(
          `Config key "${key}" does not accept multiple values; ` +
            `jscpd's --${camelToKebab(key)} takes a single value. ` +
            `Provide a string, not an array.`,
        );
      }
      // jscpd splits these on "," internally; a repeated flag would be
      // last-wins, so join into one comma-separated value.
      args.push(flag, value.map(String).join(","));
    } else if (typeof value === "boolean") {
      if (value) args.push(flag);
    } else if (value != null) {
      args.push(flag, String(value));
    }
  }

  args.push("--reporters", "json", "--output", reportDir);
  return args;
}

// jscpd 4.x globs the scan path with fast-glob, which treats backslashes as
// escape characters on every platform. On Windows the separator is `\`, so an
// absolute target like `E:\proj\src` becomes a broken pattern that matches
// nothing (an empty report). Normalize to forward slashes — safe because `\`
// is never a legal filename character on Windows, and harmless for the 5.x
// Rust engine, which accepts both separators. Other platforms are untouched.
export function normalizeScanPath(scanPath) {
  if (process.platform === "win32" && typeof scanPath === "string") {
    return scanPath.replace(/\\/g, "/");
  }
  return scanPath;
}

const VERSION_RE = /^\d+\.\d+\.\d+(-[\w.]+)?$/;

// Resolve how to invoke npx across platforms.
// On Windows `npx` is a `.cmd` shim: execFile("npx", …) fails with ENOENT (only
// npx.cmd is on PATH), and execFile("npx.cmd", …) throws EINVAL on patched Node
// (CVE-2024-27980) unless a shell is used. Running npm's npx-cli.js with the
// current `node` binary skips the shell entirely, so argv is passed verbatim —
// no quoting or injection pitfalls. Falls back to the .cmd shim via a shell if
// the CLI script can't be located. Non-Windows keeps the plain `npx` call.
function resolveNpx(fullArgs) {
  if (process.platform !== "win32") {
    return { command: "npx", spawnArgs: fullArgs, options: {} };
  }
  const npxCli = join(
    dirname(process.execPath),
    "node_modules",
    "npm",
    "bin",
    "npx-cli.js",
  );
  if (existsSync(npxCli)) {
    return {
      command: process.execPath,
      spawnArgs: [npxCli, ...fullArgs],
      options: {},
    };
  }
  return { command: "npx.cmd", spawnArgs: fullArgs, options: { shell: true } };
}

export function runJscpd(version, args, reportPath) {
  if (!VERSION_RE.test(version)) {
    throw new Error(`Invalid jscpd version: "${version}"`);
  }
  const fullArgs = [`jscpd@${version}`, ...args];
  const cmd = ["npx", ...fullArgs];
  const { command, spawnArgs, options } = resolveNpx(fullArgs);
  return new Promise((resolve, reject) => {
    execFile(command, spawnArgs, options, (error, stdout, stderr) => {
      // A nonzero exit doesn't mean the scan failed: jscpd exits 1 when a
      // configured threshold is exceeded (after writing the report). The
      // report file is written to a fresh temp dir, so its existence is proof
      // of a completed scan. The "Clone found" stderr check covers 4.x runs
      // where no reportPath was provided.
      const scanCompleted =
        (reportPath && existsSync(reportPath)) ||
        stderr.includes("Clone found");
      if (error && !scanCompleted) {
        reject(new Error(stderr || error.message));
      } else {
        resolve({ cmd, stdout, stderr });
      }
    });
  });
}

export const DEFAULT_MAX_DUPLICATES = 20;
export const DEFAULT_MAX_FRAGMENT_LENGTH = 500;

// jscpd 4.x reports file names relative to the working directory; 5.x reports
// them relative to the scanned path. Resolve to a path usable from the working
// directory so callers can open the files either way.
function resolveReportPath(name, scanPath) {
  if (!scanPath || existsSync(name)) return name;
  const joined = join(scanPath, name);
  return existsSync(joined) ? joined : name;
}

// jscpd 5.x reports `startLoc`/`endLoc.position` as end-exclusive UTF-8 byte
// offsets into the file, so the fragment can be read directly without loading
// the whole file. (4.x positions are token-stream indices, not file offsets —
// they must never be read this way; 4.x populates `fragment` itself anyway.)
// The read is capped at 4 bytes per character of the fragment limit — the
// widest a UTF-8 character gets — so a capped read always decodes to more than
// fragLimit characters and the character-based truncation downstream both
// fires and slices off any replacement character from a split trailing byte
// sequence. Returns "" on any failure so callers can fall back to the
// line-based read.
async function readFragmentByPosition(file, startPos, endPos, fragLimit) {
  let fh;
  try {
    const length = Math.min(endPos - startPos, fragLimit * 4 + 4);
    if (length <= 0) return "";
    fh = await open(file, "r");
    const buffer = Buffer.alloc(length);
    const { bytesRead } = await fh.read(buffer, 0, length, startPos);
    return buffer.toString("utf8", 0, bytesRead);
  } catch {
    return "";
  } finally {
    await fh?.close();
  }
}

// Line-based fallback when byte positions are unavailable (4.x reports with a
// missing fragment, or unusable 5.x position fields): reconstruct the snippet
// from the file's line range.
async function readFragment(file, startLine, endLine, cache) {
  try {
    if (!cache.has(file)) {
      cache.set(file, (await readFile(file, "utf8")).split("\n"));
    }
    return cache
      .get(file)
      .slice(startLine - 1, endLine)
      .join("\n");
  } catch {
    return "";
  }
}

export async function parseReport(
  raw,
  { maxDuplicates, maxFragmentLength, scanPath, jscpdMajor: major = 0 } = {},
) {
  const limit = maxDuplicates ?? DEFAULT_MAX_DUPLICATES;
  const fragLimit = maxFragmentLength ?? DEFAULT_MAX_FRAGMENT_LENGTH;
  const report = JSON.parse(raw);

  const ranked = (report.duplicates || [])
    .slice()
    .sort((a, b) => b.lines - a.lines)
    .slice(0, limit);

  const fileCache = new Map();
  const duplicates = [];
  for (const d of ranked) {
    const dup = {
      firstFile: resolveReportPath(d.firstFile.name, scanPath),
      firstStart: d.firstFile.startLoc.line,
      firstEnd: d.firstFile.endLoc.line,
      secondFile: resolveReportPath(d.secondFile.name, scanPath),
      secondStart: d.secondFile.startLoc.line,
      secondEnd: d.secondFile.endLoc.line,
      lines: d.lines,
      fragment: d.fragment,
    };
    if (!dup.fragment) {
      const startPos = d.firstFile.startLoc.position;
      const endPos = d.firstFile.endLoc.position;
      if (
        major >= 5 &&
        Number.isInteger(startPos) &&
        Number.isInteger(endPos)
      ) {
        dup.fragment = await readFragmentByPosition(
          dup.firstFile,
          startPos,
          endPos,
          fragLimit,
        );
      }
      if (!dup.fragment) {
        dup.fragment = await readFragment(
          dup.firstFile,
          dup.firstStart,
          dup.firstEnd,
          fileCache,
        );
      }
    }
    if (dup.fragment && dup.fragment.length > fragLimit) {
      dup.fragment = dup.fragment.slice(0, fragLimit) + "\n[...truncated]";
    }
    duplicates.push(dup);
  }

  const total = report.statistics?.total || {};

  return {
    summary: {
      clones: total.clones || 0,
      duplicatedLines: total.duplicatedLines || 0,
      percentage: total.percentage || 0,
      totalLines: total.lines || 0,
    },
    duplicates,
  };
}
