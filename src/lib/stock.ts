import type { Product, StockStatus } from "@/types";

export const LOW_STOCK_THRESHOLD = 10;

/**
 * Units on hand. Apparel: every colour and size. Comics: print copies - an
 * online edition has no stock to run out of.
 */
export function totalStock(product: Product): number {
  if (product.type === "comics") return product.formats.physical.enabled ? product.formats.physical.stock : 0;
  return product.stock.reduce((sum, v) => sum + v.quantity, 0);
}

/**
 * In, low or out of stock. Null for a comic not sold in print: it is digital
 * only, so stock does not apply.
 */
export function stockStatus(product: Product): StockStatus | null {
  if (product.type === "comics" && !product.formats.physical.enabled) return null;
  const total = totalStock(product);
  if (total === 0) return "outOfStock";
  if (total <= LOW_STOCK_THRESHOLD) return "lowStock";
  return "inStock";
}
