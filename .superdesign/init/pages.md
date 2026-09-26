# Page dependency trees

## /dashboard
Entry: frontend/src/app/dashboard/page.tsx
Layout: frontend/src/app/dashboard/layout.tsx → AuthGuard
Dependencies:
- frontend/src/components/AppShell.tsx
  - frontend/src/components/ui/Logo.tsx
  - frontend/src/lib/authStore.ts (logic)
  - frontend/src/lib/accountingStore.ts (logic)
- frontend/src/components/ui/PageHeader.tsx
- frontend/src/components/ui/MetricStrip.tsx
- frontend/src/components/ui/Button.tsx
- frontend/src/components/ui/Dialog.tsx
- frontend/src/components/EmptyState.tsx
- frontend/src/components/MlSuggestionsPanel.tsx
  - frontend/src/components/ui/Button.tsx
  - frontend/src/lib/api.ts (logic)
- frontend/src/lib/inventoryStore.ts (logic)
- frontend/src/lib/salesStore.ts (logic)
- frontend/src/lib/accountingStore.ts (logic)
- frontend/src/app/globals.css (tokens)

## /inventory
Entry: frontend/src/app/inventory/page.tsx
Dependencies:
- frontend/src/components/AppShell.tsx
- frontend/src/components/ui/* (PageHeader, MetricStrip, Button, DataTable, Status, Dialog, Input)
- frontend/src/components/ItemManager.tsx
- frontend/src/lib/inventoryStore.ts

## /sales
Entry: frontend/src/app/sales/page.tsx
Dependencies:
- frontend/src/components/AppShell.tsx
- frontend/src/components/ui/*
- frontend/src/lib/salesStore.ts

## /accounting
Entry: frontend/src/app/accounting/page.tsx
Dependencies:
- frontend/src/components/AppShell.tsx
- frontend/src/components/ui/*
- frontend/src/lib/accountingStore.ts

## /insights
Entry: frontend/src/app/insights/page.tsx
Dependencies:
- frontend/src/components/AppShell.tsx
- frontend/src/components/ui/*
- frontend/src/lib/insightsStore.ts

## /settings
Entry: frontend/src/app/settings/page.tsx
Dependencies:
- frontend/src/components/AppShell.tsx
- frontend/src/components/ui/*

## /customers
Entry: frontend/src/app/customers/page.tsx
Dependencies:
- frontend/src/components/AppShell.tsx
- frontend/src/lib/customersStore.ts

## /suppliers
Entry: frontend/src/app/suppliers/page.tsx
Dependencies:
- frontend/src/components/AppShell.tsx
- frontend/src/lib/suppliersStore.ts

## / (landing)
Entry: frontend/src/app/page.tsx
Dependencies:
- frontend/src/components/landing/*
