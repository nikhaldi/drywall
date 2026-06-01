import { execFile } from "node:child_process";
import { readFile, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export const VERSION = DRYWALL_VERSION;
export const DEFAULT_VERSION = "4.0.9";

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
  const merged = { ...jscpdConfig, ...toolArgs };
  const args = [];

  // --gitignore unless explicitly disabled
  if (respectGitignore !== false) {
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

const VERSION_RE = /^\d+\.\d+\.\d+(-[\w.]+)?$/;

export function runJscpd(version, args) {
  if (!VERSION_RE.test(version)) {
    throw new Error(`Invalid jscpd version: "${version}"`);
  }
  const fullArgs = [`jscpd@${version}`, ...args];
  const cmd = ["npx", ...fullArgs];
  return new Promise((resolve, reject) => {
    execFile("npx", fullArgs, (error, stdout, stderr) => {
      if (error && !stderr.includes("Clone found")) {
        reject(new Error(stderr || error.message));
      } else {
        resolve({ cmd, stdout, stderr });
      }
    });
  });
}

export const DEFAULT_MAX_DUPLICATES = 20;
export const DEFAULT_MAX_FRAGMENT_LENGTH = 500;

export async function parseReport(
  raw,
  { maxDuplicates, maxFragmentLength } = {},
) {
  const limit = maxDuplicates ?? DEFAULT_MAX_DUPLICATES;
  const fragLimit = maxFragmentLength ?? DEFAULT_MAX_FRAGMENT_LENGTH;
  const report = JSON.parse(raw);

  const duplicates = (report.duplicates || [])
    .map((d) => ({
      firstFile: d.firstFile.name,
      firstStart: d.firstFile.startLoc.line,
      firstEnd: d.firstFile.endLoc.line,
      secondFile: d.secondFile.name,
      secondStart: d.secondFile.startLoc.line,
      secondEnd: d.secondFile.endLoc.line,
      lines: d.lines,
      fragment:
        d.fragment && d.fragment.length > fragLimit
          ? d.fragment.slice(0, fragLimit) + "\n[...truncated]"
          : d.fragment,
    }))
    .sort((a, b) => b.lines - a.lines)
    .slice(0, limit);

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
