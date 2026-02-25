import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const VERSION = "0.1.0";
export const DEFAULT_VERSION = "4.0.8";
export const REPORT_DIR = "/tmp/drywall-report";
export const REPORT_PATH = join(REPORT_DIR, "jscpd-report.json");
export const DRYWALL_KEYS = new Set([
  "jscpdVersion",
  "respectGitignore",
  "path",
]);

export function camelToKebab(str) {
  return str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
}

export async function readConfig() {
  try {
    const raw = await readFile(".drywallrc.json", "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function buildArgs(config, toolArgs) {
  const { jscpdVersion, respectGitignore, ...jscpdConfig } = config;
  const merged = { ...jscpdConfig, ...toolArgs };
  const args = [];

  // --gitignore unless explicitly disabled
  if (respectGitignore !== false) {
    args.push("--gitignore");
  }

  for (const [key, value] of Object.entries(merged)) {
    if (DRYWALL_KEYS.has(key)) continue;
    const flag = `--${camelToKebab(key)}`;

    if (Array.isArray(value)) {
      for (const item of value) {
        args.push(flag, String(item));
      }
    } else if (typeof value === "boolean") {
      if (value) args.push(flag);
    } else if (value != null) {
      args.push(flag, String(value));
    }
  }

  args.push("--reporters", "json", "--output", REPORT_DIR);
  return args;
}

export function runJscpd(version, args) {
  return new Promise((resolve, reject) => {
    execFile("npx", [`jscpd@${version}`, ...args], (error, stdout, stderr) => {
      if (error && !stderr.includes("Clone found")) {
        reject(new Error(stderr || error.message));
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

export async function parseReport(raw) {
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
      fragment: d.fragment,
    }))
    .sort((a, b) => b.lines - a.lines);

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
