import type { Metadata, Viewport } from "next";
import { Nunito_Sans, Fraunces } from "next/font/google";
import "./globals.css";

// Soft humanist sans for body, a warm serif for headings — calm and editorial.
const sans = Nunito_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const serif = Fraunces({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "LUMA — Life Unfolds through Meaningful Action",
  description:
    "Turn meaningful aspirations into achievable projects. Begin with why.",
};

// viewport-fit=cover lets the phone UI (bottom tab bar, sheets) extend into
// the safe area, which the components then pad with env(safe-area-inset-*).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: the inline script below may stamp
    // `data-cosmos` on <html> before React hydrates.
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Cosmos mode is chosen per browser; apply it before first paint so
            a dark-mode visitor never sees a flash of daylight. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("cosmos-mode")==="1")document.documentElement.setAttribute("data-cosmos","")}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
