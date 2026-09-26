import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AuthGuard } from "@/components/AuthGuard";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/dashboard",
}));

vi.mock("@/lib/api", () => ({
  fetchMe: vi.fn(),
}));

import { fetchMe } from "@/lib/api";
import { authStore } from "@/lib/authStore";

describe("AuthGuard", () => {
  beforeEach(() => {
    localStorage.clear();
    authStore.clearSession();
    replace.mockReset();
    vi.mocked(fetchMe).mockReset();
  });

  it("redirects to signin when no token", async () => {
    render(
      <AuthGuard>
        <div>Secret</div>
      </AuthGuard>
    );
    await waitFor(() => {
      expect(replace).toHaveBeenCalled();
      expect(String(replace.mock.calls[0][0])).toContain("/signin");
    });
    expect(screen.queryByText("Secret")).toBeNull();
  });

  it("renders children when session is valid", async () => {
    localStorage.setItem("kpm_auth_token", "tok");
    authStore.setSession("tok", {
      id: "u1",
      email: "ok@kpm.test",
      full_name: "Ok",
      organization: "KPM",
      business_type: null,
      role: "Admin",
      is_active: true,
      created_at: new Date().toISOString(),
    });
    vi.mocked(fetchMe).mockResolvedValue({
      id: "u1",
      email: "ok@kpm.test",
      full_name: "Ok",
      organization: "KPM",
      business_type: null,
      role: "Admin",
      is_active: true,
      created_at: new Date().toISOString(),
    });
    render(
      <AuthGuard>
        <div>Secret</div>
      </AuthGuard>
    );
    await waitFor(() => {
      expect(screen.getByText("Secret")).toBeInTheDocument();
    });
  });
});
