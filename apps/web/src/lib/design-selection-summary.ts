import {
  ringTypeLabel,
  type DesignBrief,
} from "./design-brief";

export type SelectionSummaryRow = {
  key: string;
  value: string;
  icon: "ring" | "metal" | "stone" | "setting" | "band" | "finish" | "extra";
  /** Draw a divider line above this row (after basics block). */
  dividerBefore?: boolean;
};

function displayRingType(value: string): string {
  const labels: Record<string, string> = {
    engagement: "Engagement ring",
    "wedding-band": "Wedding band",
    eternity: "Eternity ring",
    halo: "Halo ring",
    solitaire: "Solitaire ring",
    signet: "Signet ring",
    cluster: "Cluster ring",
    "three-stone": "Three stone ring",
  };
  return labels[value] ?? ringTypeLabel(value);
}

function titleCaseExtra(value: string): string {
  return value
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Sidebar rows for the Step 2 summary panel. */
export function selectionSummaryRowsFromBrief(brief: DesignBrief): SelectionSummaryRow[] {
  const rows: SelectionSummaryRow[] = [];

  if (brief.ringType) {
    rows.push({ key: "Ring Type", value: displayRingType(brief.ringType), icon: "ring" });
  }
  if (brief.metal) rows.push({ key: "Metal", value: brief.metal, icon: "metal" });
  if (brief.stone) {
    rows.push({
      key: "Centre Stone Shape",
      value: brief.stone,
      icon: "stone",
    });
  }
  if (brief.setting) {
    rows.push({
      key: "Setting Style",
      value: brief.setting,
      icon: "setting",
      dividerBefore: Boolean(brief.ringType && brief.metal && brief.stone),
    });
  }
  if (brief.bandStyle) {
    rows.push({ key: "Band Style", value: brief.bandStyle, icon: "band" });
  }
  if (brief.finish) rows.push({ key: "Finish", value: brief.finish, icon: "finish" });
  if (brief.optionalDetails.length) {
    rows.push({
      key: "Extra Details",
      value: brief.optionalDetails.map(titleCaseExtra).join(", "),
      icon: "extra",
    });
  }

  return rows;
}
