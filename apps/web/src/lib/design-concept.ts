import {
  moodLabel,
  ringTypeLabel,
  type DesignBrief,
} from "./design-brief";

export type ConceptRow = {
  key: string;
  value: string;
  icon: "ring" | "metal" | "stone" | "setting" | "band" | "finish" | "extra" | "mood";
};

export function conceptRowsFromBrief(brief: DesignBrief): ConceptRow[] {
  const rows: ConceptRow[] = [];

  if (brief.ringType) {
    rows.push({ key: "Ring Type", value: ringTypeLabel(brief.ringType), icon: "ring" });
  }
  if (brief.metal) rows.push({ key: "Metal", value: brief.metal, icon: "metal" });
  if (brief.stone) rows.push({ key: "Centre Stone", value: brief.stone, icon: "stone" });
  if (brief.setting) rows.push({ key: "Setting Style", value: brief.setting, icon: "setting" });
  if (brief.bandStyle || brief.band) {
    const band = [brief.bandStyle, brief.band].filter(Boolean).join(" · ");
    rows.push({ key: "Band Style", value: band, icon: "band" });
  }
  if (brief.finish) rows.push({ key: "Finish", value: brief.finish, icon: "finish" });
  if (brief.optionalDetails.length) {
    rows.push({
      key: "Extra Details",
      value: brief.optionalDetails.join(", "),
      icon: "extra",
    });
  }
  const moods = moodLabel(brief);
  if (moods) rows.push({ key: "Style Mood", value: moods, icon: "mood" });

  return rows;
}
