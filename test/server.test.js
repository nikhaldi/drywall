import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER = join(ROOT, "servers", "detect-duplication.js");

function startServer() {
  const proc = spawn("node", [SERVER], { stdio: ["pipe", "pipe", "pipe"] });
  let buffer = "";

  function send(msg) {
    proc.stdin.write(JSON.stringify(msg) + "\n");
  }

  function onResponse() {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("Timeout waiting for response")),
        5000,
      );
      function onData(chunk) {
        buffer += chunk.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line);
            if (parsed.id || parsed.result || parsed.error) {
              clearTimeout(timeout);
              proc.stdout.removeListener("data", onData);
              resolve(parsed);
              return;
            }
          } catch {}
        }
      }
      proc.stdout.on("data", onData);
    });
  }

  return { proc, send, onResponse };
}

describe("MCP server", () => {
  let server;

  after(() => {
    if (server?.proc) {
      server.proc.kill();
    }
  });

  it("initializes and lists the detect_code_duplication tool", async () => {
    server = startServer();

    // Initialize
    server.send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0.0" },
      },
    });

    const initResult = await server.onResponse();
    assert.equal(initResult.id, 1);
    assert.equal(initResult.result.serverInfo.name, "drywall");

    // Send initialized notification
    server.send({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    // List tools
    server.send({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {},
    });

    const listResult = await server.onResponse();
    assert.equal(listResult.id, 2);
    assert.ok(
      !listResult.error,
      `tools/list returned error: ${JSON.stringify(listResult.error)}`,
    );

    const tools = listResult.result.tools;
    assert.equal(tools.length, 1);
    assert.equal(tools[0].name, "detect_code_duplication");

    const schema = tools[0].inputSchema;
    assert.equal(schema.type, "object");
    assert.ok(schema.properties.path, "missing path property");
    assert.ok(schema.properties.options, "missing options property");
    assert.equal(schema.properties.path.type, "string");
    assert.equal(schema.properties.options.type, "object");
  });
});
