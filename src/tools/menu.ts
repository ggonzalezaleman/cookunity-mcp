import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CookUnityAPI } from "../services/api.js";
import { GetMenuSchema, SearchMealsSchema, GetMealDetailsSchema } from "../schemas/index.js";
import type { GetMenuInput, SearchMealsInput, GetMealDetailsInput } from "../schemas/index.js";
import type { DetailedMeal } from "../types.js";
import { ResponseFormat } from "../constants.js";
import { getNextMonday, formatMeal, formatMealMarkdown, handleError, toStructured } from "../services/helpers.js";
export function registerMenuTools(server: McpServer, api: CookUnityAPI): void {
  server.registerTool(
    "cookunity_get_menu",
    {
      title: "Browse CookUnity Menu",
      description: `Browse available meals for a delivery date with optional filters and pagination.

Args:
  - date (string, optional): YYYY-MM-DD delivery date. Defaults to next Monday.
  - category (string, optional): Filter by category (e.g. 'Bowls', 'Protein+')
  - diet (string, optional): Filter by diet tag (e.g. 'vegan', 'gluten-free')
  - max_price (number, optional): Max price in dollars
  - min_rating (number, optional): Min rating 0-5
  - limit (number): Results per page, default 20, max 50
  - offset (number): Pagination offset, default 0
  - response_format ('markdown'|'json'): Output format

Returns (JSON): { total, count, offset, has_more, next_offset?, categories, meals[] }
Returns (Markdown): Formatted meal cards with chef, price, rating, nutrition

Examples:
  - Browse next week's menu: {}
  - Vegan meals under $12: { diet: "vegan", max_price: 12 }
  - Page 2: { offset: 20 }

Error Handling:
  - Invalid date format returns validation error
  - API failures return actionable error with status code`,
      inputSchema: GetMenuSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetMenuInput) => {
      try {
        const date = params.date ?? getNextMonday();
        const menu = await api.getMenu(date);
        let meals = menu.meals;

        // Apply filters
        if (params.category) {
          const cat = params.category.toLowerCase();
          meals = meals.filter((m) => m.category.title.toLowerCase().includes(cat));
        }
        if (params.diet) {
          const diet = params.diet.toLowerCase();
          meals = meals.filter((m) => m.searchBy.dietTags.some((t) => t.toLowerCase().includes(diet)));
        }
        if (params.max_price !== undefined) {
          meals = meals.filter((m) => m.finalPrice <= params.max_price!);
        }
        if (params.min_rating !== undefined) {
          meals = meals.filter((m) => m.userRating >= params.min_rating!);
        }

        const total = meals.length;
        const paged = meals.slice(params.offset, params.offset + params.limit);
        const formatted = paged.map(formatMeal);
        const hasMore = total > params.offset + paged.length;

        const output = {
          date,
          total,
          count: formatted.length,
          offset: params.offset,
          has_more: hasMore,
          ...(hasMore ? { next_offset: params.offset + paged.length } : {}),
          categories: menu.categories.map((c) => ({ id: c.id, title: c.title })),
          meals: formatted,
        };

        let text: string;
        if (params.response_format === ResponseFormat.JSON) {
          text = JSON.stringify(output, null, 2);
        } else {
          const lines = [
            `# CookUnity Menu — ${date}`,
            `Showing ${formatted.length} of ${total} meals (offset ${params.offset})`,
            "",
          ];
          for (const m of formatted) {
            lines.push(formatMealMarkdown(m));
            lines.push("");
          }
          if (hasMore) lines.push(`*More meals available. Use offset: ${params.offset + paged.length} to see next page.*`);
          text = lines.join("\n");
        }

        return { content: [{ type: "text", text }], structuredContent: toStructured(output) };
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.registerTool(
    "cookunity_search_meals",
    {
      title: "Search CookUnity Meals",
      description: `Search meals by keyword across name, description, cuisine, chef, ingredients, and diet tags.

Args:
  - query (string, required): Search keyword (min 1 char)
  - date (string, optional): YYYY-MM-DD. Defaults to next Monday.
  - limit (number): Results per page, default 20
  - offset (number): Pagination offset
  - response_format ('markdown'|'json'): Output format

Returns (JSON): { query, date, total, count, offset, has_more, meals[] }

Examples:
  - Find salmon dishes: { query: "salmon" }
  - Vegan meals: { query: "vegan" }
  - Chef search: { query: "Mario" }

Error Handling:
  - Empty query returns validation error`,
      inputSchema: SearchMealsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: SearchMealsInput) => {
      try {
        const date = params.date ?? getNextMonday();
        const results = await api.searchMeals(params.query, date);
        const total = results.length;
        const paged = results.slice(params.offset, params.offset + params.limit);
        const formatted = paged.map(formatMeal);
        const hasMore = total > params.offset + paged.length;

        const output = {
          query: params.query,
          date,
          total,
          count: formatted.length,
          offset: params.offset,
          has_more: hasMore,
          ...(hasMore ? { next_offset: params.offset + paged.length } : {}),
          meals: formatted,
        };

        let text: string;
        if (params.response_format === ResponseFormat.JSON) {
          text = JSON.stringify(output, null, 2);
        } else {
          const lines = [`# Search: "${params.query}" — ${date}`, `Found ${total} meals`, ""];
          for (const m of formatted) {
            lines.push(formatMealMarkdown(m));
            lines.push("");
          }
          if (hasMore) lines.push(`*Use offset: ${params.offset + paged.length} for more results.*`);
          text = lines.join("\n");
        }

        return { content: [{ type: "text", text }], structuredContent: toStructured(output) };
      } catch (error) {
        return handleError(error);
      }
    }
  );

  server.registerTool(
    "cookunity_get_meal_details",
    {
      title: "Get CookUnity Meal Details",
      description: `Get full details for a specific meal including allergens, complete ingredients list, nutrition facts, diet tags, and chef info.

Args:
  - meal_id (number, optional): Numeric meal ID (e.g. 12272)
  - inventory_id (string, optional): Inventory ID (e.g. "ii-135055242")
  - date (string, optional): YYYY-MM-DD menu date. Defaults to next Monday.
  - response_format ('markdown'|'json'): Output format

At least one of meal_id or inventory_id is required.

Returns (JSON): Full meal object with allergens[], ingredients[], nutritionalFacts (incl. protein, sugar), searchBy tags, chef info
Returns (Markdown): Formatted card with sections for Description, Nutrition, Ingredients, Allergens, Chef, Tags

Examples:
  - By ID: { meal_id: 12272 }
  - By inventory: { inventory_id: "ii-135055242" }
  - Specific week: { meal_id: 12272, date: "2026-02-23" }

Error Handling:
  - Meal not found: suggests checking the date or using cookunity_search_meals`,
      inputSchema: GetMealDetailsSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params: GetMealDetailsInput) => {
      try {
        const date = params.date ?? getNextMonday();
        const meals = await api.getMenuDetailed(date);

        const meal = meals.find((m) => {
          if (params.meal_id !== undefined && String(m.id) === String(params.meal_id)) return true;
          if (params.inventory_id !== undefined && m.inventoryId === params.inventory_id) return true;
          return false;
        });

        if (!meal) {
          const identifier = params.meal_id !== undefined ? `meal_id=${params.meal_id}` : `inventory_id=${params.inventory_id}`;
          return {
            content: [{ type: "text" as const, text: `Error: Meal not found (${identifier}) for date ${date}. The menu changes weekly — try a different date or use cookunity_search_meals to find the meal.` }],
            isError: true,
          };
        }

        const output = {
          id: meal.id,
          name: meal.name,
          description: meal.shortDescription,
          sku: meal.sku,
          batch_id: meal.batchId,
          inventory_id: meal.inventoryId,
          price: meal.finalPrice,
          original_price: meal.price,
          premium_fee: meal.premiumFee,
          rating: meal.userRating,
          in_stock: meal.stock > 0,
          stock: meal.stock,
          is_new: meal.isNewMeal,
          image: meal.image,
          meat_type: meal.meatType,
          category: meal.category.title,
          chef: {
            id: meal.chef.id,
            name: `${meal.chef.firstName} ${meal.chef.lastName}`,
          },
          nutrition: meal.nutritionalFacts,
          allergens: (meal.allergens || []).map((a) => a.name),
          ingredients: (meal.ingredients || []).map((i) => i.name),
          tags: {
            cuisines: meal.searchBy.cuisines,
            diet_tags: meal.searchBy.dietTags,
            protein_tags: meal.searchBy.proteinTags,
          },
          date,
        };

        let text: string;
        if (params.response_format === ResponseFormat.JSON) {
          text = JSON.stringify(output, null, 2);
        } else {
          const n = meal.nutritionalFacts;
          const lines = [
            `# ${meal.name}${meal.isNewMeal ? " 🆕" : ""}`,
            `*${meal.shortDescription}*`,
            "",
            "## Details",
            `**Chef**: ${output.chef.name}`,
            `**Category**: ${output.category} | **Meat type**: ${meal.meatType}`,
            `**Price**: $${meal.finalPrice.toFixed(2)}${meal.premiumFee > 0 ? ` (+$${meal.premiumFee.toFixed(2)} premium)` : ""}`,
            `**Rating**: ${meal.userRating}/5 | **Stock**: ${meal.stock > 0 ? meal.stock : "Out of stock"}`,
            `**SKU**: ${meal.sku} | **Inventory ID**: \`${meal.inventoryId}\``,
            "",
            "## Nutrition",
            `| Nutrient | Amount |`,
            `|----------|--------|`,
            `| Calories | ${n.calories} |`,
            `| Protein  | ${n.protein ?? "—"} g |`,
            `| Fat      | ${n.fat} g |`,
            `| Carbs    | ${n.carbs} g |`,
            `| Fiber    | ${n.fiber} g |`,
            `| Sugar    | ${n.sugar ?? "—"} g |`,
            `| Sodium   | ${n.sodium} mg |`,
            "",
            "## Ingredients",
            (meal.ingredients || []).length > 0
              ? (meal.ingredients || []).map((i) => `- ${i.name}`).join("\n")
              : "_No ingredient data available_",
            "",
            "## Allergens",
            (meal.allergens || []).length > 0
              ? (meal.allergens || []).map((a) => `⚠️ ${a.name}`).join(", ")
              : "_No allergens listed_",
            "",
            "## Tags",
          ];
          if (meal.searchBy.dietTags.length > 0) lines.push(`**Diet**: ${meal.searchBy.dietTags.join(", ")}`);
          if (meal.searchBy.cuisines.length > 0) lines.push(`**Cuisines**: ${meal.searchBy.cuisines.join(", ")}`);
          if (meal.searchBy.proteinTags.length > 0) lines.push(`**Protein**: ${meal.searchBy.proteinTags.join(", ")}`);
          text = lines.join("\n");
        }

        return { content: [{ type: "text", text }], structuredContent: toStructured(output) };
      } catch (error) {
        return handleError(error);
      }
    }
  );

}
