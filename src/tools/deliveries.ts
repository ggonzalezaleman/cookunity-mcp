import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CookUnityAPI } from "../services/api.js";
import {
  ListDeliveriesSchema,
  GetCartSchema,
  SkipDeliverySchema,
  UnskipDeliverySchema,
} from "../schemas/index.js";
import type {
  ListDeliveriesInput,
  GetCartInput,
  SkipDeliveryInput,
  UnskipDeliveryInput,
} from "../schemas/index.js";
import { ResponseFormat } from "../constants.js";
import { getNextMonday, formatDelivery, handleError, toStructured } from "../services/helpers.js";

export function registerDeliveryTools(server: McpServer, api: CookUnityAPI): void {
  server.registerTool(
    "cookunity_list_deliveries",
    {
      title: "List Upcoming CookUnity Deliveries",
      description: `List upcoming delivery weeks with status (locked/active/skipped/paused), cart contents, and cutoff deadlines. This is the primary tool for understanding the user's delivery calendar. Only shows Monday delivery days.

Args:
  - response_format ('markdown'|'json')

Returns (JSON): { deliveries[{ date, status, can_edit, menu_available, cutoff, cutoff_timezone, cart_items[], cart_count }] }

Examples:
  - See upcoming weeks: {}
  - Check what's in my carts: {}

Error Handling:
  - Auth errors suggest checking credentials`,
      inputSchema: ListDeliveriesSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ListDeliveriesInput) => {
      try {
        const days = await api.getUpcomingDays();
        // Filter to scheduled delivery days only
        const scheduledDays = days.filter((d) => d.scheduled);
        const deliveries = scheduledDays.map(formatDelivery);

        const output = { total: deliveries.length, deliveries };

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: toStructured(output) };
        }

        const lines = ["# Upcoming Deliveries", ""];
        for (const d of deliveries) {
          const statusEmoji = d.status === "active" ? "✅" : d.status === "skipped" ? "⏭️" : d.status === "paused" ? "⏸️" : "🔒";
          lines.push(`## ${d.date} ${statusEmoji} ${d.status.toUpperCase()}`);
          if (d.cutoff) lines.push(`**Cutoff**: ${d.cutoff} (${d.cutoff_timezone ?? ""})`);
          lines.push(`**Editable**: ${d.can_edit ? "Yes" : "No"} | **Menu available**: ${d.menu_available ? "Yes" : "No"}`);

          if (d.order) {
            lines.push(`**Order** #${d.order.id} (${d.order.status ?? "unknown"}, $${d.order.grand_total.toFixed(2)}):`);
            for (const item of d.order.items) {
              lines.push(`  - ${item.name} x${item.quantity} — $${item.price.toFixed(2)} (${item.chef})`);
            }
          } else if (d.cart_count > 0) {
            lines.push(`**Cart** (${d.cart_count} items):`);
            for (const item of d.cart_items) {
              lines.push(`  - ${item.name} x${item.quantity} — $${item.price.toFixed(2)} (${item.chef})`);
            }
          } else if (d.recommendation_count > 0) {
            lines.push(`**CookUnity Picks** (${d.recommendation_count} meals — not yet confirmed):`);
            for (const item of d.recommendation_items) {
              lines.push(`  - ${item.name} x${item.quantity} (${item.chef})`);
            }
          } else {
            lines.push("**Meals**: None selected");
          }
          lines.push("");
        }
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructured(output) };
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.registerTool(
    "cookunity_get_cart",
    {
      title: "Get CookUnity Cart",
      description: `Get cart contents for a specific delivery date.

Args:
  - date (string, optional): YYYY-MM-DD. Defaults to next Monday.
  - response_format ('markdown'|'json')

Returns (JSON): { date, can_edit, is_skipped, cutoff, items[{ name, inventory_id, quantity, price, chef }], total_items, total_price }

Error Handling:
  - Returns "Date not found" if date is not in upcoming deliveries`,
      inputSchema: GetCartSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetCartInput) => {
      try {
        const date = params.date ?? getNextMonday();
        const days = await api.getUpcomingDays();
        const day = days.find((d) => d.date === date || d.displayDate === date);
        if (!day) {
          return { content: [{ type: "text", text: `Error: Date ${date} not found in upcoming deliveries. Use cookunity_list_deliveries to see available dates.` }], isError: true };
        }

        const items = (day.cart || []).map((c) => ({
          name: c.product?.name ?? "Unknown",
          inventory_id: c.product?.inventoryId ?? "",
          quantity: c.qty,
          price: c.product?.price_incl_tax ?? 0,
          chef: `${c.product?.chef_firstname ?? ""} ${c.product?.chef_lastname ?? ""}`.trim(),
        }));

        const output = {
          date: day.displayDate,
          can_edit: day.canEdit,
          is_skipped: day.skip,
          cutoff: day.cutoff?.time ?? null,
          items,
          total_items: items.reduce((s, i) => s + i.quantity, 0),
          total_price: items.reduce((s, i) => s + i.price * i.quantity, 0),
        };

        if (params.response_format === ResponseFormat.JSON) {
          return { content: [{ type: "text", text: JSON.stringify(output, null, 2) }], structuredContent: toStructured(output) };
        }

        const lines = [`# Cart — ${output.date}`, `Status: ${day.skip ? "Skipped" : day.canEdit ? "Editable" : "Locked"}`, ""];
        if (items.length === 0) {
          lines.push("Cart is empty.");
        } else {
          for (const item of items) {
            lines.push(`- **${item.name}** x${item.quantity} — $${item.price.toFixed(2)} (${item.chef})`);
          }
          lines.push("", `**Total**: ${output.total_items} items, $${output.total_price.toFixed(2)}`);
        }
        return { content: [{ type: "text", text: lines.join("\n") }], structuredContent: toStructured(output) };
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.registerTool(
    "cookunity_skip_delivery",
    {
      title: "Skip CookUnity Delivery",
      description: `Skip a delivery week. IMPORTANT: Always call cookunity_list_deliveries first to get valid delivery dates — do NOT guess or calculate dates manually.

Args:
  - date (string, required): YYYY-MM-DD delivery date to skip (must match an actual delivery date from cookunity_list_deliveries)

Returns: Confirmation message with skip ID

Error Handling:
  - Invalid date: returns available delivery dates
  - Past cutoff: returns error suggesting checking cutoff with list_deliveries
  - Already skipped: returns API error`,
      inputSchema: SkipDeliverySchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: SkipDeliveryInput) => {
      try {
        // Validate date against actual upcoming deliveries
        const days = await api.getUpcomingDays();
        const validDates = days.map((d) => d.date);
        if (!validDates.includes(params.date)) {
          return { content: [{ type: "text", text: `Error: "${params.date}" is not a valid delivery date. Available dates: ${validDates.join(", ")}. Use cookunity_list_deliveries to see your delivery calendar.` }], isError: true };
        }
        const result = await api.skipDelivery(params.date);
        if (result.__typename === "OrderCreationError") {
          return { content: [{ type: "text", text: `Error: ${result.error ?? "Failed to skip delivery"}. Check cutoff with cookunity_list_deliveries.` }], isError: true };
        }
        const output = { success: true, date: params.date, skip_id: result.id, message: `Delivery for ${params.date} has been skipped.` };
        return { content: [{ type: "text", text: output.message }], structuredContent: toStructured(output) };
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.registerTool(
    "cookunity_unskip_delivery",
    {
      title: "Unskip CookUnity Delivery",
      description: `Unskip a previously skipped delivery week. IMPORTANT: Always call cookunity_list_deliveries first to get valid delivery dates — do NOT guess or calculate dates manually.

Args:
  - date (string, required): YYYY-MM-DD delivery date to unskip (must match an actual delivery date from cookunity_list_deliveries)

Returns: Confirmation message

Error Handling:
  - Invalid date: returns available delivery dates
  - Week not skipped: returns API error`,
      inputSchema: UnskipDeliverySchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: UnskipDeliveryInput) => {
      try {
        // Validate date against actual upcoming deliveries
        const days = await api.getUpcomingDays();
        const validDates = days.map((d) => d.date);
        if (!validDates.includes(params.date)) {
          return { content: [{ type: "text", text: `Error: "${params.date}" is not a valid delivery date. Available dates: ${validDates.join(", ")}. Use cookunity_list_deliveries to see your delivery calendar.` }], isError: true };
        }
        const result = await api.unskipDelivery(params.date);
        if (result.__typename === "OrderCreationError") {
          return { content: [{ type: "text", text: `Error: ${result.error ?? "Failed to unskip delivery"}.` }], isError: true };
        }
        const output = { success: true, date: params.date, message: `Delivery for ${params.date} has been unskipped.` };
        return { content: [{ type: "text", text: output.message }], structuredContent: toStructured(output) };
      } catch (error) {
        return handleError(error);
      }
    }
  );
}
