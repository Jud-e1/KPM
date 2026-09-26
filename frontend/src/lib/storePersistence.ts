/** Shared helpers so domain stores never show another user's cached books. */

export const DOMAIN_STORAGE_BASES = [
  "kpm_inventory_state_v3",
  "kpm_sales_state_v2",
  "kpm_accounting_state_v2",
  "kpm_customers_state_v3",
  "kpm_suppliers_state_v3",
  "kpm_insights_state_v2",
] as const;

/** Legacy inventory cache keys that held the fake 60-product / $508k demo catalog. */
const LEGACY_INVENTORY_KEY_PREFIXES = [
  "kpm_inventory_state_v1",
  "kpm_inventory_state_v2",
  "kpm_inventory_state_v3",
] as const;

/** Legacy suppliers keys that held the fake ~40-vendor / $57k directory. */
const LEGACY_SUPPLIERS_KEY_PREFIXES = [
  "kpm_suppliers_state_v1",
  "kpm_suppliers_state_v2",
  "kpm_suppliers_state_v3",
] as const;

/** Legacy customers keys that held the fake ~40-customer / $413k directory. */
const LEGACY_CUSTOMERS_KEY_PREFIXES = [
  "kpm_customers_state_v1",
  "kpm_customers_state_v2",
  "kpm_customers_state_v3",
] as const;

/** Remove every inventory localStorage key (legacy + scoped) so demo KPIs cannot resurface. */
export function purgeInventoryStorage() {
  if (typeof window === "undefined") return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        LEGACY_INVENTORY_KEY_PREFIXES.some(
          (prefix) => key === prefix || key.startsWith(`${prefix}:`)
        ) ||
        key.toLowerCase().includes("kpm_inventory")
      ) {
        doomed.push(key);
      }
    }
    for (const key of doomed) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Remove every suppliers localStorage key so demo directory KPIs cannot resurface. */
export function purgeSuppliersStorage() {
  if (typeof window === "undefined") return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        LEGACY_SUPPLIERS_KEY_PREFIXES.some(
          (prefix) => key === prefix || key.startsWith(`${prefix}:`)
        ) ||
        key.toLowerCase().includes("kpm_suppliers")
      ) {
        doomed.push(key);
      }
    }
    for (const key of doomed) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Remove every customers localStorage key so demo directory KPIs cannot resurface. */
export function purgeCustomersStorage() {
  if (typeof window === "undefined") return;
  try {
    const doomed: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        LEGACY_CUSTOMERS_KEY_PREFIXES.some(
          (prefix) => key === prefix || key.startsWith(`${prefix}:`)
        ) ||
        key.toLowerCase().includes("kpm_customers")
      ) {
        doomed.push(key);
      }
    }
    for (const key of doomed) localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function scopedStorageKey(base: string, ownerId: string | null | undefined): string | null {
  if (!ownerId) return null;
  return `${base}:${ownerId}`;
}

/** Remove legacy unscoped keys and any scoped keys for a given owner. */
export function purgeDomainStorage(ownerId?: string | null) {
  if (typeof window === "undefined") return;
  purgeInventoryStorage();
  purgeSuppliersStorage();
  purgeCustomersStorage();
  for (const base of DOMAIN_STORAGE_BASES) {
    try {
      localStorage.removeItem(base);
      if (ownerId) localStorage.removeItem(`${base}:${ownerId}`);
    } catch {
      /* ignore */
    }
  }
  if (!ownerId) {
    // Wipe every scoped domain key left behind by prior sessions.
    try {
      const doomed: string[] = [];
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (!key) continue;
        if (DOMAIN_STORAGE_BASES.some((base) => key.startsWith(`${base}:`))) {
          doomed.push(key);
        }
      }
      for (const key of doomed) localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export function readScopedJson<T>(base: string, ownerId: string | null | undefined): T | null {
  const key = scopedStorageKey(base, ownerId);
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeScopedJson(base: string, ownerId: string | null | undefined, value: unknown) {
  const key = scopedStorageKey(base, ownerId);
  if (!key || typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function removeScopedJson(base: string, ownerId: string | null | undefined) {
  const key = scopedStorageKey(base, ownerId);
  if (!key || typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
