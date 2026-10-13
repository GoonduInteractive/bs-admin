import type { ApparelProduct, ProductSize, ProductVariantStock } from "@/types";

/**
 * Variant prices. Every variant inherits its product's price; an admin can
 * override one, and only then does the variant carry a price of its own.
 * Read prices through here, never `product.price` alone.
 */

/** What one colour and size sells for: its override, or the product's price. */
export function variantPrice(product: ApparelProduct, colourId: string, size: ProductSize): number {
  return product.stock.find((v) => v.colourId === colourId && v.size === size)?.price ?? product.price;
}

/** The variants an admin has given their own price. */
export function overriddenVariants(product: ApparelProduct): ProductVariantStock[] {
  return product.stock.filter((v) => v.price !== undefined);
}

/** The lowest and highest price any variant sells at. */
export function priceRange(product: ApparelProduct): { lo: number; hi: number } {
  const prices = product.stock.length ? product.stock.map((v) => v.price ?? product.price) : [product.price];
  return { lo: Math.min(...prices), hi: Math.max(...prices) };
}
