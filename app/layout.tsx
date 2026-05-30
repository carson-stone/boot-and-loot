import type { Metadata } from "next";
import { Cinzel } from "next/font/google";
import "./globals.css";

const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel", display: "swap" });

export const metadata: Metadata = {
  title: "Boot & Loot",
  description: "A multiplayer deck-building dungeon crawler",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cinzel.variable} h-full`}>
      <body className="min-h-full flex flex-col bg-stone-950 text-stone-200 antialiased">
        {children}
      </body>
    </html>
  );
}
