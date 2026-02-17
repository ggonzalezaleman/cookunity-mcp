import { z } from "zod";
import { ResponseFormat, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "../constants.js";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const DateSchema = z
  .string()
  .regex(datePattern, "Date must be YYYY-MM-DD format")
  .describe("Delivery date in YYYY-MM-DD format (must be a Monday). Defaults to next Monday if omitted.");

export const ResponseFormatSchema = z
  .nativeEnum(ResponseFormat)
  .default(ResponseFormat.MARKDOWN)
  .describe("Output format: 'markdown' for human-readable or 'json' for structured data");

export const GetMenuSchema = z.object({
  date: DateSchema.optional(),
  category: z.string().optional().describe("Filter by category title (e.g. 'Bowls', 'Protein+')"),
  diet: z.string().optional().describe("Filter by diet tag (e.g. 'gluten-free', 'vegan', 'dairy-free')"),
  max_price: z.number().min(0).optional().describe("Maximum price filter in dollars"),
  min_rating: z.number().min(0).max(5).optional().describe("Minimum rating filter (0-5)"),
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE).describe("Results per page (max 50)"),
  offset: z.number().int().min(0).default(0).describe("Number of results to skip for pagination"),
  response_format: ResponseFormatSchema,
}).strict();

export const SearchMealsSchema = z.object({
  query: z.string().min(1, "Search query is required").max(200).describe("Keyword to search across meal name, description, cuisine, chef, ingredients, diet tags"),
  date: DateSchema.optional(),
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE).describe("Results per page"),
  offset: z.number().int().min(0).default(0).describe("Pagination offset"),
  response_format: ResponseFormatSchema,
}).strict();

export const GetUserInfoSchema = z.object({
  response_format: ResponseFormatSchema,
}).strict();

export const ListOrdersSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20).describe("Number of orders to return"),
  offset: z.number().int().min(0).default(0).describe("Pagination offset"),
  response_format: ResponseFormatSchema,
}).strict();

export const ListDeliveriesSchema = z.object({
  response_format: ResponseFormatSchema,
}).strict();

export const GetCartSchema = z.object({
  date: DateSchema.optional(),
  response_format: ResponseFormatSchema,
}).strict();

export const AddToCartSchema = z.object({
  date: DateSchema,
  inventory_id: z.string().min(1).describe("Inventory ID of the meal (from menu/search results)"),
  quantity: z.number().int().min(1).max(10).default(1).describe("Number of portions to add"),
  batch_id: z.number().int().optional().describe("Batch ID of the meal (optional, from menu results)"),
}).strict();

export const RemoveFromCartSchema = z.object({
  date: DateSchema,
  inventory_id: z.string().min(1).describe("Inventory ID of the meal to remove"),
  quantity: z.number().int().min(1).max(10).default(1).describe("Number of portions to remove"),
}).strict();

export const ClearCartSchema = z.object({
  date: DateSchema,
}).strict();

export const SkipDeliverySchema = z.object({
  date: DateSchema,
}).strict();

export const UnskipDeliverySchema = z.object({
  date: DateSchema,
}).strict();

export const GetPriceBreakdownSchema = z.object({
  date: DateSchema.optional(),
  meals: z.array(z.object({
    entityId: z.union([z.string(), z.number()]).describe("Meal ID (numeric)"),
    quantity: z.number().int().min(1).default(1).describe("Quantity"),
    inventoryId: z.string().describe("Inventory ID (e.g. 'ii-135055242')"),
  })).optional().describe("Meals to price. If omitted, uses current cart contents for the date."),
  response_format: ResponseFormatSchema,
}).strict();

export type GetPriceBreakdownInput = z.infer<typeof GetPriceBreakdownSchema>;

export const GetMealDetailsSchema = z.object({
  meal_id: z.number().int().optional().describe("Numeric meal ID (e.g. 12272). Provide meal_id or inventory_id."),
  inventory_id: z.string().optional().describe("Inventory ID string (e.g. 'ii-135055242'). Provide meal_id or inventory_id."),
  date: DateSchema.optional(),
  response_format: ResponseFormatSchema,
}).strict();

export type GetMenuInput = z.infer<typeof GetMenuSchema>;
export type SearchMealsInput = z.infer<typeof SearchMealsSchema>;
export type GetUserInfoInput = z.infer<typeof GetUserInfoSchema>;
export type ListOrdersInput = z.infer<typeof ListOrdersSchema>;
export type ListDeliveriesInput = z.infer<typeof ListDeliveriesSchema>;
export type GetCartInput = z.infer<typeof GetCartSchema>;
export type AddToCartInput = z.infer<typeof AddToCartSchema>;
export type RemoveFromCartInput = z.infer<typeof RemoveFromCartSchema>;
export type ClearCartInput = z.infer<typeof ClearCartSchema>;
export type SkipDeliveryInput = z.infer<typeof SkipDeliverySchema>;
export type UnskipDeliveryInput = z.infer<typeof UnskipDeliverySchema>;
export const ConfirmOrderSchema = z.object({
  date: DateSchema,
  comment: z.string().optional().describe("Delivery instructions or comment"),
  tip: z.number().min(0).optional().describe("Tip amount in dollars"),
}).strict();

export const NextDeliverySchema = z.object({
  response_format: ResponseFormatSchema,
}).strict();

export type GetMealDetailsInput = z.infer<typeof GetMealDetailsSchema>;
export const GetOrderHistorySchema = z.object({
  from: z.string().regex(datePattern, "Date must be YYYY-MM-DD format").describe("Start date (inclusive) for invoice range, e.g. '2025-01-01'"),
  to: z.string().regex(datePattern, "Date must be YYYY-MM-DD format").describe("End date (inclusive) for invoice range, e.g. '2025-12-31'"),
  limit: z.number().int().min(1).max(50).default(10).describe("Number of invoices to return (max 50)"),
  offset: z.number().int().min(0).default(0).describe("Pagination offset"),
  response_format: ResponseFormatSchema,
}).strict();

export type ConfirmOrderInput = z.infer<typeof ConfirmOrderSchema>;
export type NextDeliveryInput = z.infer<typeof NextDeliverySchema>;
export type GetOrderHistoryInput = z.infer<typeof GetOrderHistorySchema>;
