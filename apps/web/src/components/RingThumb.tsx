import { referenceImageUrl } from "@/lib/api";

/**
 * Consistent ring thumbnail. Two modes:
 *   - fixed size (sm | md | lg) — used inline (e.g. sibling cards)
 *   - fill — stretches to its parent (used in the magazine portrait grid)
 */
export function RingThumb({
  src,
  refPath,
  alt = "Ring",
  size = "md",
  fill = false,
}: {
  src?: string;
  refPath?: string;
  alt?: string;
  size?: "sm" | "md" | "lg";
  fill?: boolean;
}) {
  const url = src ?? (refPath ? referenceImageUrl(refPath) : undefined);

  if (fill) {
    return (
      <div className="relative h-full w-full overflow-hidden bg-cream">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={alt}
            className="absolute inset-0 h-full w-full object-contain p-8"
          />
        ) : null}
      </div>
    );
  }

  const dimensions =
    size === "sm" ? "h-24 w-24" : size === "lg" ? "h-72 w-72" : "h-48 w-48";

  return (
    <div
      className={`${dimensions} flex shrink-0 items-center justify-center overflow-hidden bg-cream`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={alt} className="h-full w-full object-contain p-4" />
      ) : null}
    </div>
  );
}
