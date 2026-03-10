/**
 * Uber Eats Browser Automation
 *
 * Playwright-based automation for Uber Eats operations.
 * Runs headless by default with stealth patches to avoid detection.
 */
import { AuthState } from "./auth.js";
export interface Restaurant {
    id: string;
    name: string;
    cuisine: string[];
    rating: number;
    deliveryTime: string;
    deliveryFee: string;
    priceRange?: string;
    imageUrl?: string;
    slug?: string;
}
export interface MenuItem {
    id: string;
    name: string;
    description: string;
    price: number;
    imageUrl?: string;
    popular?: boolean;
}
export interface MenuCategory {
    name: string;
    items: MenuItem[];
}
export interface CartItem {
    name: string;
    quantity: number;
    price: number;
    customizations?: string[];
}
export interface OrderStatus {
    orderId: string;
    status: string;
    estimatedDelivery?: string;
    restaurant: string;
    driver?: {
        name: string;
        vehicle?: string;
    };
    items: CartItem[];
    total: number;
}
/**
 * Check if user is logged in
 */
export declare function checkAuth(): Promise<AuthState>;
/**
 * Get login URL and instructions for user
 */
export declare function getLoginUrl(): Promise<{
    url: string;
    instructions: string;
}>;
/**
 * Set delivery address
 */
export declare function setAddress(address: string): Promise<{
    success: boolean;
    formattedAddress?: string;
    error?: string;
}>;
/**
 * Search for restaurants
 */
export declare function searchRestaurants(query: string, options?: {
    cuisine?: string;
}): Promise<{
    success: boolean;
    restaurants?: Restaurant[];
    error?: string;
}>;
/**
 * Get restaurant details and menu
 */
export declare function getRestaurant(restaurantId: string): Promise<{
    success: boolean;
    restaurant?: {
        id: string;
        name: string;
        cuisine: string[];
        rating: number;
        deliveryTime: string;
        deliveryFee: string;
        address?: string;
    };
    categories?: MenuCategory[];
    error?: string;
}>;
/**
 * Add item to cart
 */
export declare function addToCart(restaurantId: string, itemName: string, quantity?: number, specialInstructions?: string): Promise<{
    success: boolean;
    cartTotal?: number;
    error?: string;
}>;
/**
 * View current cart contents
 */
export declare function viewCart(): Promise<{
    success: boolean;
    items?: CartItem[];
    restaurantName?: string;
    subtotal?: number;
    deliveryFee?: number;
    total?: number;
    empty?: boolean;
    error?: string;
}>;
/**
 * Clear cart contents
 */
export declare function clearCart(): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Checkout - preview or place order
 */
export declare function checkout(confirm?: boolean): Promise<{
    success: boolean;
    orderId?: string;
    summary?: {
        items: CartItem[];
        subtotal: number;
        deliveryFee: number;
        total: number;
        deliveryAddress?: string;
        estimatedDelivery?: string;
    };
    requiresConfirmation?: boolean;
    error?: string;
}>;
/**
 * Track active order status
 */
export declare function trackOrder(orderId?: string): Promise<{
    success: boolean;
    status?: OrderStatus;
    error?: string;
}>;
/**
 * Cleanup browser resources
 */
export declare function cleanup(): Promise<void>;
