/** 5×5 pixel grid, right-pointing arrow (NexSaS-style). */
export function PixelArrowIcon() {
  const rows = ["00110", "00010", "01110", "00010", "00110"] as const;
  return (
    <span className="hm-pixel-arrow" aria-hidden>
      {rows.map((row, ri) =>
        row.split("").map((on, ci) => (
          <span
            key={`${ri}-${ci}`}
            className={on === "1" ? "hm-pixel-arrow__dot hm-pixel-arrow__dot--on" : "hm-pixel-arrow__dot"}
          />
        )),
      )}
    </span>
  );
}
