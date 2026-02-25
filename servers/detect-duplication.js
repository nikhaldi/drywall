#!/usr/bin/env node

/**
 * DRYwall MCP Server
 *
 * Provides a detect_code_duplication tool that runs jscpd
 * to find duplicated code blocks in a codebase.
 *
 * TODO: Implement actual jscpd integration. This is a placeholder stub.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const server = new Server(
  { name: "drywall", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "detect_code_duplication",
      description:
        "Scan the codebase for duplicated code blocks using jscpd. " +
        "Use this when the user asks about refactoring, deduplication, " +
        "code consolidation, or reducing repetition in their codebase.",
      inputSchema: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "Directory to scan. Defaults to current working directory.",
            default: ".",
          },
          minTokens: {
            type: "number",
            description:
              "Minimum number of tokens in a code block to be considered a clone. Lower values find smaller duplicates.",
            default: 50,
          },
          minLines: {
            type: "number",
            description:
              "Minimum number of lines in a code block to be considered a clone.",
            default: 5,
          },
          ignore: {
            type: "array",
            items: { type: "string" },
            description:
              'Glob patterns to ignore (e.g., ["**/node_modules/**", "**/*.test.ts"]).',
            default: [],
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "detect_code_duplication") {
    const { path = ".", minTokens = 50, minLines = 5, ignore = [] } =
      request.params.arguments ?? {};

    // TODO: Implement jscpd integration
    // 1. Read .drywallrc.json for project defaults
    // 2. Run jscpd with merged config + arguments
    // 3. Parse JSON output
    // 4. Return structured results ranked by impact

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              status: "not_implemented",
              message:
                "DRYwall MCP server is a stub. jscpd integration coming soon.",
              requestedConfig: { path, minTokens, minLines, ignore },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  return {
    content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
    isError: true,
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
