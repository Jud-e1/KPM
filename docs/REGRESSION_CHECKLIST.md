# KPM Regression Checklist

Use after each polish phase. Critical flows must still pass.

## Auth
- [ ] Email signup creates account and lands on `/dashboard`
- [ ] Email signin with `?next=` redirects correctly
- [ ] Unauthenticated visit to `/inventory` redirects to `/signin`
- [ ] Settings save updates profile; sign-out clears session
- [ ] Landing AuthModal signup/signin obtains a real JWT (not fake success)
- [ ] Google OAuth (when `GOOGLE_CLIENT_ID` set) issues JWT and enters app

## Modules (CRUD + live data)
- [ ] Dashboard KPIs reflect inventory/sales/accounting after connectLive
- [ ] Inventory: add product, adjust stock, delete; survives refresh
- [ ] Sales: create order, update status
- [ ] Accounting: create/update transaction; profile sync
- [ ] Customers: add/update customer (owner-scoped)
- [ ] Suppliers: approve/request supplier (owner-scoped)
- [ ] Insights: ask question returns OpenAI when key set, else clear rules/fallback UI

## Isolation
- [ ] User A cannot see User B customers/products via API
- [ ] Empty account can seed personal demo data without colliding with another user

## UI shell
- [ ] Sidebar nav works on desktop and mobile drawer
- [ ] Settings reachable from shell user menu
- [ ] Landing marketing sections still render (Home/Features/Trust)

## Deploy
- [ ] `GET /api/v1/health` database connected
- [ ] Frontend and backend Docker images match current source
