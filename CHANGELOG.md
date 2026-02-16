# Changelog

All notable changes to the CookUnity MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-15

### Added
- Initial release of CookUnity MCP Server
- Auth0 authentication flow for CookUnity accounts
- Support for browsing menu and searching meals
- Cart management (add, remove, clear items)
- Order history and user profile access
- Order confirmation and placement
- Full TypeScript implementation with proper error handling
- Comprehensive documentation and setup instructions
- Support for Claude Desktop and other MCP clients

### Features
- **get_menu** - Browse available meals for any date
- **search_meals** - Find meals by cuisine, diet, chef, or ingredients
- **get_user_info** - Access user profile and delivery schedule
- **get_orders** - View order history
- **get_cart** - Check current cart contents
- **add_to_cart** - Add meals to cart by inventory ID
- **remove_from_cart** - Remove items from cart
- **clear_cart** - Clear entire cart for a date
- **confirm_order** - Place orders with payment and delivery options

### Technical
- Built with MCP SDK v1.0.0
- TypeScript with full type safety
- Axios for HTTP requests
- Jest for testing
- ESLint for code quality
- Comprehensive error handling and logging