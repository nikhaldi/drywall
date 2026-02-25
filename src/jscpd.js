/**
 * DRYwall MCP Server
 *
 * Provides a detect_code_duplication tool that runs jscpd
 * to find duplicated code blocks in a codebase.
 */

import { readFile } from "node:fs/promises";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  VERSION,
  DEFAULT_VERSION,
  REPORT_PATH,
  buildArgs,
  readConfig,
  runJscpd,
  parseReport,
} from "./lib.js";

const server = new McpServer({ name: "drywall", version: VERSION });

server.registerTool(
  "detect_code_duplication",
  {
    description:
      "Scan the codebase for duplicated code blocks using jscpd. " +
      "Use this when the user asks about refactoring, deduplication, " +
      "code consolidation, or reducing repetition in their codebase.",
    inputSchema: z.object({
      path: z
        .string()
        .describe("Directory to scan. Defaults to current working directory.")
        .optional(),
      options: z
        .looseObject({})
        .describe(
          "jscpd options passed as CLI flags. Keys are camelCase and converted to --kebab-case flags. " +
            'Examples: {"minTokens": 30, "minLines": 5, "ignore": ["**/test/**"], "format": ["javascript", "typescript"], "threshold": 10}. ' +
            "See https://jscpd.dev/getting-started/configuration#cli-options for all options.",
        )
        .optional(),
    }),
  },
  async ({ path: scanPath, options = {} }) => {
    try {
      const config = await readConfig();
      const version = config.jscpdVersion || DEFAULT_VERSION;

      const args = buildArgs(config, options);

      // The path argument goes last (positional, not a flag)
      const targetPath = scanPath || config.path || ".";
      args.push(targetPath);

      await runJscpd(version, args);
      const raw = await readFile(REPORT_PATH, "utf8");
      const result = await parseReport(raw);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ status: "ok", ...result }, null, 2),
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              { status: "error", message: err.message },
              null,
              2,
            ),
          },
        ],
        isError: true,
      };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
