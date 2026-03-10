#!/usr/bin/env node
/**
 * Strider Labs Uber Eats MCP Server
 *
 * MCP server that gives AI agents the ability to search restaurants,
 * browse menus, add items to cart, place orders, and track deliveries
 * on Uber Eats.
 * https://striderlabs.ai
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { checkAuth, getLoginUrl, setAddress, searchRestaurants, getRestaurant, addToCart, viewCart, clearCart, checkout, trackOrder, cleanup, } from "./browser.js";
import { hasStoredCookies, clearCookies, getCookiesPath } from "./auth.js";
// Initialize server
const server = new Server({
    name: "io.github.markswendsen-code/ubereats",
    version: "0.1.0",
}, {
    capabilities: {
        tools: {},
    },
});
// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "ubereats_status",
                description: "Check if the user is logged in to Uber Eats. Returns login status and setup instructions if not authenticated. Always call this before any other Uber Eats operations.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "ubereats_login",
                description: "Get the Uber Eats login URL for the user to authenticate. Returns a URL the user can open in their browser to log in. After logging in, call ubereats_status to verify.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "ubereats_logout",
                description: "Clear the stored Uber Eats session cookies, effectively logging out. Use this to reset authentication or switch accounts.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "ubereats_set_address",
                description: "Set the delivery address for Uber Eats orders. Must be set before searching for restaurants. Provide a full street address including city and zip code.",
                inputSchema: {
                    type: "object",
                    properties: {
                        address: {
                            type: "string",
                            description: "Full delivery address (e.g., '123 Main St, San Francisco, CA 94102')",
                        },
                    },
                    required: ["address"],
                },
            },
            {
                name: "ubereats_search",
                description: "Search for restaurants on Uber Eats. Can search by restaurant name, food type, or cuisine. Returns a list of matching restaurants with delivery info.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "Search query - restaurant name, food type, or dish (e.g., 'pizza', 'sushi', 'Chipotle')",
                        },
                        cuisine: {
                            type: "string",
                            description: "Filter by cuisine type (e.g., 'italian', 'chinese', 'mexican', 'american')",
                        },
                    },
                    required: ["query"],
                },
            },
            {
                name: "ubereats_get_restaurant",
                description: "Get full details and menu for a specific restaurant. Returns restaurant info (rating, delivery time, fees) and the complete menu organized by category.",
                inputSchema: {
                    type: "object",
                    properties: {
                        restaurantId: {
                            type: "string",
                            description: "The restaurant ID or slug (from ubereats_search results)",
                        },
                    },
                    required: ["restaurantId"],
                },
            },
            {
                name: "ubereats_add_to_cart",
                description: "Add a menu item to the cart. The restaurant must be loaded first via ubereats_get_restaurant. Supports quantity and special instructions.",
                inputSchema: {
                    type: "object",
                    properties: {
                        restaurantId: {
                            type: "string",
                            description: "The restaurant ID (from search or get_restaurant)",
                        },
                        itemName: {
                            type: "string",
                            description: "Name of the menu item to add (must match exactly)",
                        },
                        quantity: {
                            type: "number",
                            description: "Number of items to add (default: 1)",
                        },
                        specialInstructions: {
                            type: "string",
                            description: "Special preparation instructions for the item (optional)",
                        },
                    },
                    required: ["restaurantId", "itemName"],
                },
            },
            {
                name: "ubereats_view_cart",
                description: "View the current cart contents, including all items, quantities, prices, and the total cost with delivery fee.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "ubereats_clear_cart",
                description: "Remove all items from the current cart. Use this to start a new order or switch restaurants.",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "ubereats_checkout",
                description: "Preview or place the order. Set confirm=false (default) to preview the order summary including items, fees, and estimated delivery. Set confirm=true to actually place the order. Always preview before placing.",
                inputSchema: {
                    type: "object",
                    properties: {
                        confirm: {
                            type: "boolean",
                            description: "Set to true to place the order, false to preview only. Defaults to false for safety.",
                        },
                    },
                    required: ["confirm"],
                },
            },
            {
                name: "ubereats_track_order",
                description: "Track the status of an active order. Returns order status, estimated delivery time, driver info (if available), and order details.",
                inputSchema: {
                    type: "object",
                    properties: {
                        orderId: {
                            type: "string",
                            description: "Order ID to track (optional - defaults to the most recent active order)",
                        },
                    },
                },
            },
        ],
    };
});
// Tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        switch (name) {
            case "ubereats_status": {
                const hasCookies = hasStoredCookies();
                if (!hasCookies) {
                    const loginInfo = await getLoginUrl();
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    success: true,
                                    isLoggedIn: false,
                                    message: "Not logged in to Uber Eats.",
                                    loginUrl: loginInfo.url,
                                    instructions: loginInfo.instructions,
                                    cookiesPath: getCookiesPath(),
                                }),
                            },
                        ],
                    };
                }
                const authState = await checkAuth();
                if (!authState.isLoggedIn) {
                    const loginInfo = await getLoginUrl();
                    return {
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    success: true,
                                    isLoggedIn: false,
                                    message: "Session expired. Please log in again.",
                                    loginUrl: loginInfo.url,
                                    instructions: loginInfo.instructions,
                                }),
                            },
                        ],
                    };
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                isLoggedIn: true,
                                message: "Logged in to Uber Eats.",
                                ...(authState.email ? { email: authState.email } : {}),
                            }),
                        },
                    ],
                };
            }
            case "ubereats_login": {
                const loginInfo = await getLoginUrl();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                loginUrl: loginInfo.url,
                                instructions: loginInfo.instructions,
                            }),
                        },
                    ],
                };
            }
            case "ubereats_logout": {
                clearCookies();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: true,
                                message: "Uber Eats session cleared. You will need to log in again.",
                            }),
                        },
                    ],
                };
            }
            case "ubereats_set_address": {
                const { address } = args;
                const result = await setAddress(address);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result),
                        },
                    ],
                    isError: !result.success,
                };
            }
            case "ubereats_search": {
                const { query, cuisine } = args;
                const result = await searchRestaurants(query, { cuisine });
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result),
                        },
                    ],
                    isError: !result.success,
                };
            }
            case "ubereats_get_restaurant": {
                const { restaurantId } = args;
                const result = await getRestaurant(restaurantId);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result),
                        },
                    ],
                    isError: !result.success,
                };
            }
            case "ubereats_add_to_cart": {
                const { restaurantId, itemName, quantity, specialInstructions } = args;
                const result = await addToCart(restaurantId, itemName, quantity, specialInstructions);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result),
                        },
                    ],
                    isError: !result.success,
                };
            }
            case "ubereats_view_cart": {
                const result = await viewCart();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result),
                        },
                    ],
                    isError: !result.success,
                };
            }
            case "ubereats_clear_cart": {
                const result = await clearCart();
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result),
                        },
                    ],
                    isError: !result.success,
                };
            }
            case "ubereats_checkout": {
                const { confirm } = args;
                const result = await checkout(confirm);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result),
                        },
                    ],
                    isError: !result.success,
                };
            }
            case "ubereats_track_order": {
                const { orderId } = args;
                const result = await trackOrder(orderId);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(result),
                        },
                    ],
                    isError: !result.success,
                };
            }
            default:
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: `Unknown tool: ${name}`,
                            }),
                        },
                    ],
                    isError: true,
                };
        }
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: errorMessage,
                    }),
                },
            ],
            isError: true,
        };
    }
});
// Cleanup on exit
process.on("SIGINT", async () => {
    await cleanup();
    process.exit(0);
});
process.on("SIGTERM", async () => {
    await cleanup();
    process.exit(0);
});
// Start server
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Strider Uber Eats MCP server running");
}
main().catch(console.error);
