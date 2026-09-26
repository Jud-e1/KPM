# Routes

Framework: Next.js App Router under `frontend/src/app/`.

| URL | File | Layout | Summary |
|-----|------|--------|---------|
| `/` | `frontend/src/app/page.tsx` | root | Marketing landing |
| `/signin` | `frontend/src/app/signin/page.tsx` | root | Sign in |
| `/signup` | `frontend/src/app/signup/page.tsx` | root | Sign up |
| `/dashboard` | `frontend/src/app/dashboard/page.tsx` | AuthGuard + AppShell | Signed-in home: KPIs, modules, inventory chart, activity, ask insights, ML suggestions |
| `/inventory` | `frontend/src/app/inventory/page.tsx` | AuthGuard + AppShell | Stock management |
| `/sales` | `frontend/src/app/sales/page.tsx` | AuthGuard + AppShell | Orders |
| `/accounting` | `frontend/src/app/accounting/page.tsx` | AuthGuard + AppShell | Ledger / books |
| `/customers` | `frontend/src/app/customers/page.tsx` | AuthGuard + AppShell | Customers |
| `/suppliers` | `frontend/src/app/suppliers/page.tsx` | AuthGuard + AppShell | Suppliers |
| `/insights` | `frontend/src/app/insights/page.tsx` | AuthGuard + AppShell | AI insights / forecasts |
| `/onboarding` | `frontend/src/app/onboarding/page.tsx` | AuthGuard | Setup wizard |
| `/settings` | `frontend/src/app/settings/page.tsx` | AuthGuard + AppShell | Account / automation |

Protected app pages use per-route `layout.tsx` wrapping `AuthGuard`. Most feature pages render inside `AppShell`.
