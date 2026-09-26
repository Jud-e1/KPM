import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "KPM | Smarter Inventory, Healthier Finances",
  description:
    "KPM automates your inventory, reconciles your accounts, catches errors, and runs 24/7 with AI — so you can focus on growing your business.",
};

const themeBootScript = `
(function(){
  try {
    localStorage.setItem('kpm_theme', 'light');
    var root = document.documentElement;
    root.classList.remove('dark');
    root.dataset.theme = 'light';
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} scroll-smooth`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body
        className={`${inter.className} font-sans antialiased bg-[var(--app-canvas)] text-[var(--app-ink)]`}
      >
        <ThemeProvider>{children}</ThemeProvider>
        <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async />
      </body>
    </html>
  );
}
