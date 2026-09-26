# Theme

## Compact token summary

**Font:** Plus Jakarta Sans (`--font-plus-jakarta` / `--font-sans`) weights 300–800.

**Colors**
| Token | Value |
|-------|-------|
| --app-ink | #121417 |
| --app-muted | #5c6570 |
| --app-faint | #8b939e |
| --app-canvas | #f6f7f8 |
| --app-surface | #ffffff |
| --app-hover | #f1f2f4 |
| --app-border | #e6e8eb |
| --app-border-strong | #d5d8de |
| --app-nav-active | #121417 |
| --app-nav-active-bg | #f1f2f4 |
| --app-accent | #121417 |
| --app-positive | #1f7a4d |
| --app-warning | #9a6700 |
| --app-critical | #b42318 |
| --app-critical-bg | #fdf2f2 |
| --app-critical-border | #f3c4c0 |
| --app-positive-bg | #eef6f1 |
| --app-warning-bg | #fbf6ea |

**Radius:** --app-radius 8px; --app-radius-control 6px
**Shadows:** card/xs none; --app-shadow-pop `0 8px 24px rgba(18,20,23,0.08)`
**Breakpoints (Tailwind defaults):** sm 640, md 768, lg 1024, xl 1280
**CSS approach:** Tailwind v4 via `@import "tailwindcss"` in globals; app tokens as CSS variables. No separate tailwind.config theme extend.
**Brand logo:** `frontend/public/brand/kpm-logo.png`

## Raw source

### frontend/src/app/globals.css
```css
@import "tailwindcss";

:root {
  --font-sans: var(--font-plus-jakarta), ui-sans-serif, system-ui, sans-serif;
  --app-ink: #121417;
  --app-muted: #5c6570;
  --app-faint: #8b939e;
  --app-canvas: #f6f7f8;
  --app-surface: #ffffff;
  --app-hover: #f1f2f4;
  --app-border: #e6e8eb;
  --app-border-strong: #d5d8de;
  --app-nav-active: #121417;
  --app-nav-active-bg: #f1f2f4;
  --app-accent: #121417;
  --app-positive: #1f7a4d;
  --app-warning: #9a6700;
  --app-critical: #b42318;
  --app-critical-bg: #fdf2f2;
  --app-critical-border: #f3c4c0;
  --app-positive-bg: #eef6f1;
  --app-warning-bg: #fbf6ea;
  --app-shadow-xs: none;
  --app-shadow-card: none;
  --app-shadow-pop: 0 8px 24px rgba(18, 20, 23, 0.08);
  --app-radius: 8px;
  --app-radius-control: 6px;
}

body {
  font-family: var(--font-sans);
  background-color: var(--app-canvas);
  color: var(--app-ink);
  overflow-x: hidden;
}

.app-root :focus-visible {
  outline: 2px solid var(--app-ink);
  outline-offset: 2px;
}

.app-page-enter {
  animation: none;
}

.app-fade-in {
  animation: appFadeIn 180ms ease-out;
}

.app-slide-in {
  animation: appSlideIn 220ms ease-out;
}

.app-pressable:active {
  transform: scale(0.98);
}

.app-elevated:hover {
  box-shadow: var(--app-shadow-card);
  transform: translateY(-1px);
}

.app-surface {
  background: var(--app-surface);
  border: 1px solid var(--app-border);
  border-radius: var(--app-radius);
  box-shadow: var(--app-shadow-xs);
}

@keyframes appPageEnter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes appFadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes appSlideIn {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Glassmorphism and Custom Shadows matching the screenshot */
.hero-glow {
  background: radial-gradient(circle at 75% 20%, rgba(224, 231, 255, 0.45) 0%, rgba(241, 245, 249, 0.3) 50%, rgba(255, 255, 255, 0) 100%);
}

.shadow-card-subtle {
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 10px 30px -5px rgba(15, 23, 42, 0.06);
}

.shadow-card-elevated {
  box-shadow: 0 20px 40px -15px rgba(15, 23, 42, 0.12), 0 0 1px 1px rgba(15, 23, 42, 0.05);
}

.shadow-floating-badge {
  box-shadow: 0 15px 35px -5px rgba(15, 23, 42, 0.09), 0 0 1px 1px rgba(226, 232, 240, 0.8);
}

@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-6px);
  }
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### frontend/src/app/layout.tsx (font)
```tsx
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
        <script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async />
        {children}
      </body>
    </html>
  );
}
```
