# cookunity-mcp-server

MCP server for [CookUnity](https://www.cookunity.com) meal delivery service. Browse menus, manage carts, confirm orders, skip/unskip deliveries, and view order history.

## Tools (15)

### Menu & Discovery

| Tool | Description |
|------|-------------|
| `cookunity_get_menu` | Browse meals with filters (category, diet, price, rating) & pagination |
| `cookunity_search_meals` | Search by keyword across name, description, cuisine, chef, ingredients, diet tags |
| `cookunity_get_meal_details` | Full nutritional info, allergens, and ingredients for a specific meal |

### Cart & Orders

| Tool | Description |
|------|-------------|
| `cookunity_get_cart` | View cart contents for a specific delivery date |
| `cookunity_add_to_cart` | Add meal to cart by inventory_id and date |
| `cookunity_remove_from_cart` | Remove meal from cart by inventory_id |
| `cookunity_clear_cart` | Clear all cart items for a delivery date |
| `cookunity_confirm_order` | **Confirm/place order** — locks in cart items for delivery |

### Deliveries & Scheduling

| Tool | Description |
|------|-------------|
| `cookunity_next_delivery` | **Get nearest delivery** with meals (order, cart, or auto-picks) — use for "what's my next delivery?" |
| `cookunity_list_deliveries` | All upcoming weeks with status, meals, cutoffs, skip state |
| `cookunity_skip_delivery` | Skip a delivery week |
| `cookunity_unskip_delivery` | Unskip a previously skipped week |

### Account & Pricing

| Tool | Description |
|------|-------------|
| `cookunity_get_user_info` | User profile, plan, delivery days, addresses, credits |
| `cookunity_list_orders` | Order history with pagination |
| `cookunity_get_price_breakdown` | Price estimate with taxes, fees, credits, and promo discounts |

## Typical Workflow

```
1. cookunity_list_deliveries    → Find next editable delivery date + cutoff
2. cookunity_get_menu           → Browse available meals for that date
3. cookunity_search_meals       → Search for specific cuisines/proteins
4. cookunity_get_meal_details   → Check nutrition/allergens
5. cookunity_add_to_cart        → Add meals (repeat until plan is full)
6. cookunity_get_price_breakdown→ Verify total before confirming
7. cookunity_confirm_order      → Lock in the order ✅
```

> **Important:** Without confirming, cart items are NOT locked in. CookUnity auto-fills with its own recommendations at the cutoff deadline.

## Setup

```bash
npm install
npm run build
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `COOKUNITY_EMAIL` | Yes | CookUnity account email |
| `COOKUNITY_PASSWORD` | Yes | CookUnity account password |
| `TRANSPORT` | No | `stdio` (default) or `http` |
| `PORT` | No | HTTP port when using `http` transport (default: 3000) |

## Configuration

### Claude Desktop / OpenClaw (stdio)

```json
{
  "mcpServers": {
    "cookunity": {
      "command": "node",
      "args": ["/path/to/cookunity-mcp/dist/index.js"],
      "env": {
        "COOKUNITY_EMAIL": "your@email.com",
        "COOKUNITY_PASSWORD": "your-password"
      }
    }
  }
}
```

### Streamable HTTP (remote)

```bash
COOKUNITY_EMAIL=your@email.com COOKUNITY_PASSWORD=your-password TRANSPORT=http PORT=3000 node dist/index.js
```

## API Details

This server reverse-engineers CookUnity's internal GraphQL APIs:

- **Menu Service** (`https://menu-service.cookunity.com/graphql`) — meal browsing and search
- **Subscription Service** (`https://subscription-back.cookunity.com/graphql`) — cart, orders, deliveries, user info

Authentication uses Auth0 with the `cookunity` realm. Tokens are cached and refreshed automatically.

### Known Limitations

- GraphQL introspection is disabled — schemas were reverse-engineered from frontend JS bundles and error probing
- `createOrder` requires the exact number of meals matching the user's plan (e.g., 6 for a 6-meal plan)
- Delivery window is currently hardcoded to 11:00–20:00 (matches most US plans)

## License

MIT
