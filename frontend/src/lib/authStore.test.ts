import { beforeEach, describe, expect, it } from "vitest";
import { authStore } from "@/lib/authStore";

describe("authStore", () => {
  beforeEach(() => {
    localStorage.clear();
    authStore.clearSession();
  });

  it("stores and clears a session", () => {
    authStore.setSession("token-123", {
      id: "user-1",
      email: "a@kpm.test",
      full_name: "Ada",
      organization: "KPM",
      business_type: null,
      role: "Admin",
      is_active: true,
      created_at: new Date().toISOString(),
    });
    expect(authStore.getToken()).toBe("token-123");
    expect(authStore.getState().user?.email).toBe("a@kpm.test");
    authStore.clearSession();
    expect(authStore.getToken()).toBeNull();
    expect(authStore.getState().user).toBeNull();
  });

  it("notifies subscribers on session changes", () => {
    const emails: Array<string | null> = [];
    const unsub = authStore.subscribe((state) => {
      emails.push(state.user?.email ?? null);
    });
    authStore.setSession("t", {
      id: "user-2",
      email: "b@kpm.test",
      full_name: "Bea",
      organization: "KPM",
      business_type: null,
      role: "Admin",
      is_active: true,
      created_at: new Date().toISOString(),
    });
    authStore.clearSession();
    unsub();
    expect(emails).toContain("b@kpm.test");
    expect(emails[emails.length - 1]).toBeNull();
  });
});
