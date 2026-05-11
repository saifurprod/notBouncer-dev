import type { Metadata, Viewport } from "next";
import "./globals.css";

// Production metadata. Per-route metadata in individual page.tsx files
// can override or extend any of these defaults.
//
// We set `metadataBase` so OpenGraph URLs resolve absolutely. The
// fallback lets Vercel deploys auto-populate without code changes.
const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://bouncer-lyart.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NoteBouncer — You decide what AI is allowed in your meeting",
    template: "%s · NoteBouncer",
  },
  description:
    "NoteBouncer detects AI notetakers in your Zoom meetings and lets you remove them with one click. Otter, Fireflies, Read, Krisp, and more are caught the moment they join.",
  applicationName: "NoteBouncer",
  authors: [{ name: "Sapience AI" }],
  keywords: [
    "AI notetaker",
    "Zoom",
    "meeting privacy",
    "Otter",
    "Fireflies",
    "bot detection",
    "meeting consent",
  ],
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "NoteBouncer",
    title: "NoteBouncer — You decide what AI is allowed in your meeting",
    description:
      "Detect and remove AI notetakers from your Zoom meetings. By Sapience AI.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "NoteBouncer — You decide what AI is allowed in your meeting",
    description:
      "Detect and remove AI notetakers from your Zoom meetings. By Sapience AI.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F2F0EA",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@200;300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
