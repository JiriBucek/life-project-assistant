import type { Metadata } from "next";
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
  title: "Ellie — your life, intentionally planned",
  description:
    "Turn meaningful aspirations into achievable projects. Begin with why.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
