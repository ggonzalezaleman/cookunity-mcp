#!/usr/bin/env node
/**
 * CookUnity MCP Server
 *
 * Provides tools to interact with CookUnity meal delivery service:
 * browse menus, manage carts, skip/unskip deliveries, and view order history.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CookUnityAPI } from "./services/api.js";
import { registerMenuTools } from "./tools/menu.js";
import { registerUserTools } from "./tools/user.js";
import { registerDeliveryTools } from "./tools/deliveries.js";
import { registerCartTools } from "./tools/cart.js";
import { registerPricingTools } from "./tools/pricing.js";

function createServer(): McpServer {
  const email = process.env.COOKUNITY_EMAIL;
  const password = process.env.COOKUNITY_PASSWORD;

  if (!email || !password) {
    console.error("ERROR: COOKUNITY_EMAIL and COOKUNITY_PASSWORD environment variables are required.");
    process.exit(1);
  }

  const server = new McpServer({
    name: "cookunity-mcp-server",
    version: "1.0.0",
  });

  const api = new CookUnityAPI(email, password);

  registerMenuTools(server, api);
  registerUserTools(server, api);
  registerDeliveryTools(server, api);
  registerCartTools(server, api);
  registerPricingTools(server, api);

  return server;
}

async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("CookUnity MCP server running via stdio");
}

async function runHTTP(): Promise<void> {
  const { default: express } = await import("express");
  const { StreamableHTTPServerTransport } = await import(
    "@modelcontextprotocol/sdk/server/streamableHttp.js"
  );

  const server = createServer();
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT ?? "3000", 10);
  app.listen(port, () => {
    console.error(`CookUnity MCP server running on http://localhost:${port}/mcp`);
  });
}

// Signal handlers
process.on("SIGINT", () => process.exit(0));
process.on("SIGTERM", () => process.exit(0));

const transport = process.env.TRANSPORT ?? "stdio";
if (transport === "http") {
  runHTTP().catch((err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
} else {
  runStdio().catch((err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
}
