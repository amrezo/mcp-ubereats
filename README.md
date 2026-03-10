# @striderlabs/mcp-ubereats

[![npm](https://img.shields.io/npm/v/@striderlabs/mcp-ubereats)](https://www.npmjs.com/package/@striderlabs/mcp-ubereats)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

MCP server for Uber Eats — let AI agents search restaurants, browse menus, place orders, and track deliveries.

Built by [Strider Labs](https://striderlabs.ai).

## Features

- Search restaurants by name, cuisine, or food type
- Browse full menus with item details and prices
- Add items to cart with quantity and special instructions
- Clear cart and start fresh
- Place orders with a mandatory confirmation step
- Track active order status and delivery progress
- Persistent sessions — stay logged in across restarts

## Installation

```bash
npm install -g @striderlabs/mcp-ubereats
```

Or run directly with npx:

```bash
npx @striderlabs/mcp-ubereats
```

## Configuration

Add to your MCP client configuration (e.g., Claude Desktop `~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ubereats": {
      "command": "npx",
      "args": ["-y", "@striderlabs/mcp-ubereats"]
    }
  }
}
```

## Authentication

This connector uses Playwright browser automation. On first use:

1. Call `ubereats_status` — it will return a login URL
2. Open the URL in your browser and log in to Uber Eats
3. Run `ubereats_status` again to verify the session was saved
4. Session cookies are stored at `~/.strider/ubereats/cookies.json`
5. Sessions persist automatically across restarts

To log out or reset your session:

```
ubereats_logout
```

## Available Tools

### Session Management

| Tool | Description |
|------|-------------|
| `ubereats_status` | Check login status; returns login URL if not authenticated |
| `ubereats_login` | Get the login URL to open in a browser |
| `ubereats_logout` | Clear stored session cookies (log out) |

### Delivery

| Tool | Description |
|------|-------------|
| `ubereats_set_address` | Set delivery address before searching |

### Restaurants & Menus

| Tool | Description |
|------|-------------|
| `ubereats_search` | Search restaurants by name, food type, or cuisine |
| `ubereats_get_restaurant` | Get restaurant details and full menu |

### Cart & Ordering

| Tool | Description |
|------|-------------|
| `ubereats_add_to_cart` | Add an item to cart with quantity and special instructions |
| `ubereats_view_cart` | View current cart contents and totals |
| `ubereats_clear_cart` | Remove all items from cart |
| `ubereats_checkout` | Preview or place the order (`confirm=true` to place) |
| `ubereats_track_order` | Track an active order's status and ETA |

## Example Usage

### Check login status

```json
{
  "tool": "ubereats_status"
}
```

### Set delivery address

```json
{
  "tool": "ubereats_set_address",
  "arguments": {
    "address": "123 Main St, San Francisco, CA 94102"
  }
}
```

### Search for restaurants

```json
{
  "tool": "ubereats_search",
  "arguments": {
    "query": "sushi",
    "cuisine": "japanese"
  }
}
```

### Get restaurant menu

```json
{
  "tool": "ubereats_get_restaurant",
  "arguments": {
    "restaurantId": "nobu-restaurant-sf"
  }
}
```

### Add to cart

```json
{
  "tool": "ubereats_add_to_cart",
  "arguments": {
    "restaurantId": "nobu-restaurant-sf",
    "itemName": "Spicy Tuna Roll",
    "quantity": 2,
    "specialInstructions": "No wasabi please"
  }
}
```

### Preview order before placing

```json
{
  "tool": "ubereats_checkout",
  "arguments": {
    "confirm": false
  }
}
```

### Place the order

```json
{
  "tool": "ubereats_checkout",
  "arguments": {
    "confirm": true
  }
}
```

### Track order

```json
{
  "tool": "ubereats_track_order",
  "arguments": {
    "orderId": "abc123"
  }
}
```

## Typical Workflow

```
1. ubereats_status          — check if logged in
2. ubereats_set_address     — set where to deliver
3. ubereats_search          — find restaurants
4. ubereats_get_restaurant  — browse the menu
5. ubereats_add_to_cart     — add items
6. ubereats_view_cart       — review cart
7. ubereats_checkout        — preview (confirm=false), then place (confirm=true)
8. ubereats_track_order     — track delivery
```

## Requirements

- Node.js 18+
- Playwright (Chromium browser auto-installed on first run)
- An active Uber Eats account with a saved payment method

## How It Works

1. **Headless Chrome** — Playwright runs a real browser in the background
2. **Stealth mode** — Browser fingerprint mimics a real user to avoid detection
3. **Cookie persistence** — Login sessions are saved and reloaded automatically
4. **Structured responses** — All tool outputs are JSON for easy parsing

## Security

- Session cookies stored locally at `~/.strider/ubereats/cookies.json`
- No credentials are stored — authentication uses the browser-based Uber login flow
- Cookies never leave your machine

## Limitations

- Uber Eats must be available in your region
- Menu customizations (modifiers, options) may require additional interaction
- Order placement requires a valid payment method on your Uber Eats account
- Dynamic pricing and availability may differ from what is displayed

## Development

```bash
git clone https://github.com/markswendsen-code/mcp-ubereats.git
cd mcp-ubereats
npm install
npm run build
npm start
```

## License

MIT © [Strider Labs](https://striderlabs.ai)

## Related

- [@striderlabs/mcp-doordash](https://www.npmjs.com/package/@striderlabs/mcp-doordash) — DoorDash MCP connector
- [@striderlabs/mcp-gmail](https://www.npmjs.com/package/@striderlabs/mcp-gmail) — Gmail MCP connector
- [Model Context Protocol](https://modelcontextprotocol.io) — Learn more about MCP
