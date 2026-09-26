"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Lock, LogOut, Save, ShieldCheck, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { fieldClass } from "@/components/ui/Input";
import { authStore, type AuthUser } from "@/lib/authStore";
import { accountingStore } from "@/lib/accountingStore";
import {
  connectOnboardingIntegration,
  fetchOnboardingState,
  removeOnboardingIntegration,
  saveOnboardingAutomations,
  saveOnboardingProfile,
  skipOnboardingIntegration,
  updateMe,
  type AutomationMode,
  type BusinessTypeOption,
  type OnboardingIntegration,
  type OnboardingState,
  type TaxModeOption,
  type TeamSizeOption,
} from "@/lib/api";
import {
  AUTOMATION_DEFS,
  CONNECTOR_GROUPS,
  CONNECTORS,
  COUNTRIES,
  CURRENCIES,
  type ConnectorDef,
} from "@/lib/onboardingCatalog";
import { isSetupActive, markAutomationSetupDone } from "@/lib/setupFlow";
import { themeStore, type ThemePreference } from "@/lib/themeStore";

function modeLabel(mode: AutomationMode) {
  if (mode === "automatic") return "Automatic";
  if (mode === "suggest") return "Suggest";
  return "Off";
}

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(authStore.getState().user);
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [organization, setOrganization] = useState(user?.organization || "");
  const [role, setRole] = useState(user?.role || "Admin");
  const [businessType, setBusinessType] = useState(user?.business_type || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemePreference>("light");

  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyType, setCompanyType] = useState<BusinessTypeOption>("Retail");
  const [teamSize, setTeamSize] = useState<TeamSizeOption>("Just me");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [taxMode, setTaxMode] = useState<TaxModeOption>("added_at_sale");
  const [automations, setAutomations] = useState<Record<string, AutomationMode>>({});
  const [activeConnector, setActiveConnector] = useState<ConnectorDef | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = authStore.subscribe((state) => {
      setUser(state.user);
      if (state.user) {
        setFullName(state.user.full_name);
        setOrganization(state.user.organization || "");
        setRole(state.user.role);
        setBusinessType(state.user.business_type || "");
      }
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    return themeStore.subscribe((next) => setTheme(next));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await fetchOnboardingState();
        if (cancelled) return;
        setOnboarding(next);
        setCompanyName(next.profile.company_name || "");
        setCompanyType(next.profile.business_type || "Retail");
        setTeamSize(next.profile.team_size || "Just me");
        setCountry(next.profile.country || "");
        setCurrency(next.profile.currency || "USD");
        setTaxMode(next.profile.tax_mode || "added_at_sale");
        const map: Record<string, AutomationMode> = {};
        for (const item of next.automations) map[item.function_id] = item.mode;
        for (const def of AUTOMATION_DEFS) if (!map[def.id]) map[def.id] = "off";
        setAutomations(map);
      } catch {
        /* optional until first visit */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const integrations = onboarding?.integrations || [];
  const statusFor = (providerId: string) => integrations.find((item: OnboardingIntegration) => item.provider_id === providerId);

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const updated = await updateMe({
        full_name: fullName.trim(),
        organization: organization.trim() || fullName.trim(),
        role: role.trim() || "Admin",
        business_type: businessType.trim() || undefined,
      });
      authStore.updateUser(updated);
      accountingStore.updateProfile({
        fullName: updated.full_name,
        organization: updated.organization || updated.full_name,
        role: updated.role,
      });
      setMessage("Account settings saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save settings");
    } finally {
      setSaving(false);
    }
  };

  const onSaveCompany = async () => {
    if (!companyName.trim()) {
      setError("Company name is required.");
      return;
    }
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const next = await saveOnboardingProfile({
        company_name: companyName.trim(),
        business_type: companyType,
        team_size: teamSize,
        country,
        currency,
        tax_mode: taxMode,
      });
      setOnboarding(next);
      setOrganization(next.profile.company_name);
      setBusinessType(next.profile.business_type);
      const userState = authStore.getState().user;
      if (userState) {
        authStore.updateUser({
          ...userState,
          organization: next.profile.company_name,
          business_type: next.profile.business_type,
        });
      }
      setMessage("Company profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save company profile");
    } finally {
      setSaving(false);
    }
  };

  const onSaveAutomations = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const next = await saveOnboardingAutomations(
        AUTOMATION_DEFS.map((def) => ({ function_id: def.id, mode: automations[def.id] || "off" }))
      );
      setOnboarding(next);
      accountingStore.updateProfile({
        autoReconciliation: (automations.reconcile || "off") === "automatic",
      });
      if (isSetupActive()) {
        markAutomationSetupDone();
        window.dispatchEvent(new Event("kpm-setup-change"));
      }
      setMessage("AI preferences saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save AI preferences");
    } finally {
      setSaving(false);
    }
  };

  const onSaveConnector = async () => {
    if (!activeConnector) return;
    setSaving(true);
    setError(null);
    try {
      if (activeConnector.id === "kpm_books") {
        await connectOnboardingIntegration({
          provider_id: "kpm_books",
          category: "accounting",
          api_key: "kpm-books-builtin",
        });
      } else {
        if (apiKey.trim().length < 4) {
          setError("Paste an API key with at least 4 characters.");
          setSaving(false);
          return;
        }
        await connectOnboardingIntegration({
          provider_id: activeConnector.id,
          category: activeConnector.category,
          api_key: apiKey.trim(),
        });
      }
      const next = await fetchOnboardingState();
      setOnboarding(next);
      setActiveConnector(null);
      setApiKey("");
      setHelpOpen(false);
      setMessage("Connection saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save connection");
    } finally {
      setSaving(false);
    }
  };

  const onSignOut = () => {
    authStore.clearSession();
    router.replace("/signin");
  };

  return (
    <AppShell searchPlaceholder="Search settings…" maxWidthClassName="max-w-3xl">
      <PageHeader
        title="Settings"
        description="Profile, connections, and what KPM may do on its own."
        actions={
          <Button type="button" variant="secondary" size="sm" onClick={onSignOut}>
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
        }
      />

      <nav aria-label="Settings sections" className="flex flex-wrap gap-2">
        {[
          ["settings-account", "Account"],
          ["settings-appearance", "Appearance"],
          ["settings-business", "Business"],
          ["settings-connections", "Integrations"],
          ["settings-ai", "AI preferences"],
        ].map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="inline-flex h-8 items-center rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-[12px] font-medium text-[var(--app-ink)] hover:bg-[var(--app-hover)] transition-colors duration-160"
          >
            {label}
          </a>
        ))}
      </nav>

      {message ? <p className="text-sm text-[var(--app-positive)]">{message}</p> : null}
      {error ? <p className="text-sm text-[var(--app-critical)]">{error}</p> : null}

      <form id="settings-account" onSubmit={onSave} className="mt-4 scroll-mt-24 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 space-y-4 shadow-[var(--app-shadow-xs)]">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--app-ink)]">
          <ShieldCheck className="w-4 h-4" /> Signed in as {user?.email}
        </div>

        <label className="block text-sm">
          <span className="font-medium text-[var(--app-ink)]">Full name</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={`mt-1.5 ${fieldClass}`}
            required
            minLength={2}
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-[var(--app-ink)]">Organization</span>
          <input
            value={organization}
            onChange={(e) => setOrganization(e.target.value)}
            className={`mt-1.5 ${fieldClass}`}
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-[var(--app-ink)]">Role</span>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={`mt-1.5 ${fieldClass}`}
          />
        </label>

        <label className="block text-sm">
          <span className="font-medium text-[var(--app-ink)]">Business type</span>
          <input
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value)}
            className={`mt-1.5 ${fieldClass}`}
            placeholder="e.g. Wholesale & Distribution"
          />
        </label>

        <button
          type="submit"
          disabled={saving || fullName.trim().length < 2}
          className="inline-flex h-8 items-center gap-2 rounded-[var(--app-radius-control)] bg-[var(--app-nav-active-bg)] px-3 text-[13px] font-medium text-[var(--app-nav-active)] hover:opacity-90 disabled:opacity-50 transition-[opacity,transform] duration-160 active:scale-[0.98]"
        >
          <Save className="w-4 h-4" />
          {saving ? "Saving…" : "Save account"}
        </button>
      </form>

      <section
        id="settings-appearance"
        className="mt-4 scroll-mt-24 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 space-y-4 shadow-[var(--app-shadow-xs)]"
      >
        <div>
          <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--app-ink)]">Appearance</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--app-muted)]">
            KPM uses a light white workspace across every page.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Color theme">
          <button
            type="button"
            onClick={() => themeStore.setTheme("light")}
            aria-pressed={theme === "light"}
            className="inline-flex h-9 items-center rounded-[var(--app-radius-control)] border border-[var(--app-nav-active-bg)] bg-[var(--app-nav-active-bg)] px-3.5 text-[13px] font-medium text-[var(--app-nav-active)]"
          >
            Light
          </button>
        </div>
      </section>

      <section id="settings-business" className="mt-4 scroll-mt-24 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 space-y-4 shadow-[var(--app-shadow-xs)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--app-ink)]">Company profile</h2>
            <p className="text-sm text-[var(--app-muted)]">Same details collected during onboarding.</p>
          </div>
          <Link href="/onboarding" className="text-sm font-semibold text-[var(--app-ink)] hover:underline">
            Open wizard
          </Link>
        </div>

        <label className="block text-sm">
          <span className="font-medium text-[var(--app-ink)]">Company name</span>
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className={`mt-1.5 ${fieldClass}`}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="font-medium text-[var(--app-ink)]">Business type</span>
            <select
              value={companyType}
              onChange={(e) => setCompanyType(e.target.value as BusinessTypeOption)}
              className={`mt-1.5 ${fieldClass}`}
            >
              <option value="Retail">Retail</option>
              <option value="Wholesale">Wholesale</option>
              <option value="Manufacturing">Manufacturing</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[var(--app-ink)]">Team size</span>
            <select
              value={teamSize}
              onChange={(e) => setTeamSize(e.target.value as TeamSizeOption)}
              className={`mt-1.5 ${fieldClass}`}
            >
              <option value="Just me">Just me</option>
              <option value="2-10">2–10</option>
              <option value="11-50">11–50</option>
              <option value="51+">51+</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[var(--app-ink)]">Country</span>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className={`mt-1.5 ${fieldClass}`}
            >
              <option value="">Select a country</option>
              {COUNTRIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium text-[var(--app-ink)]">Currency</span>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={`mt-1.5 ${fieldClass}`}
            >
              {CURRENCIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
        <fieldset className="text-sm">
          <legend className="font-medium text-[var(--app-ink)]">Tax</legend>
          <div className="mt-2 flex flex-wrap gap-4">
            <label className="flex items-center gap-2">
              <input type="radio" checked={taxMode === "included"} onChange={() => setTaxMode("included")} />
              Prices include tax
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={taxMode === "added_at_sale"} onChange={() => setTaxMode("added_at_sale")} />
              Tax is added at sale
            </label>
          </div>
        </fieldset>
        <button
          type="button"
          disabled={saving}
          onClick={onSaveCompany}
          className="inline-flex h-8 items-center gap-2 rounded-[var(--app-radius-control)] bg-[var(--app-nav-active-bg)] px-3 text-[13px] font-medium text-[var(--app-nav-active)] hover:opacity-90 disabled:opacity-50"
        >
          Save company
        </button>
      </section>

      <section id="settings-connections" className="mt-4 scroll-mt-24 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--app-ink)]">Connections</h2>
          <p className="text-sm text-[var(--app-muted)]">Keys are stored locked and never shown again.</p>
        </div>
        {CONNECTOR_GROUPS.map((group) => (
          <div key={group.id} className="space-y-2">
            <h3 className="text-xs font-semibold text-[var(--app-muted)]">{group.title}</h3>
            <div className="space-y-2">
              {CONNECTORS.filter((item) => item.category === group.id).map((connector) => {
                const status = statusFor(connector.id);
                const saved = status?.status === "saved" || connector.id === "kpm_books";
                return (
                  <div key={connector.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--app-radius-control)] border border-[var(--app-border)] px-3 py-2.5">
                    <div>
                      <div className="text-sm font-semibold text-[var(--app-ink)]">{connector.name}</div>
                      <div className="text-[12px] text-[var(--app-muted)]">
                        {saved ? (status?.key_last4 ? `Saved · ends in ${status.key_last4}` : "Saved") : "Not connected"}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!saved && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveConnector(connector);
                            setApiKey("");
                            setHelpOpen(false);
                          }}
                          className="h-8 rounded-[var(--app-radius-control)] bg-[var(--app-nav-active-bg)] px-3 text-[13px] font-medium text-[var(--app-nav-active)] hover:opacity-90"
                        >
                          Connect
                        </button>
                      )}
                      {saved && connector.id !== "kpm_books" && (
                        <button
                          type="button"
                          onClick={async () => {
                            await removeOnboardingIntegration(connector.id);
                            setOnboarding(await fetchOnboardingState());
                            setMessage("Connection removed.");
                          }}
                          className="h-8 rounded-[var(--app-radius-control)] border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3 text-[13px] font-medium text-[var(--app-ink)] hover:bg-[var(--app-hover)]"
                        >
                          Remove
                        </button>
                      )}
                      {!saved && connector.id !== "kpm_books" && (
                        <button
                          type="button"
                          onClick={async () => {
                            await skipOnboardingIntegration({
                              provider_id: connector.id,
                              category: connector.category,
                            });
                            setOnboarding(await fetchOnboardingState());
                          }}
                          className="h-8 rounded-[var(--app-radius-control)] border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3 text-[13px] font-medium text-[var(--app-ink)] hover:bg-[var(--app-hover)]"
                        >
                          Skip
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section id="settings-ai" className="mt-4 scroll-mt-24 rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--app-ink)]">AI preferences</h2>
          <p className="text-sm text-[var(--app-muted)]">Suggest waits for you. Automatic runs when there is data.</p>
        </div>
        {AUTOMATION_DEFS.map((def) => (
          <div key={def.id} className="rounded-[var(--app-radius-control)] border border-[var(--app-border)] p-3">
            <div className="text-sm font-semibold text-[var(--app-ink)]">{def.name}</div>
            <p className="mt-0.5 text-[12px] text-[var(--app-muted)]">{def.blurb}</p>
            <div className="mt-2 inline-flex rounded-[var(--app-radius-control)] border border-[var(--app-border)] bg-[var(--app-hover)] p-0.5">
              {(["off", "suggest", "automatic"] as AutomationMode[]).map((mode) => {
                const active = (automations[def.id] || "off") === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAutomations((prev) => ({ ...prev, [def.id]: mode }))}
                    className={`rounded-[var(--app-radius-control)] px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 ${
                      active ? "bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active)]" : "text-[var(--app-muted)]"
                    }`}
                  >
                    {modeLabel(mode)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <button
          type="button"
          disabled={saving}
          onClick={onSaveAutomations}
          className="inline-flex h-8 items-center gap-2 rounded-[var(--app-radius-control)] bg-[var(--app-nav-active-bg)] px-3 text-[13px] font-medium text-[var(--app-nav-active)] hover:opacity-90 disabled:opacity-50"
        >
          Save AI preferences
        </button>
      </section>

      {activeConnector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--app-overlay)] p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-5 shadow-[var(--app-shadow-pop)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--app-ink)]">Connect {activeConnector.name}</h3>
                <p className="mt-1 text-sm text-[var(--app-muted)]">
                  Paste the key from the tool’s settings. We store it locked, and we never show it again.
                </p>
              </div>
              <button type="button" onClick={() => setActiveConnector(null)} className="p-1 text-[var(--app-faint)]" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            {activeConnector.oauthStyle && (
              <p className="mt-3 rounded-xl bg-[var(--app-hover)] px-3 py-2 text-[12px] text-[var(--app-muted)]">
                A sign-in window for this tool is not available yet. You can paste a key, or skip and connect later.
              </p>
            )}
            {activeConnector.id !== "kpm_books" && (
              <>
                <button
                  type="button"
                  onClick={() => setHelpOpen((open) => !open)}
                  className="mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--app-ink)]"
                >
                  Where do I find this?
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${helpOpen ? "rotate-180" : ""}`} />
                </button>
                {helpOpen && (
                  <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13px] text-[var(--app-muted)]">
                    {activeConnector.help.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ol>
                )}
                <label className="mt-4 block text-sm">
                  <span className="font-medium text-[var(--app-ink)]">API key</span>
                  <div className="relative mt-1.5">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--app-faint)]" />
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className={`${fieldClass} pl-9`}
                      placeholder="Paste key"
                      autoComplete="off"
                    />
                  </div>
                </label>
              </>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={onSaveConnector}
                className="inline-flex h-8 flex-1 items-center justify-center rounded-[var(--app-radius-control)] bg-[var(--app-nav-active-bg)] text-[13px] font-medium text-[var(--app-nav-active)] hover:opacity-90 disabled:opacity-50"
              >
                Save connection
              </button>
              <button
                type="button"
                onClick={() => setActiveConnector(null)}
                className="h-8 rounded-[var(--app-radius-control)] border border-[var(--app-border-strong)] bg-[var(--app-surface)] px-3 text-[13px] font-medium text-[var(--app-ink)] hover:bg-[var(--app-hover)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
