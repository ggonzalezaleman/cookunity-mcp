import axios, { AxiosError } from "axios";
import { CookUnityAuth } from "./auth.js";
import { MENU_SERVICE_URL, SUBSCRIPTION_URL } from "../constants.js";
import type {
  Menu,
  Meal,
  DetailedMeal,
  UserInfo,
  Order,
  CartItem,
  UpcomingDay,
  SkipResult,
  MealInput,
  PriceBreakdown,
} from "../types.js";

export class CookUnityAPI {
  private auth: CookUnityAuth;

  constructor(email: string, password: string) {
    this.auth = new CookUnityAuth(email, password);
  }

  async getMenu(date: string, filters: Record<string, unknown> = {}): Promise<Menu> {
    const query = `
      query getMenu($date: String!, $filters: MenuFilters!) {
        menu(date: $date, filters: $filters) {
          categories { id title subtitle label tag }
          meals {
            id batchId name shortDescription image imagePath price finalPrice premiumFee
            sku stock isNewMeal userRating inventoryId categoryId
            searchBy { cuisines chefFirstName chefLastName dietTags ingredients proteinTags }
            nutritionalFacts { calories fat carbs sodium fiber }
            chef { id firstName lastName }
            meatType category { id title label }
          }
        }
      }
    `;
    const data = await this.queryMenu(query, { date, filters });
    return data.menu as Menu;
  }

  async getMenuDetailed(date: string): Promise<DetailedMeal[]> {
    const query = `
      query getMenu($date: String!, $filters: MenuFilters!) {
        menu(date: $date, filters: $filters) {
          meals {
            id batchId name shortDescription image imagePath price finalPrice premiumFee
            sku stock isNewMeal userRating inventoryId categoryId
            searchBy { cuisines chefFirstName chefLastName dietTags ingredients proteinTags }
            nutritionalFacts { calories fat carbs sodium fiber protein sugar }
            chef { id firstName lastName }
            meatType category { id title label }
            allergens { name }
            ingredients { name }
          }
        }
      }
    `;
    const data = await this.queryMenu(query, { date, filters: {} });
    return (data.menu as { meals: DetailedMeal[] }).meals;
  }

  async getUserInfo(): Promise<UserInfo> {
    const query = `
      query {
        users {
          id name email plan_id store_id status
          deliveryDays { id day time_start time_end }
          currentCredit
          ring { id name is_local }
          addresses { id isActive city region postcode street }
          profiles { id firstname lastname }
        }
      }
    `;
    const data = await this.querySubscription(query);
    return (data.users as UserInfo[])[0];
  }

  async getAllOrders(): Promise<Order[]> {
    const data = await this.querySubscription(`query { allOrders { id deliveryDate } }`);
    return data.allOrders as Order[];
  }

  async getUpcomingDays(): Promise<UpcomingDay[]> {
    const query = `
      query {
        upcomingDays {
          id date displayDate available menuAvailable canEdit skip isPaused
          cutoff { time userTimeZone }
          cart {
            product {
              id inventoryId name sku image_path price_incl_tax realPrice
              chef_firstname chef_lastname meat_type premium_special
            }
            qty
          }
        }
      }
    `;
    const data = await this.querySubscription(query);
    return data.upcomingDays as UpcomingDay[];
  }

  async addMeal(
    date: string,
    inventoryId: string,
    quantity: number = 1,
    batchId?: number
  ): Promise<CartItem> {
    const mutation = `
      mutation addMeal($date: String!, $batch_id: Int, $quantity: Int!, $inventory_id: String) {
        addMeal(date: $date, batch_id: $batch_id, quantity: $quantity, inventory_id: $inventory_id) {
          qty: quantity
          inventoryId
        }
      }
    `;
    const data = await this.querySubscription(mutation, {
      date,
      batch_id: batchId,
      quantity,
      inventory_id: inventoryId,
    });
    return data.addMeal as CartItem;
  }

  async removeMeal(date: string, inventoryId: string, quantity: number = 1): Promise<CartItem> {
    const mutation = `
      mutation removeProductFromCart($date: String!, $quantity: Int!, $inventory_id: String) {
        deleteMeal(date: $date, quantity: $quantity, inventory_id: $inventory_id) {
          qty: quantity
          inventoryId
        }
      }
    `;
    const data = await this.querySubscription(mutation, { date, quantity, inventory_id: inventoryId });
    return data.deleteMeal as CartItem;
  }

  async clearCart(date: string): Promise<boolean> {
    await this.querySubscription(
      `mutation deleteCart($date: String!) { deleteCart(date: $date) }`,
      { date }
    );
    return true;
  }

  async skipDelivery(date: string): Promise<SkipResult> {
    const mutation = `
      mutation createSkip($skip: SkipInput!, $origin: OperationOrigin) {
        createSkip(skip: $skip, origin: $origin) {
          __typename
          ... on Skip { id }
          ... on OrderCreationError { error }
        }
      }
    `;
    const data = await this.querySubscription(mutation, {
      skip: { date, deliveryDate: date },
      origin: "unsubscription",
    });
    return data.createSkip as SkipResult;
  }

