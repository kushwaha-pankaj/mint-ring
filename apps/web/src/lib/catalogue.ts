/**
 * Hockley Mint demo catalogue mapping.
 *
 * Translates the raw SKU codes from the WeddingRing dataset into customer-
 * friendly names. The structure is a best-guess based on standard wedding
 * ring profile terminology — Pankaj should correct names/widths after
 * confirming with Ribesh at Hockley Mint.
 *
 * Naming convention assumed:
 *   WA = Wedding (band)
 *   L  = Light weight     M = Medium weight
 *   trailing digit  ≈ width in millimetres
 *   metal suffix    R = Rose · W = White · Y = Yellow (18ct gold)
 */

export type Metal = "R" | "W" | "Y";

export type RingMeta = {
  /** Full SKU as returned by the API, e.g. "WAM5-Y". */
  sku: string;
  /** Big friendly name, e.g. "Heavy Court". */
  name: string;
  /** Subtitle line, e.g. "5 mm · 18ct Yellow Gold". */
  subtitle: string;
  /** Design family without metal, e.g. "WAM5". Used for "Also available in". */
  designCode: string;
  /** Metal token. */
  metal: Metal;
  /** Reference image path from top-K, when available. */
  refPath?: string;
};

const DESIGNS: Record<string, { name: string; widthMm: number }> = {
  WAL2: { name: "Light Court", widthMm: 2 },
  WAM4: { name: "Medium Court", widthMm: 4 },
  WAM5: { name: "Heavy Court", widthMm: 5 },
};

const METALS: Record<Metal, string> = {
  R: "Rose Gold",
  W: "White Gold",
  Y: "Yellow Gold",
};

const METAL_SWATCH: Record<Metal, string> = {
  R: "#B76E79",
  W: "#E5E4E2",
  Y: "#E6BE3A",
};

export function metalLabel(m: Metal): string {
  return METALS[m];
}

export function metalSwatch(m: Metal): string {
  return METAL_SWATCH[m];
}

/**
 * Parse an SKU like "WAM5-Y" → friendly metadata. Returns a sensible
 * fallback when the SKU is not in the known map so the UI never crashes.
 */
export function ringFromSku(sku: string): RingMeta {
  const [designCode, metalCode] = sku.split("-");
  const design = DESIGNS[designCode];
  const metal = (METALS[metalCode as Metal] ? (metalCode as Metal) : "Y") as Metal;

  if (!design) {
    return {
      sku,
      name: designCode ?? sku,
      subtitle: `18ct ${METALS[metal]}`,
      designCode: designCode ?? sku,
      metal,
    };
  }

  return {
    sku,
    name: design.name,
    subtitle: `${design.widthMm} mm · 18ct ${METALS[metal]}`,
    designCode,
    metal,
  };
}

/**
 * Given the matched SKU and the model's top-K list, surface up to two
 * "Also available in" siblings — the same design family but in different
 * metals. This is a real Hockley Mint commercial pattern: once a customer
 * has chosen a profile they often want to see other metal options.
 */
export function siblingsByMetal(
  matchedSku: string,
  candidates: Array<{ label: string; source_path?: string }>,
): RingMeta[] {
  const matched = ringFromSku(matchedSku);
  const seen = new Set<string>([matched.metal]);
  const out: RingMeta[] = [];

  for (const c of candidates) {
    const r = ringFromSku(c.label);
    if (r.designCode !== matched.designCode) continue;
    if (seen.has(r.metal)) continue;
    seen.add(r.metal);
    out.push({ ...r, refPath: c.source_path });
    if (out.length >= 2) break;
  }
  return out;
}
