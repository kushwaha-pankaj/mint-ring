import { Playfair_Display } from "next/font/google";
import { StudioSessionGuard } from "@/components/studio/StudioSessionGuard";
import "../design/design-studio.css";
import "./identify.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-ds-serif",
  display: "swap",
});

export default function IdentifyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`ds-root ${playfair.variable}`}>
      <StudioSessionGuard>{children}</StudioSessionGuard>
    </div>
  );
}
