import type { Metadata } from "next";
import "./globals.css";
import { CoreProviders } from "./core-providers";
import { BotIdClient } from "botid/client";
import { Analytics } from "@vercel/analytics/next";

import localFont from "next/font/local";

const jetbrainsMono = localFont({
  src: "../../public/fonts/JetBrainsMono-VariableFont_wght.ttf",
  variable: "--font-jetbrains-mono",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  title: {
    default: "Real-time Video Generation | Powered by fal.ai",
    template: "%s",
  },
  description:
    "AI-powered text-to-video generation with dynamic prompt rewriting using Krea's realtime diffusion technology.",
  keywords: [
    "Real-time Video Generation",
    "AI video generation",
    "Text-to-video AI",
    "Krea AI",
    "Dynamic prompt rewriting",
    "AI-powered video",
    "Realtime diffusion",
    "WebSocket streaming",
    "AI video creation",
    "fal.ai",
    "generative AI",
  ],
  authors: [{ name: "fal.ai" }],
  creator: "fal.ai",
  publisher: "fal.ai",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://krea-realtime.fal.ai"
  ),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "Real-time Video Generation | Powered by fal.ai",
    description:
      "AI-powered text-to-video generation with dynamic prompt rewriting using Krea's realtime diffusion technology.",
    siteName: "Krea Realtime Video Generation",
    images: [
      {
        url: "/og-img-compress.png",
        width: 1200,
        height: 630,
        alt: "Krea Realtime Video Generation Demo",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Real-time Video Generation | Powered by fal.ai",
    description:
      "AI-powered text-to-video generation with dynamic prompt rewriting using Krea's realtime diffusion technology.",
    creator: "@fal_ai",
    site: "@fal_ai",
    images: [
      {
        url: "/og-img-compress.png",
        width: 1200,
        height: 630,
        alt: "Krea Realtime Video Generation Demo",
        type: "image/png",
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={[jetbrainsMono.variable].join(" ")}
      suppressHydrationWarning
    >
      <head>
        <meta name="color-scheme" content="dark" />
        <BotIdClient
          protect={[
            {
              path: "/api/trpc/*",
              method: "POST",
            },
            {
              path: "/api/fal",
              method: "POST",
            },
          ]}
        />
      </head>
      <body className={`font-sans bg-background text-foreground min-h-screen`}>
        <CoreProviders>{children}</CoreProviders>
      </body>
      <Analytics />
    </html>
  );
}
