import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FamilyOS",
  description:
    "A chief of staff for your family life. It remembers the details, plans ahead, and suggests the next step so nothing slips.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1d4a3c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
