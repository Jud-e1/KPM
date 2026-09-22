import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "KPM | Smarter Inventory, Healthier Finances",
  description:
    "KPM automates your inventory, reconciles your accounts, catches errors, and runs 24/7 with AI — so you can focus on growing your business.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="scroll-smooth">
      <body
        className={`${plusJakartaSans.variable} font-sans antialiased bg-[#F8FAFC] text-[#0F172A] selection:bg-[#0F172A] selection:text-white`}
      >
        {children}
      </body>
    </html>
  );
}
