# Extractable components

## AppShell
- Source: `frontend/src/components/AppShell.tsx`
- Category: layout
- Description: Signed-in sidebar + top bar shell with logo, nav, search, notifications, user menu
- Extractable props: activeItem (string, default: "home"), searchPlaceholder (string, default: "Search stock, orders, invoices…"), showNotificationDot (boolean, default: false), displayName (string, default: "KPM User"), displayRole (string, default: "Admin")
- Hardcoded: Nav labels (Home, Inventory, Sales, Accounting, Insights, Suppliers, Customers, Reports, Settings), lucide icons, KPM logo image URL, sidebar width 232px, canvas/surface tokens

## KpmLogo
- Source: `frontend/src/components/ui/Logo.tsx`
- Category: layout
- Description: Brand logo link to dashboard
- Extractable props: href (string, default: "/dashboard")
- Hardcoded: logo image path/URL, alt "KPM", height classes

## PageHeader
- Source: `frontend/src/components/ui/PageHeader.tsx`
- Category: basic
- Description: Title + description + action row
- Extractable props: title (string, default: "Dashboard"), description (string, default: "")
- Hardcoded: typography sizes, layout flex

## MetricStrip
- Source: `frontend/src/components/ui/MetricStrip.tsx`
- Category: basic
- Description: KPI metric grid
- Extractable props: (prefer inline in drafts; metrics are page-specific)
- Hardcoded: grid cols, border/radius, label/value styles

## Button
- Source: `frontend/src/components/ui/Button.tsx`
- Category: basic
- Description: Shared button variants — skip extraction; inline in drafts
- Extractable props: n/a
- Hardcoded: variants, sizes
