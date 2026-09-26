import { accountingStore } from "@/lib/accountingStore";
import { customersStore } from "@/lib/customersStore";
import { insightsStore } from "@/lib/insightsStore";
import { inventoryStore } from "@/lib/inventoryStore";
import { salesStore } from "@/lib/salesStore";
import { suppliersStore } from "@/lib/suppliersStore";
import { DOMAIN_STORAGE_BASES, purgeDomainStorage, purgeCustomersStorage, purgeInventoryStorage, purgeSuppliersStorage } from "@/lib/storePersistence";

/** Wipe domain caches so another account never inherits prior books. */
export function clearDomainCaches() {
  purgeDomainStorage();
  inventoryStore.resetToDefault();
  salesStore.resetToDefault();
  accountingStore.resetToDefault();
  customersStore.resetToDefault();
  suppliersStore.resetToDefault();
  insightsStore.resetToDefault();
}

/** Attach all domain stores to the signed-in user and pull live API data. */
export function bindDomainStores(userId: string) {
  // Drop legacy unscoped keys that caused fake KPIs (e.g. 60 / $508k, 40 / $57k / $413k).
  purgeInventoryStorage();
  purgeSuppliersStorage();
  purgeCustomersStorage();
  if (typeof window !== "undefined") {
    for (const base of DOMAIN_STORAGE_BASES) {
      try {
        localStorage.removeItem(base);
      } catch {
        /* ignore */
      }
    }
  }
  inventoryStore.bindOwner(userId);
  salesStore.bindOwner(userId);
  accountingStore.bindOwner(userId);
  customersStore.bindOwner(userId);
  suppliersStore.bindOwner(userId);
  insightsStore.bindOwner(userId);
}