  async unskipDelivery(date: string): Promise<SkipResult> {
    const mutation = `
      mutation createUnskip($unskip: SkipInput!, $origin: OperationOrigin) {
        createUnskip(unskip: $unskip, origin: $origin) {
          __typename
          ... on Skip { id }
          ... on OrderCreationError { error }
        }
      }
    `;
    const data = await this.querySubscription(mutation, {
      unskip: { date, deliveryDate: date },
      origin: "unsubscription",
    });
    return data.createUnskip as SkipResult;
  }

  async createOrder(
    deliveryDate: string,
    start: string,
    end: string,
    products: Array<{ qty: number; inventoryId: string }>,
    options?: { comment?: string; tip?: number }
  ): Promise<{ __typename: string; id?: string; deliveryDate?: string; paymentStatus?: string; error?: string; outOfStockIds?: string[] }> {
    const mutation = `
      mutation createOrder($order: CreateOrderInput!) {
        createOrder(order: $order) {
          __typename
          ... on OrderCreation { id deliveryDate paymentStatus }
          ... on OrderCreationError { error outOfStockIds }
        }
      }
    `;
    const order: Record<string, unknown> = {
      deliveryDate,
      start,
      end,
      products: products.map((p) => ({ qty: p.qty, inventoryId: p.inventoryId })),
    };
    if (options?.comment) order.comment = options.comment;
    if (options?.tip != null) order.tip = options.tip;
    const data = await this.querySubscription(mutation, { order });
    return data.createOrder as { __typename: string; id?: string; deliveryDate?: string; paymentStatus?: string; error?: string; outOfStockIds?: string[] };
  }

  async getPriceBreakdown(date: string, meals: MealInput[]): Promise<PriceBreakdown> {
    const query = `
      query getOrderDetail($date: String!, $cartId: String, $meals: [MealInput]) {
        getOrderDetail(date: $date, cartId: $cartId, meals: $meals) {
          qtyPlanMeals qtyItems totalPlanPrice totalExtraMeals totalTaxes
          totalDeliveryFee totalExpressFee totalFee subTotalOrder
          totalPromoDiscount totalOrder availableCredits totalOrderWithCreditsSubtracted
        }
      }
    `;
    const data = await this.querySubscription(query, { date, meals });
    return data.getOrderDetail as PriceBreakdown;
  }

  async searchMeals(keyword: string, date: string): Promise<Meal[]> {
    const menu = await this.getMenu(date);
    const term = keyword.toLowerCase();
    return menu.meals.filter((meal) => {
      if (meal.name.toLowerCase().includes(term)) return true;
      if (meal.shortDescription.toLowerCase().includes(term)) return true;
      const s = meal.searchBy;
      if (s.cuisines.some((c) => c.toLowerCase().includes(term))) return true;
      if (s.dietTags.some((t) => t.toLowerCase().includes(term))) return true;
      if (s.ingredients.some((i) => i.toLowerCase().includes(term))) return true;
      if (s.proteinTags.some((p) => p.toLowerCase().includes(term))) return true;
      if (`${s.chefFirstName} ${s.chefLastName}`.toLowerCase().includes(term)) return true;
      if (meal.category.title.toLowerCase().includes(term)) return true;
      return false;
    });
  }

  // --- private helpers ---

  private async queryMenu(
    query: string,
    variables: Record<string, unknown> = {}
  ): Promise<Record<string, unknown>> {
    return this.executeGraphQL(MENU_SERVICE_URL, query, variables);
  }

  private async querySubscription(
    query: string,
    variables: Record<string, unknown> = {}
  ): Promise<Record<string, unknown>> {
    return this.executeGraphQL(SUBSCRIPTION_URL, query, variables);
  }

  private async executeGraphQL(
    endpoint: string,
    query: string,
    variables: Record<string, unknown> = {}
  ): Promise<Record<string, unknown>> {
    const accessToken = await this.auth.getAccessToken();
    try {
      const response = await axios.post(
        endpoint,
        { query, variables },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "User-Agent": "CookUnity-MCP/1.0.0",
          },
          timeout: 30000,
        }
      );
      const body = response.data as { data?: Record<string, unknown>; errors?: Array<{ message: string }> };
      if (body.errors) {
        throw new Error(`GraphQL errors: ${body.errors.map((e) => e.message).join(", ")}`);
      }
      return body.data!;
    } catch (error) {
      if (error instanceof AxiosError) {
        const status = error.response?.status;
        if (status === 401) throw new Error("Authentication expired. Please check your COOKUNITY_EMAIL and COOKUNITY_PASSWORD.");
        if (status === 429) throw new Error("Rate limited by CookUnity API. Please wait before retrying.");
        throw new Error(`CookUnity API error (HTTP ${status ?? "unknown"}): ${error.message}`);
      }
      throw error;
    }
  }
}
