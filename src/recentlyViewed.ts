import type { ProductCardData } from "./types";

const RECENT_PRODUCTS_KEY = "recently_viewed_products";
const RECENT_PRODUCT_DATA_KEY = "recently_viewed_product_data";

export function readRecentlyViewedIds(currentId = ""): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(RECENT_PRODUCTS_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    const ids = stored.filter((value): value is string => typeof value === "string");
    return [...new Set(ids)].filter((id) => id !== currentId);
  } catch (reason) {
    console.warn("Recently viewed products could not be read", reason);
    return [];
  }
}

export function readRecentlyViewedProducts(): Record<string, ProductCardData> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(RECENT_PRODUCT_DATA_KEY) ?? "{}");
    if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return {};
    return Object.fromEntries(
      Object.entries(stored).filter(
        (entry): entry is [string, ProductCardData] => {
          const product = entry[1];
          return (
            typeof product === "object" &&
            product !== null &&
            "id" in product &&
            product.id === entry[0] &&
            "name" in product &&
            typeof product.name === "string" &&
            "basePrice" in product &&
            (typeof product.basePrice === "number" || typeof product.basePrice === "string") &&
            (!("imageUrl" in product) ||
              product.imageUrl === null ||
              typeof product.imageUrl === "string") &&
            (!("images" in product) ||
              (Array.isArray(product.images) &&
                product.images.every(
                (image: unknown) =>
                    typeof image === "object" &&
                    image !== null &&
                    "url" in image &&
                    typeof image.url === "string",
                )))
          );
        },
      ),
    );
  } catch (reason) {
    console.warn("Recently viewed product details could not be read", reason);
    return {};
  }
}

export function recordRecentlyViewed(id: string, product?: ProductCardData) {
  const ids = [id, ...readRecentlyViewedIds(id)];
  try {
    localStorage.setItem(RECENT_PRODUCTS_KEY, JSON.stringify(ids));
  } catch (reason) {
    console.warn("Recently viewed products could not be saved", reason);
  }

  if (!product) return;
  try {
    const products = readRecentlyViewedProducts();
    localStorage.setItem(
      RECENT_PRODUCT_DATA_KEY,
      JSON.stringify({ ...products, [id]: product }),
    );
  } catch (reason) {
    console.warn("Recently viewed product details could not be saved", reason);
  }
}
