import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, IBM_Plex_Mono } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/service-worker";
import "./globals.css";

/*
  Three faces, each with a job. The condensed one carries every heading and
  every number — a weight and a day name speak with the same voice, which is
  what holds the screen together without any boxes. The body face is the same
  family, unnarrowed, so running text stays comfortable. The mono is for the
  few places where a figure has to line up in a column of its own.
*/
const condensed = Barlow_Condensed({
  weight: ["600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-condensed",
});

const body = Barlow({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-face",
});

export const metadata: Metadata = {
  title: "GYM",
  description: "Registo de treino e programa privado para dois.",
  manifest: "/manifest.webmanifest",
  applicationName: "GYM",
  appleWebApp: {
    capable: true,
    title: "GYM",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", type: "image/png", sizes: "192x192" }],
    apple: "/icons/apple-touch-icon.png",
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0e0f0e",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-PT" className={`${condensed.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/*
          The application ships its own dark palette. This asks Dark Reader to
          leave the page alone: without it the extension rewrites stroke
          attributes on every icon after the server HTML has been sent, which
          React reports as a hydration mismatch.
        */}
        <meta name="darkreader-lock" />
      </head>
      <body className="app-shell" suppressHydrationWarning>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
