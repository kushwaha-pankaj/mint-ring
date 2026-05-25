import Script from "next/script";
import { Playfair_Display } from "next/font/google";
import { StudioSessionGuard } from "@/components/studio/StudioSessionGuard";
import "./design-studio.css";

const MODEL_VIEWER_SRC =
  "https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-ds-serif",
  display: "swap",
});

/** Design route shares Inter Tight / Korolev; Playfair for mockup serif headings on /design. */
export default function DesignLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`ds-root ${playfair.variable}`}>
      <Script src={MODEL_VIEWER_SRC} type="module" strategy="afterInteractive" />
      <StudioSessionGuard>{children}</StudioSessionGuard>
    </div>
  );
}
