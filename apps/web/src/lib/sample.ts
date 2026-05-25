/**
 * Pre-curated sample images for one-click demo on stage.
 * Served from /public/samples. Picks 4–6 are copied from data/test (held-out set).
 */

export type SamplePick = {
  label: string;
  /** Shown on the card; also used when loading the file for identify. */
  image: string;
  /** Stable id for active state (not a catalogue SKU). */
  id: string;
};

export const SAMPLE_PICKS: SamplePick[] = [
  {
    id: "hand-1",
    label: "Hand photograph 1",
    image: "/samples/test-hand-image-1.png",
  },
  {
    id: "hand-2",
    label: "Hand photograph 2",
    image: "/samples/test-hand-image-2.avif",
  },
  {
    id: "hand-3",
    label: "Hand photograph 3",
    image: "/samples/test-hand-image-3.png",
  },
  {
    id: "hand-4",
    label: "Heavy Court · Yellow Gold",
    image: "/samples/test-hand-image-4.png",
  },
  {
    id: "hand-5",
    label: "Medium Court · White Gold",
    image: "/samples/test-hand-image-5.png",
  },
  {
    id: "hand-6",
    label: "Light Court · Rose Gold",
    image: "/samples/test-hand-image-6.png",
  },
  {
    id: "hand-7",
    label: "Hand photograph 7",
    image: "/samples/test-hand-image-7.png",
  },
  {
    id: "hand-8",
    label: "Hand photograph 8",
    image: "/samples/test-hand-image-8.png",
  },
  {
    id: "hand-9",
    label: "Hand photograph 9",
    image: "/samples/test-hand-image-9.png",
  },
];

export async function fetchSampleAsFile(url: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not load sample (${res.status})`);
  }
  const blob = await res.blob();
  const name = url.split("/").pop() ?? "sample.png";
  return new File([blob], name, { type: blob.type || "image/png" });
}
