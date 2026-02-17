import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CookUnityAPI } from "../services/api.js";
import { GetUserInfoSchema, ListOrdersSchema, GetOrderHistorySchema } from "../schemas/index.js";
import type { GetUserInfoInput, ListOrdersInput, GetOrderHistoryInput } from "../schemas/index.js";
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

  server.registerTool(
    "cookunity_order_history",
    {
      title: "Get CookUnity Order History with Meals",
      description: `Get past order invoices with full meal details, prices, reviews, and billing breakdown for a date range. This is the only way to see what meals were in past deliveries.

IMPORTANT: Always call this tool FRESH when the user asks about past orders or meals. NEVER rely on cached or previously returned data.

Args:
  - from (string, required): Start date YYYY-MM-DD (inclusive)
  - to (string, required): End date YYYY-MM-DD (inclusive)
  - limit (number): Invoices per page, default 10 (max 50)
  - offset (number): Pagination offset
  - response_format ('markdown'|'json')

Returns (JSON): { total, invoices[{ id, date, total, subtotal, taxes, deliveryFee, tip, discount, orders[{ delivery_date, items[{ name, chef, price, calories, rating, review }] }] }] }

Examples:
  - Last month: { from: "2026-01-01", to: "2026-01-31" }
  - Specific week: { from: "2026-02-03", to: "2026-02-09" }
  - All of 2025: { from: "2025-01-01", to: "2025-12-31", limit: 50 }

Error Handling:
  - Auth errors suggest checking credentials
  - Empty results if no invoices in date range`,
      inputSchema: GetOrderHistorySchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetOrderHistoryInput) => {
      try {
        const invoices = await api.getInvoices(params.from, params.to, params.offset, params.limit);
        const total = invoices.length;

        const formatted = invoices.map((inv) => ({
          id: inv.id,
          date: inv.date,
          subtotal: inv.subtotal,
          delivery_fee: inv.deliveryFee,
          express_fee: inv.expressFee,
          taxes: inv.taxes,
          tip: inv.tip,
          discount: inv.discount,
          credit_applied: inv.chargedCredit,
          total: inv.total,
          payment: inv.ccNumber,
          orders: inv.orders.map((order) => ({
            delivery_date: order.delivery_date,
            display_date: order.display_date,
            delivery_window: `${order.time_start} – ${order.time_end}`,
            items: order.items.map((item) => ({
              name: item.product.name,
              description: item.product.short_description,
              chef: `${item.product.chef_firstname} ${item.product.chef_lastname}`.trim(),
              price: item.price.price,
              price_incl_tax: item.price.priceIncludingTax,
              original_price: item.price.originalPrice,
              calories: parseInt(item.product.calories, 10) || null,
              meat_type: item.product.meat_type,
              quantity: item.qty,
              rating: item.product.user_rating,
              review: item.product.review
                ? { rating: item.product.review.rating, text: item.product.review.review }
                : null,
            })),
          })),
        }));

        const output = { total, offset: params.offset, invoices: formatted };

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: toStructured(output) };
        }

        const lines = [`# Order History (${params.from} → ${params.to})`, `${total} invoice(s)`, ""];
        for (const inv of formatted) {
          lines.push(`## Invoice ${inv.id} — ${inv.date}`);
          lines.push(`**Total**: $${inv.total.toFixed(2)} (subtotal $${inv.subtotal.toFixed(2)} + tax $${inv.taxes.toFixed(2)} + delivery $${inv.delivery_fee.toFixed(2)}${inv.tip > 0 ? ` + tip $${inv.tip.toFixed(2)}` : ""}${inv.discount > 0 ? ` − discount $${inv.discount.toFixed(2)}` : ""})`);
          for (const order of inv.orders) {
            lines.push(`### Delivery: ${order.delivery_date} (${order.delivery_window})`);
            for (const item of order.items) {
              const ratingStr = item.rating != null ? ` ⭐${item.rating}` : "";
              lines.push(`- **${item.name}** x${item.quantity} — $${item.price.toFixed(2)} (${item.chef})${ratingStr}`);
              if (item.description) lines.push(`  _${item.description}_`);
              if (item.review?.text) lines.push(`  > "${item.review.text}"`);
            }
          }
          lines.push("");
        }
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructured(output) };
      } catch (error) {
        return handleError(error);
      }
    }
  );
}
