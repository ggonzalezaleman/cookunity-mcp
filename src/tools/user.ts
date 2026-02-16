import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CookUnityAPI } from "../services/api.js";
import { GetUserInfoSchema, ListOrdersSchema } from "../schemas/index.js";
import type { GetUserInfoInput, ListOrdersInput } from "../schemas/index.js";
import { ResponseFormat } from "../constants.js";
import { handleError, toStructured } from "../services/helpers.js";

export function registerUserTools(server: McpServer, api: CookUnityAPI): void {
  server.registerTool(
    "cookunity_get_user_info",
    {
      title: "Get CookUnity User Info",
      description: `Get user profile, subscription plan, delivery schedule, addresses, and credits.

Args:
  - response_format ('markdown'|'json'): Output format

Returns (JSON): { id, name, email, plan_id, store_id, status, deliveryDays[], currentCredit, addresses[] }

Examples:
  - Get profile: {}
  - Get as JSON: { response_format: "json" }`,
      inputSchema: GetUserInfoSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetUserInfoInput) => {
      try {
        const user = await api.getUserInfo();
        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(user, null, 2) }], structuredContent: toStructured(user) };
        }
        const lines = [
          `# CookUnity Profile`,
          `**Name**: ${user.name}`,
          `**Email**: ${user.email}`,
          `**Status**: ${user.status}`,
          `**Plan ID**: ${user.plan_id}`,
          `**Credit**: $${user.currentCredit.toFixed(2)}`,
          "",
          "## Delivery Schedule",
          ...user.deliveryDays.map((d) => `- ${d.day}: ${d.time_start} – ${d.time_end}`),
          "",
          "## Addresses",
          ...user.addresses.map((a) => `- ${a.street}, ${a.city}, ${a.region} ${a.postcode}${a.isActive ? " ✅" : ""}`),
        ];
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructured(user) };
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.registerTool(
    "cookunity_list_orders",
    {
      title: "List CookUnity Orders",
      description: `Get order history with delivery dates, paginated.

Args:
  - limit (number): Orders per page, default 20
  - offset (number): Pagination offset
  - response_format ('markdown'|'json')

Returns (JSON): { total, count, offset, has_more, orders[{ id, deliveryDate }] }`,
      inputSchema: ListOrdersSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListOrdersInput) => {
      try {
        const allOrders = await api.getAllOrders();
        const total = allOrders.length;
        const paged = allOrders.slice(params.offset, params.offset + params.limit);
        const hasMore = total > params.offset + paged.length;

        const output = {
          total,
          count: paged.length,
          offset: params.offset,
          has_more: hasMore,
          ...(hasMore ? { next_offset: params.offset + paged.length } : {}),
          orders: paged,
        };

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: toStructured(output) };
        }
        const lines = [`# Order History`, `${total} total orders (showing ${paged.length})`, ""];
        for (const o of paged) {
          lines.push(`- **${o.deliveryDate}** (ID: ${o.id})`);
        }
        if (hasMore) lines.push("", `*Use offset: ${params.offset + paged.length} for more.*`);
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructured(output) };
      } catch (error) {
        return handleError(error);
      }
    }
  );
}
