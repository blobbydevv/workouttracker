import type { Food } from "../db/types";

interface OffProduct {
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number;
  nutriments?: Record<string, number | undefined>;
}

/** Open Food Facts lookup (international labels). Returns null when not found. */
export async function lookupBarcode(code: string, fetchImpl: typeof fetch = fetch): Promise<Food | null> {
  const res = await fetchImpl(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,serving_size,serving_quantity,nutriments`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Product lookup failed (${res.status}).`);
  const body = (await res.json()) as { status?: number; product?: OffProduct };
  if (body.status !== 1 || !body.product) return null;
  return offToFood(code, body.product);
}

export function offToFood(code: string, p: OffProduct): Food {
  const n = p.nutriments ?? {};
  const hasServing = n["energy-kcal_serving"] != null;
  const get = (k: string) => Number((hasServing ? n[`${k}_serving`] : n[`${k}_100g`]) ?? 0);
  return {
    id: `off-${code}`,
    name: p.product_name?.trim() || `Product ${code}`,
    brand: p.brands?.split(",")[0]?.trim() || undefined,
    servingLabel: hasServing ? p.serving_size || "1 serving" : "100 g",
    kcal: get("energy-kcal"),
    protein: get("proteins"),
    carbs: get("carbohydrates"),
    fat: get("fat"),
    barcode: code,
    custom: false,
    source: "openfoodfacts",
  };
}
