"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ChevronDown, Lock, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Skeleton } from "@/components/ui/Skeleton";
import { authStore } from "@/lib/authStore";
import { accountingStore } from "@/lib/accountingStore";
import {
  completeOnboarding,
  connectOnboardingIntegration,
  fetchOnboardingState,
  removeOnboardingIntegration,
  saveOnboardingAutomations,
  saveOnboardingProfile,
  setOnboardingStep,
  skipOnboardingIntegration,
  type AutomationMode,
  type BusinessTypeOption,
  type OnboardingAutomation,
  type OnboardingIntegration,
  type OnboardingProfile,
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

const STEPS = [
  { id: "company", label: "Company" },
  { id: "connections", label: "Connections" },
  { id: "ai", label: "AI" },
  { id: "review", label: "Review" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

function modeLabel(mode: AutomationMode) {
  if (mode === "automatic") return "Automatic";
  if (mode === "suggest") return "Suggest";
  return "Off";
}

function statusFor(integrations: OnboardingIntegration[], providerId: string) {
  return integrations.find((item) => item.provider_id === providerId);
}

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<StepId>("company");
  const [state, setState] = useState<OnboardingState | null>(null);

  const [companyName, setCompanyName] = useState("");
  const [businessType, setBusinessType] = useState<BusinessTypeOption>("Retail");
  const [teamSize, setTeamSize] = useState<TeamSizeOption>("Just me");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [taxMode, setTaxMode] = useState<TaxModeOption>("added_at_sale");
  const [automations, setAutomations] = useState<Record<string, AutomationMode>>({});

  const [activeConnector, setActiveConnector] = useState<ConnectorDef | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [shopName, setShopName] = useState("");
  const [oauthNote, setOauthNote] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const applyState = (next: OnboardingState) => {
    setState(next);
    setCompanyName(next.profile.company_name || "");
    setBusinessType(next.profile.business_type || "Retail");
    setTeamSize(next.profile.team_size || "Just me");
    setCountry(next.profile.country || "");
    setCurrency(next.profile.currency || "USD");
    setTaxMode(next.profile.tax_mode || "added_at_sale");
    const map: Record<string, AutomationMode> = {};
    for (const item of next.automations) map[item.function_id] = item.mode;
    for (const def of AUTOMATION_DEFS) {
      if (!map[def.id]) map[def.id] = "off";
    }
    setAutomations(map);
    const current = next.profile.current_step;
    if (current === "done") setStep("review");
    else if (current === "company" || current === "connections" || current === "ai" || current === "review") {
      setStep(current);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const next = await fetchOnboardingState();
        if (cancelled) return;
        applyState(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load onboarding");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const integrations = state?.integrations || [];
  const savedOutside = useMemo(
    () => integrations.filter((item) => item.status === "saved" && item.provider_id !== "kpm_books"),
    [integrations]
  );

  const syncLocalAuth = (profile: OnboardingProfile) => {
    const user = authStore.getState().user;
    if (user) {
      authStore.updateUser({
        ...user,
        organization: profile.company_name,
        business_type: profile.business_type,
      });
    }
    accountingStore.updateProfile({
      organization: profile.company_name,
      autoReconciliation: (automations.reconcile || "suggest") === "automatic",
    });
  };

  const onContinueCompany = async () => {
    if (!companyName.trim() || !businessType) {
      setError("Company name and business type are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await saveOnboardingProfile({
        company_name: companyName.trim(),
        business_type: businessType,
        team_size: teamSize,
        country,
        currency,
        tax_mode: taxMode,
        current_step: "connections",
      });
      applyState(next);
      syncLocalAuth(next.profile);
      setStep("connections");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save company profile");
    } finally {
      setSaving(false);
    }
  };

  const onSkipConnections = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const connector of CONNECTORS) {
        if (connector.id === "kpm_books") continue;
        const existing = statusFor(integrations, connector.id);
        if (!existing || existing.status !== "saved") {
          await skipOnboardingIntegration({ provider_id: connector.id, category: connector.category });
        }
      }
      const next = await setOnboardingStep("ai");
      applyState(next);
      setStep("ai");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue");
    } finally {
      setSaving(false);
    }
  };

  const onContinueConnections = async () => {
    setSaving(true);
    setError(null);
    try {
      const books = statusFor(integrations, "kpm_books");
      if (!books || books.status !== "saved") {
        await connectOnboardingIntegration({
          provider_id: "kpm_books",
          category: "accounting",
          api_key: "kpm-books-builtin",
        });
      }
      const next = await setOnboardingStep("ai");
      applyState(next);
      setStep("ai");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not continue");
    } finally {
      setSaving(false);
    }
  };

  const onSaveConnector = async () => {
    if (!activeConnector) return;
    if (activeConnector.id === "kpm_books") {
      setSaving(true);
      setError(null);
      try {
        await connectOnboardingIntegration({
          provider_id: "kpm_books",
          category: "accounting",
          api_key: "kpm-books-builtin",
        });
        const next = await fetchOnboardingState();
        applyState(next);
        setActiveConnector(null);
        setApiKey("");
        setHelpOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not save connection");
      } finally {
        setSaving(false);
      }
      return;
    }
    if (apiKey.trim().length < 4) {
      setError("Paste an API key with at least 4 characters.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await connectOnboardingIntegration({
        provider_id: activeConnector.id,
        category: activeConnector.category,
        api_key: apiKey.trim(),
      });
      const next = await fetchOnboardingState();
      applyState(next);
      setActiveConnector(null);
      setApiKey("");
      setHelpOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save connection");
    } finally {
      setSaving(false);
    }
  };

  const onSkipConnector = async (connector: ConnectorDef) => {
    setSaving(true);
    setError(null);
    try {
      await skipOnboardingIntegration({ provider_id: connector.id, category: connector.category });
      const next = await fetchOnboardingState();
      applyState(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not skip");
    } finally {
      setSaving(false);
    }
  };

  const onRemoveConnector = async (providerId: string) => {
    setSaving(true);
    setError(null);
    try {
      await removeOnboardingIntegration(providerId);
      const next = await fetchOnboardingState();
      applyState(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove connection");
    } finally {
      setSaving(false);
    }
  };

  const onContinueAi = async () => {
    setSaving(true);
    setError(null);
    try {
      const items: OnboardingAutomation[] = AUTOMATION_DEFS.map((def) => ({
        function_id: def.id,
        mode: automations[def.id] || "off",
      }));
      const next = await saveOnboardingAutomations(items);
      applyState(next);
      syncLocalAuth(next.profile);
      setStep("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save AI preferences");
    } finally {
      setSaving(false);
    }
  };

  const onFinish = async () => {
    setSaving(true);
    setError(null);
    try {
      const items: OnboardingAutomation[] = AUTOMATION_DEFS.map((def) => ({
        function_id: def.id,
        mode: automations[def.id] || "off",
      }));
      await saveOnboardingAutomations(items);
      const next = await completeOnboarding();
      applyState(next);
      syncLocalAuth(next.profile);
      router.push("/dashboard?tour=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish setup");
    } finally {
      setSaving(false);
    }
  };

  const stepIndex = STEPS.findIndex((item) => item.id === step);

  if (loading) {
    return (
      <AppShell searchPlaceholder="Search…" maxWidthClassName="max-w-3xl">
        <div className="space-y-4" aria-busy="true" aria-label="Loading setup">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell searchPlaceholder="Search setup…" maxWidthClassName="max-w-3xl">
      <div className="space-y-6">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-[var(--app-accent)]">SETUP</p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-[var(--app-ink)] sm:text-[32px]">Business onboarding</h1>
          <p className="mt-1 text-sm text-[var(--app-muted)]">A few short steps. Everything stays editable in Settings.</p>
        </div>

        <div className="flex items-center gap-2">
          {STEPS.map((item, index) => {
            const done = index < stepIndex;
            const current = item.id === step;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (index <= stepIndex) setStep(item.id);
                }}
                className="flex flex-1 flex-col items-center gap-1.5"
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-semibold ${
                    done || current ? "bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active)]" : "bg-[var(--app-hover)] text-[var(--app-faint)]"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : index + 1}
                </span>
                <span className={`text-[11px] font-medium ${current ? "text-[var(--app-ink)]" : "text-[var(--app-faint)]"}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {step === "company" && (
          <section className="rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-6 space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--app-ink)]">Tell us about the business.</h2>
              <p className="mt-1 text-sm text-[var(--app-muted)]">
                This sets your books and the automations we suggest. You can change it later in Settings.
              </p>
            </div>

            <label className="block text-sm">
              <span className="font-medium text-[var(--app-ink)]">Company name</span>
              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[var(--app-border)] px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                required
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-[var(--app-ink)]">Business type</span>
              <select
                value={businessType}
                onChange={(e) => setBusinessType(e.target.value as BusinessTypeOption)}
                className="mt-1.5 w-full rounded-xl border border-[var(--app-border)] px-3 py-2.5 text-sm outline-none focus:border-slate-400"
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
                className="mt-1.5 w-full rounded-xl border border-[var(--app-border)] px-3 py-2.5 text-sm outline-none focus:border-slate-400"
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
                className="mt-1.5 w-full rounded-xl border border-[var(--app-border)] px-3 py-2.5 text-sm outline-none focus:border-slate-400"
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
                className="mt-1.5 w-full rounded-xl border border-[var(--app-border)] px-3 py-2.5 text-sm outline-none focus:border-slate-400"
              >
                {CURRENCIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <fieldset className="text-sm">
              <legend className="font-medium text-[var(--app-ink)]">Tax</legend>
              <div className="mt-2 space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="tax"
                    checked={taxMode === "included"}
                    onChange={() => setTaxMode("included")}
                  />
                  Prices include tax
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="tax"
                    checked={taxMode === "added_at_sale"}
                    onChange={() => setTaxMode("added_at_sale")}
                  />
                  Tax is added at sale
                </label>
              </div>
            </fieldset>

            <button
              type="button"
              disabled={saving}
              onClick={onContinueCompany}
              className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--app-nav-active-bg)] px-6 text-sm font-semibold text-[var(--app-nav-active)] hover:opacity-90 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Continue"}
            </button>
          </section>
        )}

        {step === "connections" && (
          <section className="rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-[var(--app-ink)]">Connect what you already use.</h2>
              <p className="mt-1 text-sm text-[var(--app-muted)]">
                Skip anything. KPM still works with products and sales you add yourself.
              </p>
            </div>

            {CONNECTOR_GROUPS.map((group) => (
              <div key={group.id} className="space-y-3">
                <h3 className="text-[12px] font-bold uppercase tracking-[0.12em] text-[var(--app-faint)]">{group.title}</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {CONNECTORS.filter((item) => item.category === group.id).map((connector) => {
                    const status = statusFor(integrations, connector.id);
                    const saved = status?.status === "saved" || connector.id === "kpm_books";
                    const isKpm = connector.id === "kpm_books";
                    return (
                      <div key={connector.id} className="rounded-[var(--app-radius)] border border-[var(--app-border)] p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-[15px] font-bold text-[var(--app-ink)]">{connector.name}</div>
                            <p className="mt-1 text-[13px] text-[var(--app-muted)] leading-relaxed">{connector.blurb}</p>
                            {saved && status?.key_last4 && (
                              <p className="mt-2 text-[12px] text-[var(--app-faint)]">Saved · ends in {status.key_last4}</p>
                            )}
                            {isKpm && <p className="mt-2 text-[12px] font-medium text-[var(--app-positive)]">Included</p>}
                          </div>
                          {saved && !isKpm && <span className="rounded-full bg-[var(--app-positive-bg)] px-2 py-0.5 text-[12px] font-semibold text-[var(--app-positive)]">Saved</span>}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {!saved && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveConnector(connector);
                                  setApiKey("");
                                  setHelpOpen(false);
                                  setError(null);
                                }}
                                className="rounded-full bg-[var(--app-nav-active-bg)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--app-nav-active)] hover:opacity-90"
                              >
                                Connect
                              </button>
                              {!isKpm && (
                                <button
                                  type="button"
                                  onClick={() => onSkipConnector(connector)}
                                  className="rounded-full border border-[var(--app-border)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--app-muted)] hover:bg-[var(--app-hover)]"
                                >
                                  Skip
                                </button>
                              )}
                            </>
                          )}
                          {saved && !isKpm && (
                            <button
                              type="button"
                              onClick={() => onRemoveConnector(connector.id)}
                              className="rounded-full border border-[var(--app-border)] px-3.5 py-1.5 text-[12px] font-semibold text-[var(--app-muted)] hover:bg-[var(--app-hover)]"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={onContinueConnections}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--app-nav-active-bg)] px-6 text-sm font-semibold text-[var(--app-nav-active)] hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Continue"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={onSkipConnections}
                className="text-sm font-semibold text-[var(--app-muted)] hover:text-[var(--app-ink)]"
              >
                Skip for now
              </button>
              <button
                type="button"
                onClick={() => setStep("company")}
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--app-muted)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            </div>
          </section>
        )}

        {step === "ai" && (
          <section className="rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-[var(--app-ink)]">Choose what KPM may do on its own.</h2>
              <p className="mt-1 text-sm text-[var(--app-muted)]">
                Suggest means KPM prepares it and waits for you. Automatic means KPM does it when there is data to act on.
              </p>
            </div>

            <div className="space-y-3">
              {AUTOMATION_DEFS.map((def) => (
                <div key={def.id} className="rounded-[var(--app-radius)] border border-[var(--app-border)] p-4">
                  <div className="text-[15px] font-bold text-[var(--app-ink)]">{def.name}</div>
                  <p className="mt-1 text-[13px] text-[var(--app-muted)]">{def.blurb}</p>
                  <div className="mt-3 inline-flex rounded-full border border-[var(--app-border)] bg-[var(--app-hover)] p-1">
                    {(["off", "suggest", "automatic"] as AutomationMode[]).map((mode) => {
                      const active = (automations[def.id] || "off") === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setAutomations((prev) => ({ ...prev, [def.id]: mode }))}
                          className={`rounded-full px-3 py-1.5 text-[12px] font-semibold capitalize transition-colors duration-[250ms] ${
                            active ? "bg-[var(--app-nav-active-bg)] text-[var(--app-nav-active)]" : "text-[var(--app-muted)] hover:text-[var(--app-ink)]"
                          }`}
                        >
                          {modeLabel(mode)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={onContinueAi}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--app-nav-active-bg)] px-6 text-sm font-semibold text-[var(--app-nav-active)] hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Review setup"}
              </button>
              <button
                type="button"
                onClick={() => setStep("connections")}
                className="inline-flex items-center gap-1 text-sm font-medium text-[var(--app-muted)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back
              </button>
            </div>
          </section>
        )}

        {step === "review" && (
          <section className="rounded-[var(--app-radius)] border border-[var(--app-border)] bg-[var(--app-surface)] p-6 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-[var(--app-ink)]">You are ready.</h2>
              <p className="mt-1 text-sm text-[var(--app-muted)]">Here is what KPM will do. Nothing here is locked.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-[var(--app-border)] p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--app-faint)]">Company</div>
                <p className="mt-2 text-sm font-semibold text-[var(--app-ink)]">{companyName || "—"}</p>
                <p className="text-[13px] text-[var(--app-muted)]">{businessType}</p>
                <p className="text-[13px] text-[var(--app-muted)]">{currency}</p>
              </div>
              <div className="rounded-xl border border-[var(--app-border)] p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--app-faint)]">Connections</div>
                <ul className="mt-2 space-y-1 text-[13px] text-[var(--app-muted)]">
                  <li>KPM books</li>
                  {savedOutside.length === 0 ? (
                    <li>No outside tools yet</li>
                  ) : (
                    savedOutside.map((item) => {
                      const name = CONNECTORS.find((c) => c.id === item.provider_id)?.name || item.provider_id;
                      return <li key={item.provider_id}>{name}</li>;
                    })
                  )}
                </ul>
              </div>
              <div className="rounded-xl border border-[var(--app-border)] p-4">
                <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--app-faint)]">AI</div>
                <ul className="mt-2 space-y-1 text-[13px] text-[var(--app-muted)]">
                  {AUTOMATION_DEFS.filter((def) => (automations[def.id] || "off") !== "off").map((def) => (
                    <li key={def.id}>
                      {def.name}: {modeLabel(automations[def.id])}
                    </li>
                  ))}
                  {AUTOMATION_DEFS.every((def) => (automations[def.id] || "off") === "off") && (
                    <li>All AI actions are off</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={onFinish}
                className="inline-flex h-11 items-center justify-center rounded-full bg-[var(--app-nav-active-bg)] px-6 text-sm font-semibold text-[var(--app-nav-active)] hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Finishing…" : "Go to dashboard"}
              </button>
              <button
                type="button"
                onClick={() => setStep("company")}
                className="text-sm font-semibold text-[var(--app-muted)] hover:text-[var(--app-ink)]"
              >
                Edit a step
              </button>
            </div>
          </section>
        )}
      </div>

      {activeConnector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[var(--app-ink)]">Connect {activeConnector.name}</h3>
                <p className="mt-1 text-sm text-[var(--app-muted)]">
                  Paste the key from the tool’s settings. We store it locked, and we never show it again.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveConnector(null)}
                className="rounded-lg p-1 text-[var(--app-faint)] hover:text-[var(--app-ink)]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activeConnector.oauthStyle && (
              <div className="mt-3 space-y-2">
                {activeConnector.id === "shopify" && (
                  <input
                    value={shopName}
                    onChange={(event) => setShopName(event.target.value)}
                    placeholder="your-store"
                    className="w-full rounded-xl border border-[var(--app-border)] px-3 py-2 text-sm"
                  />
                )}
                <button
                  type="button"
                  className="inline-flex h-10 items-center rounded-full bg-[#0F172A] px-4 text-sm font-semibold text-white"
                  onClick={() => {
                    void (async () => {
                      const { startConnectorOAuth } = await import("@/lib/api");
                      const url = await startConnectorOAuth(
                        activeConnector.id,
                        activeConnector.id === "shopify" ? shopName : undefined,
                      ).catch(() => null);
                      if (!url) {
                        setOauthNote("A sign-in window for this tool is not available yet. You can paste a key, or skip and connect later.");
                        return;
                      }
                      window.location.href = url;
                    })();
                  }}
                >
                  Sign in with {activeConnector.name}
                </button>
                {oauthNote && (
                  <p className="rounded-xl bg-[var(--app-hover)] px-3 py-2 text-[12px] text-[var(--app-muted)]">{oauthNote}</p>
                )}
              </div>
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
                      className="w-full rounded-xl border border-[var(--app-border)] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
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
                className="inline-flex h-10 flex-1 items-center justify-center rounded-full bg-[var(--app-nav-active-bg)] text-sm font-semibold text-[var(--app-nav-active)] hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save connection"}
              </button>
              <button
                type="button"
                onClick={() => setActiveConnector(null)}
                className="inline-flex h-10 items-center justify-center rounded-full border border-[var(--app-border)] px-4 text-sm font-semibold text-[var(--app-muted)]"
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
