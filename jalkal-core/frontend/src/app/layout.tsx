import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "JalKal (जलकाल) — Urban Flood Nowcasting & Safe Navigation Engine",
  description: "Street-level urban inundation modeling under high-resolution radar nowcasting (0-3h) & safe emergency routing. MoES / NCMRWF (SIH26085).",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="shortcut icon" type="image/png" href="/favicon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Archivo+Black&family=Fraunces:ital,wght@0,400;1,400;1,500&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/maplibre-gl@4.1.1/dist/maplibre-gl.css"
        />
      </head>
      <body className="bg-cream text-text-primary min-h-screen antialiased selection:bg-accent-orange-light selection:text-accent-black font-mono">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
