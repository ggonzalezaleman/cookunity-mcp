export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
}

export interface Meal {
  id: string;
  batchId: number;
  name: string;
  shortDescription: string;
  image: string;
  imagePath: string;
  price: number;
  finalPrice: number;
  premiumFee: number;
  sku: string;
  stock: number;
  isNewMeal: boolean;
  userRating: number;
  inventoryId: string;
  categoryId: string;
  searchBy: MealSearchBy;
  nutritionalFacts: NutritionFacts;
  chef: Chef;
  meatType: string;
  category: MealCategory;
  allergens?: Allergen[];
  ingredients?: Ingredient[];
}

export interface DetailedMeal extends Meal {
  allergens: Allergen[];
  ingredients: Ingredient[];
}

export interface MealSearchBy {
  cuisines: string[];
  chefFirstName: string;
  chefLastName: string;
  dietTags: string[];
  ingredients: string[];
  proteinTags: string[];
}

export interface NutritionFacts {
  calories: number;
  fat: number;
  carbs: number;
  sodium: number;
  fiber: number;
  protein?: number;
  sugar?: number;
}

export interface Allergen {
  name: string;
}

export interface Ingredient {
  name: string;
}

export interface Chef {
  id: string;
  firstName: string;
  lastName: string;
}

export interface MealCategory {
  id: string;
  title: string;
  label: string;
}

export interface MenuCategory {
  id: string;
  title: string;
  subtitle: string;
  label: string;
  tag: string;
}

export interface Menu {
  categories: MenuCategory[];
  meals: Meal[];
}

export interface UserInfo {
  id: string;
  name: string;
  email: string;
  plan_id: string;
  store_id: string;
  status: string;
  deliveryDays: DeliveryDay[];
  currentCredit: number;
  ring?: { id: string; name: string; is_local: boolean };
  addresses: Address[];
  profiles: UserProfile[];
}

export interface DeliveryDay {
  id: string;
  day: string;
  time_start: string;
  time_end: string;
}

export interface Address {
  id: string;
  isActive: boolean;
  city: string;
  region: string;
  postcode: string;
  street: string;
}

export interface UserProfile {
  id: string;
  firstname: string;
  lastname: string;
}

export interface Order {
  id: string;
  deliveryDate: string;
}

export interface CartProduct {
  id: string;
  inventoryId: string;
  name: string;
  sku: string;
  image_path: string;
  price_incl_tax: number;
  realPrice?: number;
  chef_firstname: string;
  chef_lastname: string;
  meat_type: string;
  premium_special?: boolean;
}

export interface CartEntry {
  product: CartProduct;
  qty: number;
}

export interface Cutoff {
  time: string;
  userTimeZone: string;
}

export interface OrderItemPrice {
  price: number;
  originalPrice?: number;
}

export interface OrderItem {
  qty: number;
  product: {
    id: string;
    inventoryId: string;
    name: string;
    chef_firstname: string;
    chef_lastname: string;
    meat_type: string | null;
    premium_special?: boolean;
  };
  price: OrderItemPrice;
}

export interface OrderStatus {
  state: string | null;
  status: string | null;
}

export interface OrderInfo {
  id: string;
  grandTotal: number;
  orderStatus: OrderStatus | null;
  items: OrderItem[];
}

export interface RecommendationMeal {
  name: string;
  inventoryId: string;
  chef_firstname: string;
  chef_lastname: string;
  meat_type: string | null;
  qty: number;
  premium_special?: boolean;
}

export interface Recommendation {
  meals: RecommendationMeal[];
}

export interface UpcomingDay {
  id: string;
  date: string;
  displayDate: string;
  available: boolean;
  menuAvailable: boolean;
  canEdit: boolean;
  skip: boolean;
  isPaused: boolean;
  scheduled: boolean;
  cutoff: Cutoff | null;
  cart: CartEntry[];
  order: OrderInfo | null;
  recommendation: Recommendation | null;
}

export interface CartItem {
  qty: number;
  inventoryId: string;
}

export interface SkipResult {
  __typename: string;
  id?: string;
  error?: string;
}

export interface FormattedMeal {
  id: string;
  name: string;
  description: string;
  chef: string;
  category: string;
  price: number;
  original_price: number;
  rating: number;
  inventory_id: string;
  batch_id: number;
  in_stock: boolean;
  stock: number;
  is_new: boolean;
  image: string;
  nutrition: NutritionFacts;
  tags: {
    cuisines: string[];
    diet_tags: string[];
    protein_tags: string[];
    ingredients: string[];
  };
  meat_type: string;
}

export interface DeliveryMealInfo {
  name: string;
  inventory_id: string;
  quantity: number;
  price: number;
  chef: string;
}

export interface DeliveryInfo {
  date: string;
  status: "locked" | "active" | "skipped" | "paused";
  can_edit: boolean;
  menu_available: boolean;
  cutoff: string | null;
  cutoff_timezone: string | null;
  cart_items: DeliveryMealInfo[];
  cart_count: number;
  order: {
    id: string;
    status: string | null;
    grand_total: number;
    items: DeliveryMealInfo[];
    item_count: number;
  } | null;
  recommendation_items: DeliveryMealInfo[];
  recommendation_count: number;
}

export interface MealInput {
  entityId: string | number;
  quantity: number;
  inventoryId: string;
}

export interface PriceBreakdown {
  qtyPlanMeals: number;
  qtyItems: number;
  totalPlanPrice: number;
  totalExtraMeals: number;
  totalTaxes: number;
  totalDeliveryFee: number;
  totalExpressFee: number;
  totalFee: number;
  subTotalOrder: number;
  totalPromoDiscount: number;
  totalOrder: number;
  availableCredits: number;
  totalOrderWithCreditsSubtracted: number;
}

export interface PaginatedResponse<T> {
  total: number;
  count: number;
  offset: number;
  items: T[];
  has_more: boolean;
  next_offset?: number;
}
