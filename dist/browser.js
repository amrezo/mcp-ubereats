/**
 * Uber Eats Browser Automation
 *
 * Playwright-based automation for Uber Eats operations.
 * Runs headless by default with stealth patches to avoid detection.
 */
import { chromium } from "patchright";
import { saveCookies, loadCookies, getAuthState } from "./auth.js";
const UBEREATS_BASE_URL = "https://www.ubereats.com";
const DEFAULT_TIMEOUT = 30000;
// Singleton browser instance
let browser = null;
let context = null;
let page = null;
/**
 * Initialize browser with stealth settings to avoid detection
 */
async function initBrowser() {
    if (browser)
        return;
    browser = await chromium.launch({
        headless: true,
        args: [
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-accelerated-2d-canvas",
            "--no-first-run",
            "--no-zygote",
        ],
    });
    context = await browser.newContext({
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 800 },
        locale: "en-US",
        timezoneId: "America/New_York",
        extraHTTPHeaders: {
            "Accept-Language": "en-US,en;q=0.9",
        },
    });
    // Stealth: hide webdriver flag
    await context.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => undefined });
        // @ts-ignore
        delete navigator.__proto__.webdriver;
    });
    // Load saved cookies
    await loadCookies(context);
    page = await context.newPage();
    // Block unnecessary resources for speed
    await page.route("**/*.{png,jpg,jpeg,gif,svg,woff,woff2,mp4,webp}", (route) => route.abort());
}
/**
 * Get the current page, initializing browser if needed
 */
async function getPage() {
    await initBrowser();
    if (!page)
        throw new Error("Page not initialized");
    return page;
}
/**
 * Get current browser context
 */
async function getContext() {
    await initBrowser();
    if (!context)
        throw new Error("Context not initialized");
    return context;
}
/**
 * Check if user is logged in
 */
export async function checkAuth() {
    const ctx = await getContext();
    const p = await getPage();
    await p.goto(UBEREATS_BASE_URL, {
        waitUntil: "domcontentloaded",
        timeout: DEFAULT_TIMEOUT,
    });
    // Wait for auth state to settle
    await p.waitForTimeout(2000);
    const authState = await getAuthState(ctx);
    await saveCookies(ctx);
    return authState;
}
/**
 * Get login URL and instructions for user
 */
export async function getLoginUrl() {
    const p = await getPage();
    await p.goto(`${UBEREATS_BASE_URL}/login`, {
        waitUntil: "domcontentloaded",
        timeout: DEFAULT_TIMEOUT,
    });
    return {
        url: `${UBEREATS_BASE_URL}/login`,
        instructions: "Please log in to Uber Eats in your browser. After logging in, run the 'ubereats_status' tool to verify authentication and save your session.",
    };
}
/**
 * Set delivery address
 */
export async function setAddress(address) {
    const p = await getPage();
    const ctx = await getContext();
    try {
        await p.goto(UBEREATS_BASE_URL, {
            waitUntil: "domcontentloaded",
            timeout: DEFAULT_TIMEOUT,
        });
        await p.waitForTimeout(2000);
        // Click on the address input/button
        const addressButton = p.locator('[data-testid="address-input"], ' +
            'input[placeholder*="Enter delivery address"], ' +
            'input[placeholder*="delivery address"], ' +
            'button[data-testid="home-feed-location-bar"]');
        if (await addressButton.first().isVisible({ timeout: 5000 })) {
            await addressButton.first().click();
            await p.waitForTimeout(1000);
        }
        // Fill address input
        const addressInput = p.locator('input[data-testid="address-input"], ' +
            'input[placeholder*="address"], ' +
            'input[type="text"][autocomplete*="street"]');
        await addressInput.first().waitFor({ timeout: 8000 });
        await addressInput.first().fill(address);
        await p.waitForTimeout(1500);
        // Click first autocomplete suggestion
        const suggestion = p.locator('[data-testid="address-autocomplete-result"], ' +
            '[role="option"], ' +
            'li[data-baseweb="list-item"]').first();
        if (await suggestion.isVisible({ timeout: 4000 })) {
            await suggestion.click();
            await p.waitForTimeout(1500);
        }
        // Confirm/save button
        const confirmButton = p.locator('button:has-text("Confirm"), ' +
            'button:has-text("Save"), ' +
            'button:has-text("Done"), ' +
            'button[data-testid="address-confirm"]');
        if (await confirmButton.first().isVisible({ timeout: 3000 })) {
            await confirmButton.first().click();
            await p.waitForTimeout(2000);
        }
        await saveCookies(ctx);
        return {
            success: true,
            formattedAddress: address,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to set address",
        };
    }
}
/**
 * Search for restaurants
 */
