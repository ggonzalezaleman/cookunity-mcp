import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CookUnityAPI } from "../services/api.js";
import { AddToCartSchema, RemoveFromCartSchema, ClearCartSchema, ConfirmOrderSchema } from "../schemas/index.js";
import type { AddToCartInput, RemoveFromCartInput, ClearCartInput, ConfirmOrderInput } from "../schemas/index.js";
import { handleError, toStructured } from "../services/helpers.js";

export function registerCartTools(server: McpServer, api: CookUnityAPI): void {
  server.registerTool(
    "cookunity_add_to_cart",
    {
      title: "Add Meal to CookUnity Cart",
      description: `Add a meal to the cart for a specific delivery date.

Args:
  - date (string, required): YYYY-MM-DD delivery date
  - inventory_id (string, required): Inventory ID from menu/search results
  - quantity (number): Portions to add, default 1 (max 10)
  - batch_id (number, optional): Batch ID from menu results

Returns: Confirmation with updated quantity

Examples:
  - Add one meal: { date: "2025-02-24", inventory_id: "ABC123" }
  - Add 2 portions: { date: "2025-02-24", inventory_id: "ABC123", quantity: 2 }

Error Handling:
  - Invalid inventory_id: API returns error
  - Past cutoff: API returns error — check cutoff with cookunity_list_deliveries first`,
      inputSchema: AddToCartSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: AddToCartInput) => {
      try {
        const result = await api.addMeal(params.date, params.inventory_id, params.quantity, params.batch_id);
        const output = {
          success: true,
          date: params.date,
          inventory_id: result.inventoryId,
          quantity: result.qty,
          message: `Added ${params.quantity} portion(s) to cart for ${params.date}.`,
        };
        return { content: [{ type: "text", text: output.message }], structuredContent: toStructured(output) };
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.registerTool(
    "cookunity_remove_from_cart",
    {
      title: "Remove Meal from CookUnity Cart",
      description: `Remove a meal from the cart for a specific delivery date.

Args:
  - date (string, required): YYYY-MM-DD delivery date
  - inventory_id (string, required): Inventory ID of meal to remove
  - quantity (number): Portions to remove, default 1

Returns: Confirmation with updated quantity

Error Handling:
  - Meal not in cart: API returns error`,
      inputSchema: RemoveFromCartSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: RemoveFromCartInput) => {
      try {
        const result = await api.removeMeal(params.date, params.inventory_id, params.quantity);
        const output = {
          success: true,
          date: params.date,
          inventory_id: result.inventoryId,
          remaining_quantity: result.qty,
          message: `Removed ${params.quantity} portion(s) from cart for ${params.date}.`,
        };
        return { content: [{ type: "text", text: output.message }], structuredContent: toStructured(output) };
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.registerTool(
    "cookunity_clear_cart",
    {
      title: "Clear CookUnity Cart",
      description: `Clear all items from the cart for a specific delivery date. This removes ALL meals.

Args:
  - date (string, required): YYYY-MM-DD delivery date

Returns: Confirmation message

Error Handling:
  - Past cutoff: API returns error`,
      inputSchema: ClearCartSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: ClearCartInput) => {
      try {
        await api.clearCart(params.date);
        const output = { success: true, date: params.date, message: `Cart cleared for ${params.date}.` };
        return { content: [{ type: "text", text: output.message }], structuredContent: toStructured(output) };
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.registerTool(
    "cookunity_confirm_order",
    {
      title: "Confirm CookUnity Order",
      description: `Confirm/place the order for a delivery date. Takes the current cart contents and submits them as an order.

Prerequisites:
  - Meals must be in the cart (use cookunity_add_to_cart first)
  - Must be before the cutoff (check with cookunity_list_deliveries)
  - Cart should have enough meals to meet the plan minimum (typically 6)

Args:
  - date (string, required): YYYY-MM-DD delivery date
  - comment (string, optional): Delivery instructions
  - tip (number, optional): Tip amount in dollars

Returns: Order confirmation with ID and payment status, or error with out-of-stock meal IDs

Important: Without confirming, cart items are NOT locked in. CookUnity will auto-fill with recommendations at cutoff instead.`,
      inputSchema: ConfirmOrderSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (params: ConfirmOrderInput) => {
      try {
        // Get upcoming days to find cart contents and delivery window
        const days = await api.getUpcomingDays();
        const day = days.find((d) => d.date === params.date);
        if (!day) {
          return { content: [{ type: "text", text: `No delivery found for ${params.date}. Check available dates with cookunity_list_deliveries.` }], isError: true };
        }
        if (!day.cart || day.cart.length === 0) {
          return { content: [{ type: "text", text: `Cart is empty for ${params.date}. Add meals first with cookunity_add_to_cart.` }], isError: true };
        }

        const products = day.cart.map((item) => ({
          qty: item.qty,
          inventoryId: item.product.inventoryId,
        }));

        // Pull delivery window from user profile, fallback to common defaults
        let start = "11:00";
        let end = "20:00";
        try {
          const userInfo = await api.getUserInfo();
          if (userInfo.deliveryDays?.length) {
            start = userInfo.deliveryDays[0].time_start ?? start;
            end = userInfo.deliveryDays[0].time_end ?? end;
          }
        } catch {
          // Fall back to defaults if user info fetch fails
        }

        const result = await api.createOrder(params.date, start, end, products, {
          comment: params.comment,
          tip: params.tip,
        });

        if (result.__typename === "OrderCreationError") {
          const msg = result.error || "Unknown error";
          const oos = result.outOfStockIds?.length ? ` Out of stock: ${result.outOfStockIds.join(", ")}` : "";
          return { content: [{ type: "text", text: `Order failed: ${msg}${oos}` }], isError: true };
        }

        const output = {
          success: true,
          order_id: result.id,
          delivery_date: result.deliveryDate,
          payment_status: result.paymentStatus,
          meals_confirmed: products.length,
          message: `Order confirmed for ${params.date}! ${products.length} meals locked in. Order ID: ${result.id}`,
        };
        return { content: [{ type: "text", text: output.message }], structuredContent: toStructured(output) };
      } catch (error) {
        return handleError(error);
      }
    }
  );
}