export async function searchRestaurants(query, options) {
    const p = await getPage();
    const ctx = await getContext();
    try {
        let searchUrl;
        if (options?.cuisine) {
            searchUrl = `${UBEREATS_BASE_URL}/category/${encodeURIComponent(options.cuisine.toLowerCase())}`;
        }
        else {
            searchUrl = `${UBEREATS_BASE_URL}/search?q=${encodeURIComponent(query)}`;
        }
        await p.goto(searchUrl, {
            waitUntil: "domcontentloaded",
            timeout: DEFAULT_TIMEOUT,
        });
        await p.waitForTimeout(3000);
        // Wait for store cards
        const storeCards = p.locator('[data-testid="store-card"], ' +
            'a[href*="/store/"], ' +
            '[data-testid="rich-text-container"]');
        await storeCards.first().waitFor({ timeout: 10000 }).catch(() => { });
        const restaurants = [];
        const cards = p.locator('[data-testid="store-card"], a[href*="/store/"]');
        const cardCount = await cards.count();
        for (let i = 0; i < Math.min(cardCount, 20); i++) {
            const card = cards.nth(i);
            try {
                const name = (await card
                    .locator('h3, [data-testid="store-name"], span[class*="StoreName"]')
                    .first()
                    .textContent()
                    .catch(() => "")) || "";
                const cuisineText = (await card
                    .locator('[data-testid="store-cuisine"], span[class*="cuisine"]')
                    .first()
                    .textContent()
                    .catch(() => "")) || "";
                const ratingText = (await card
                    .locator('[data-testid="store-rating"], span[aria-label*="stars"]')
                    .first()
                    .textContent()
                    .catch(() => "0")) || "0";
                const deliveryTimeText = (await card
                    .locator('span[data-testid="store-eta"], span:has-text("min")')
                    .first()
                    .textContent()
                    .catch(() => "")) || "";
                const feeText = (await card
                    .locator('[data-testid="store-delivery-fee"], span:has-text("$")')
                    .first()
                    .textContent()
                    .catch(() => "")) || "";
                // Get store slug/ID from href
                const href = (await card.getAttribute("href").catch(() => "")) ||
                    (await card
                        .locator("a[href*='/store/']")
                        .first()
                        .getAttribute("href")
                        .catch(() => "")) ||
                    "";
                const slugMatch = href.match(/\/store\/([^?#/]+)/);
                const slug = slugMatch?.[1] || String(i);
                if (name) {
                    restaurants.push({
                        id: slug,
                        name: name.trim(),
                        cuisine: cuisineText
                            .split(/[,•·]/)
                            .map((c) => c.trim())
                            .filter(Boolean),
                        rating: parseFloat(ratingText.replace(/[^0-9.]/g, "")) || 0,
                        deliveryTime: deliveryTimeText.trim(),
                        deliveryFee: feeText.trim(),
                        slug,
                    });
                }
            }
            catch {
                // Skip problematic cards
            }
        }
        await saveCookies(ctx);
        return {
            success: true,
            restaurants,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to search restaurants",
        };
    }
}
/**
 * Get restaurant details and menu
 */
export async function getRestaurant(restaurantId) {
    const p = await getPage();
    const ctx = await getContext();
    try {
        await p.goto(`${UBEREATS_BASE_URL}/store/${restaurantId}`, {
            waitUntil: "domcontentloaded",
            timeout: DEFAULT_TIMEOUT,
        });
        await p.waitForTimeout(3000);
        // Get restaurant header info
        const name = (await p
            .locator('h1, [data-testid="store-title"]')
            .first()
            .textContent()
            .catch(() => "Unknown Restaurant")) || "Unknown Restaurant";
        const cuisineText = (await p
            .locator('[data-testid="store-cuisine-list"], span[class*="cuisine"]')
            .first()
            .textContent()
            .catch(() => "")) || "";
        const ratingText = (await p
            .locator('[data-testid="store-rating"], span[aria-label*="stars"], span[class*="rating"]')
            .first()
            .textContent()
            .catch(() => "0")) || "0";
        const deliveryTimeText = (await p
            .locator('[data-testid="store-eta"], span:has-text("min delivery")')
            .first()
            .textContent()
            .catch(() => "")) || "";
        const deliveryFeeText = (await p
            .locator('[data-testid="store-delivery-fee"], span:has-text("Delivery")')
            .first()
            .textContent()
            .catch(() => "")) || "";
        // Wait for menu items to load
        await p
            .locator('[data-testid="menu-item"], [data-testid="store-menu-item-tile"]')
            .first()
            .waitFor({ timeout: 10000 })
            .catch(() => { });
        const categories = [];
        // Get menu sections/categories
        const sections = p.locator('[data-testid="menu-section"], ' +
            'section[aria-label], ' +
            'div[data-testid="store-menu-category"]');
        const sectionCount = await sections.count();
        if (sectionCount > 0) {
            for (let s = 0; s < sectionCount; s++) {
                const section = sections.nth(s);
                const categoryName = (await section
                    .locator("h2, h3, [data-testid='menu-category-title']")
                    .first()
                    .textContent()
                    .catch(() => "")) || "Menu";
                const items = [];
                const menuItems = section.locator('[data-testid="menu-item"], [data-testid="store-menu-item-tile"]');
                const itemCount = await menuItems.count();
                for (let i = 0; i < Math.min(itemCount, 30); i++) {
                    const item = menuItems.nth(i);
                    try {
                        const itemName = (await item
                            .locator("h3, [data-testid='menu-item-title'], span[class*='ItemName']")
                            .first()
                            .textContent()
                            .catch(() => "")) || "";
                        const description = (await item
                            .locator("[data-testid='menu-item-description'], p, span[class*='description']")
                            .first()
                            .textContent()
                            .catch(() => "")) || "";
                        const priceText = (await item
                            .locator("[data-testid='menu-item-price'], span:has-text('$')")
                            .first()
                            .textContent()
                            .catch(() => "$0")) || "$0";
                        const itemId = (await item
                            .getAttribute("data-item-id")
                            .catch(() => "")) ||
                            `item-${s}-${i}`;
                        if (itemName) {
                            items.push({
                                id: itemId,
                                name: itemName.trim(),
                                description: description.trim(),
                                price: parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0,
                            });
                        }
                    }
                    catch {
                        // Skip problematic items
                    }
                }
                if (items.length > 0) {
                    categories.push({
                        name: categoryName.trim(),
                        items,
                    });
                }
            }
        }
        // Fallback: if no sections found, try getting items directly
        if (categories.length === 0) {
            const allItems = p.locator('[data-testid="menu-item"], [data-testid="store-menu-item-tile"]');
            const totalItems = await allItems.count();
            const items = [];
            for (let i = 0; i < Math.min(totalItems, 50); i++) {
                const item = allItems.nth(i);
                try {
                    const itemName = (await item
                        .locator("h3, span[class*='title']")
                        .first()
                        .textContent()
                        .catch(() => "")) || "";
                    const priceText = (await item
                        .locator("span:has-text('$')")
                        .first()
                        .textContent()
                        .catch(() => "$0")) || "$0";
                    if (itemName) {
                        items.push({
                            id: `item-${i}`,
                            name: itemName.trim(),
                            description: "",
                            price: parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0,
                        });
                    }
                }
                catch {
                    // Skip
                }
            }
            if (items.length > 0) {
                categories.push({ name: "Menu", items });
            }
        }
        await saveCookies(ctx);
        return {
            success: true,
            restaurant: {
                id: restaurantId,
                name: name.trim(),
                cuisine: cuisineText
                    .split(/[,•·]/)
                    .map((c) => c.trim())
                    .filter(Boolean),
                rating: parseFloat(ratingText.replace(/[^0-9.]/g, "")) || 0,
                deliveryTime: deliveryTimeText.trim(),
                deliveryFee: deliveryFeeText.trim(),
            },
            categories,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to get restaurant",
        };
    }
}
/**
 * Add item to cart
 */
export async function addToCart(restaurantId, itemName, quantity = 1, specialInstructions) {
    const p = await getPage();
    const ctx = await getContext();
    try {
        // Navigate to restaurant if needed
        const currentUrl = p.url();
        if (!currentUrl.includes(`/store/${restaurantId}`)) {
            await p.goto(`${UBEREATS_BASE_URL}/store/${restaurantId}`, {
                waitUntil: "domcontentloaded",
                timeout: DEFAULT_TIMEOUT,
            });
            await p.waitForTimeout(3000);
        }
        // Find and click the menu item
        const menuItem = p
            .locator(`[data-testid="menu-item"]:has-text("${itemName}"), ` +
            `[data-testid="store-menu-item-tile"]:has-text("${itemName}")`)
            .first();
        await menuItem.waitFor({ timeout: 8000 });
        await menuItem.click();
        await p.waitForTimeout(2000);
        // Adjust quantity if more than 1
        if (quantity > 1) {
            for (let i = 1; i < quantity; i++) {
                const increaseButton = p
                    .locator('button[aria-label*="increase"], ' +
                    'button[data-testid="quantity-increase"], ' +
                    'button:has-text("+")')
                    .first();
                if (await increaseButton.isVisible({ timeout: 2000 })) {
                    await increaseButton.click();
                    await p.waitForTimeout(300);
                }
            }
        }
        // Add special instructions if provided
        if (specialInstructions) {
            const instructionsInput = p.locator('textarea[placeholder*="instruction"], ' +
                'input[placeholder*="instruction"], ' +
                '[data-testid="special-instructions-input"]');
            if (await instructionsInput.first().isVisible({ timeout: 2000 })) {
                await instructionsInput.first().fill(specialInstructions);
            }
        }
        // Click add to cart / add to order button
        const addButton = p
            .locator('button:has-text("Add to cart"), ' +
            'button:has-text("Add to order"), ' +
            'button[data-testid="add-to-cart-button"], ' +
            'button[data-testid="add-item-button"]')
            .first();
        await addButton.waitFor({ timeout: 5000 });
        await addButton.click();
        await p.waitForTimeout(2000);
        // Try to get cart total
        const cartTotalText = (await p
            .locator('[data-testid="checkout-button"], ' +
            'button:has-text("View cart"), ' +
            'button:has-text("Go to checkout")')
            .first()
            .textContent()
            .catch(() => "")) || "";
        const total = parseFloat(cartTotalText.replace(/[^0-9.]/g, "")) || 0;
        await saveCookies(ctx);
        return {
            success: true,
            cartTotal: total,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to add item to cart",
        };
    }
}
/**
 * View current cart contents
 */
export async function viewCart() {
    const p = await getPage();
    const ctx = await getContext();
    try {
        // Try to navigate to checkout/cart page
        await p.goto(`${UBEREATS_BASE_URL}/cart`, {
            waitUntil: "domcontentloaded",
            timeout: DEFAULT_TIMEOUT,
        }).catch(async () => {
            // Fallback: try clicking cart button if /cart redirects
            const cartBtn = p.locator('[data-testid="cart-button"], ' +
                'a[href*="/cart"], ' +
                'button[aria-label*="cart"]').first();
            if (await cartBtn.isVisible({ timeout: 3000 })) {
                await cartBtn.click();
                await p.waitForTimeout(2000);
            }
        });
        await p.waitForTimeout(2000);
        // Check for empty cart
        const emptyCart = await p
            .locator('span:has-text("Your cart is empty"), ' +
            '[data-testid="empty-cart"]')
            .isVisible({ timeout: 3000 })
            .catch(() => false);
        if (emptyCart) {
            return { success: true, empty: true, items: [], total: 0 };
        }
        const items = [];
        const cartItems = p.locator('[data-testid="cart-item"], [data-testid="checkout-cart-item"]');
        const itemCount = await cartItems.count();
        for (let i = 0; i < itemCount; i++) {
            const item = cartItems.nth(i);
            const name = (await item
                .locator("span, h3")
                .first()
                .textContent()
                .catch(() => "")) || "";
            const quantityText = (await item
                .locator('[data-testid="item-quantity"], span:has-text("×"), span:has-text("x")')
                .first()
                .textContent()
                .catch(() => "1")) || "1";
            const priceText = (await item
                .locator('span:has-text("$")')
                .first()
                .textContent()
                .catch(() => "$0")) || "$0";
            if (name.trim()) {
                items.push({
                    name: name.trim(),
                    quantity: parseInt(quantityText.replace(/[^0-9]/g, "")) || 1,
                    price: parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0,
                });
            }
        }
        const restaurantName = (await p
            .locator('[data-testid="cart-restaurant-name"], h2, h3')
            .first()
            .textContent()
            .catch(() => "")) || "";
        const subtotalText = (await p
            .locator('span:has-text("Subtotal"), [data-testid="cart-subtotal"]')
            .last()
            .textContent()
            .catch(() => "")) || "";
        const deliveryFeeText = (await p
            .locator('span:has-text("Delivery fee"), [data-testid="delivery-fee"]')
            .last()
            .textContent()
            .catch(() => "")) || "";
        const totalText = (await p
            .locator('[data-testid="cart-total"], span:has-text("Total")')
            .last()
            .textContent()
            .catch(() => "")) || "";
        await saveCookies(ctx);
        return {
            success: true,
            items,
            restaurantName: restaurantName.trim(),
            subtotal: parseFloat(subtotalText.replace(/[^0-9.]/g, "")) || 0,
            deliveryFee: parseFloat(deliveryFeeText.replace(/[^0-9.]/g, "")) || 0,
            total: parseFloat(totalText.replace(/[^0-9.]/g, "")) || 0,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to view cart",
        };
    }
}
/**
 * Clear cart contents
 */
export async function clearCart() {
    const p = await getPage();
    const ctx = await getContext();
    try {
        await p.goto(`${UBEREATS_BASE_URL}/cart`, {
            waitUntil: "domcontentloaded",
            timeout: DEFAULT_TIMEOUT,
        }).catch(() => { });
        await p.waitForTimeout(2000);
        // Check if cart is already empty
        const emptyCart = await p
            .locator('span:has-text("Your cart is empty"), [data-testid="empty-cart"]')
            .isVisible({ timeout: 2000 })
            .catch(() => false);
        if (emptyCart) {
            return { success: true };
        }
        // Remove all items one by one
        let attempts = 0;
        while (attempts < 20) {
            const removeButton = p
                .locator('button[aria-label*="Remove"], ' +
                'button[data-testid*="remove"], ' +
                'button:has-text("Remove")')
                .first();
            if (!(await removeButton.isVisible({ timeout: 2000 }).catch(() => false))) {
                break;
            }
            await removeButton.click();
            await p.waitForTimeout(1000);
            attempts++;
        }
        await saveCookies(ctx);
        return { success: true };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to clear cart",
        };
    }
}
/**
 * Checkout - preview or place order
 */
export async function checkout(confirm = false) {
    const p = await getPage();
    const ctx = await getContext();
    try {
        // Navigate to checkout
        await p.goto(`${UBEREATS_BASE_URL}/checkout`, {
            waitUntil: "domcontentloaded",
            timeout: DEFAULT_TIMEOUT,
        }).catch(async () => {
            // Fallback: click checkout button
            const checkoutBtn = p
                .locator('button:has-text("Checkout"), ' +
                'button:has-text("Go to checkout"), ' +
                'a[href*="checkout"]')
                .first();
            if (await checkoutBtn.isVisible({ timeout: 3000 })) {
                await checkoutBtn.click();
                await p.waitForTimeout(3000);
            }
        });
        await p.waitForTimeout(3000);
        // Gather order summary
        const items = [];
        const orderItems = p.locator('[data-testid="checkout-item"], [data-testid="cart-item"]');
        const itemCount = await orderItems.count();
        for (let i = 0; i < itemCount; i++) {
            const item = orderItems.nth(i);
            const name = (await item.locator("span, h3").first().textContent().catch(() => "")) ||
                "";
            const quantityText = (await item
                .locator('span:has-text("×"), span:has-text("x")')
                .first()
                .textContent()
                .catch(() => "1")) || "1";
            const priceText = (await item
                .locator('span:has-text("$")')
                .first()
                .textContent()
                .catch(() => "$0")) || "$0";
            if (name.trim()) {
                items.push({
                    name: name.trim(),
                    quantity: parseInt(quantityText.replace(/[^0-9]/g, "")) || 1,
                    price: parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0,
                });
            }
        }
        const subtotalText = (await p
            .locator('span:has-text("Subtotal")')
            .last()
            .textContent()
            .catch(() => "")) || "";
        const deliveryFeeText = (await p
            .locator('span:has-text("Delivery fee")')
            .last()
            .textContent()
            .catch(() => "")) || "";
        const totalText = (await p
            .locator('[data-testid="checkout-total"], span:has-text("Total")')
            .last()
            .textContent()
            .catch(() => "")) || "";
        const addressText = (await p
            .locator('[data-testid="delivery-address"], span:has-text("Deliver to")')
            .first()
            .textContent()
            .catch(() => "")) || "";
        const etaText = (await p
            .locator('span:has-text("min"), [data-testid="delivery-eta"]')
            .first()
            .textContent()
            .catch(() => "")) || "";
        const summary = {
            items,
            subtotal: parseFloat(subtotalText.replace(/[^0-9.]/g, "")) || 0,
            deliveryFee: parseFloat(deliveryFeeText.replace(/[^0-9.]/g, "")) || 0,
            total: parseFloat(totalText.replace(/[^0-9.]/g, "")) || 0,
            deliveryAddress: addressText.trim(),
            estimatedDelivery: etaText.trim(),
        };
        // Return preview if not confirmed
        if (!confirm) {
            return {
                success: true,
                requiresConfirmation: true,
                summary,
            };
        }
        // Place the order
        const placeOrderButton = p
            .locator('button:has-text("Place order"), ' +
            'button[data-testid="place-order-button"], ' +
            'button:has-text("Place Order")')
            .first();
        await placeOrderButton.waitFor({ timeout: 8000 });
        await placeOrderButton.click();
        await p.waitForTimeout(6000);
        // Get order confirmation
        const orderIdMatch = p.url().match(/orders?\/([a-zA-Z0-9-_]+)/);
        const orderId = orderIdMatch?.[1] || `ue-${Date.now()}`;
        await saveCookies(ctx);
        return {
            success: true,
            orderId,
            summary,
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to checkout",
        };
    }
}
/**
 * Track active order status
 */
export async function trackOrder(orderId) {
    const p = await getPage();
    const ctx = await getContext();
    try {
        let orderUrl = `${UBEREATS_BASE_URL}/orders`;
        if (orderId) {
            orderUrl = `${UBEREATS_BASE_URL}/orders/${orderId}`;
        }
        await p.goto(orderUrl, {
            waitUntil: "domcontentloaded",
            timeout: DEFAULT_TIMEOUT,
        });
        await p.waitForTimeout(3000);
        // If on orders list, open the most recent active order
        if (!orderId) {
            const activeOrder = p
                .locator('[data-testid="active-order"], ' +
                '[data-testid="order-card"]')
                .first();
            if (await activeOrder.isVisible({ timeout: 3000 })) {
                await activeOrder.click();
                await p.waitForTimeout(2000);
            }
        }
        const statusText = (await p
            .locator('[data-testid="order-status"], h1, h2')
            .first()
            .textContent()
            .catch(() => "Unknown")) || "Unknown";
        const restaurantName = (await p
            .locator('[data-testid="restaurant-name"], span:has-text("from")')
            .first()
            .textContent()
            .catch(() => "")) || "";
        const etaText = (await p
            .locator('[data-testid="delivery-eta"], span:has-text("min"), span:has-text("arriving")')
            .first()
            .textContent()
            .catch(() => "")) || "";
        // Driver info if available
        let driver;
        const driverName = (await p
            .locator('[data-testid="driver-name"], span[class*="driver"]')
            .first()
            .textContent()
            .catch(() => "")) || "";
        if (driverName) {
            driver = { name: driverName.trim() };
        }
        // Order items
        const items = [];
        const orderItems = p.locator('[data-testid="order-item"]');
        const itemCount = await orderItems.count();
        for (let i = 0; i < itemCount; i++) {
            const item = orderItems.nth(i);
            const name = (await item.locator("span").first().textContent().catch(() => "")) || "";
            const priceText = (await item
                .locator('span:has-text("$")')
                .first()
                .textContent()
                .catch(() => "$0")) || "$0";
            if (name.trim()) {
                items.push({
                    name: name.trim(),
                    quantity: 1,
                    price: parseFloat(priceText.replace(/[^0-9.]/g, "")) || 0,
                });
            }
        }
        const totalText = (await p
            .locator('[data-testid="order-total"], span:has-text("Total")')
            .last()
            .textContent()
            .catch(() => "")) || "";
        await saveCookies(ctx);
        return {
            success: true,
            status: {
                orderId: orderId || p.url().match(/orders?\/([a-zA-Z0-9-_]+)/)?.[1] || "unknown",
                status: statusText.trim(),
                estimatedDelivery: etaText.trim(),
                restaurant: restaurantName.trim(),
                driver,
                items,
                total: parseFloat(totalText.replace(/[^0-9.]/g, "")) || 0,
            },
        };
    }
    catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : "Failed to track order",
        };
    }
}
/**
 * Cleanup browser resources
 */
export async function cleanup() {
    if (context) {
        await saveCookies(context);
    }
    if (browser) {
        await browser.close();
        browser = null;
        context = null;
        page = null;
    }
}
