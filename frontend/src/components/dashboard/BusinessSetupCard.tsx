"use client";

import { useEffect, useState } from "react";
import { accountingStore } from "@/lib/accountingStore";
import { authStore } from "@/lib/authStore";
import {
  saveOnboardingProfile,
  type BusinessTypeOption,
  type OnboardingProfile,
  type OnboardingState,
  type TaxModeOption,
  type TeamSizeOption,
} from "@/lib/api";
import { COUNTRIES, CURRENCIES } from "@/lib/onboardingCatalog";

const BUSINESS_TYPES: BusinessTypeOption[] = ["Retail", "Wholesale", "Manufacturing"];
const TEAM_SIZES: TeamSizeOption[] = ["Just me", "2-10", "11-50", "51+"];

function asBusinessType(value: string | null | undefined): BusinessTypeOption {
  if (value === "Wholesale" || value === "Manufacturing" || value === "Retail") return value;
  return "Retail";
}

function asTeamSize(value: string | null | undefined): TeamSizeOption {
  if (value === "2-10" || value === "11-50" || value === "51+" || value === "Just me") return value;
  return "Just me";
}

function asTaxMode(value: string | null | undefined): TaxModeOption {
  if (value === "included" || value === "added_at_sale") return value;
  return "added_at_sale";
}

const fieldClass =
  "mt-1.5 h-9 w-full rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 text-[13px] text-[var(--app-ink)] outline-none focus:border-[#171c28]";

export function businessIsSet(profile: OnboardingProfile | null | undefined) {
  return Boolean(profile?.company_name.trim()) && profile?.current_step !== "company";
}

export function BusinessSetupCard({
  profile,
  fallbackName,
  fallbackType,
  editing,
  onEditing,
  onSaved,
  plain = false,
  formId,
  showActions = true,
  onBusy,
}: {
  profile: OnboardingProfile | null;
  fallbackName: string;
  fallbackType: string;
  editing: boolean;
  onEditing: (value: boolean) => void;
  onSaved: (state: OnboardingState) => void;
  plain?: boolean;
  formId?: string;
  showActions?: boolean;
  onBusy?: (busy: boolean) => void;
}) {
  const [companyName, setCompanyName] = useState(fallbackName);
  const [businessType, setBusinessType] = useState<BusinessTypeOption>(asBusinessType(fallbackType));
  const [teamSize, setTeamSize] = useState<TeamSizeOption>("Just me");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [taxMode, setTaxMode] = useState<TaxModeOption>("added_at_sale");
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile || hydrated) return;
    setCompanyName(profile.company_name || fallbackName);
    setBusinessType(asBusinessType(profile.business_type || fallbackType));
    setTeamSize(asTeamSize(profile.team_size));
    setCountry(profile.country || "");
    setCurrency(profile.currency || "USD");
    setTaxMode(asTaxMode(profile.tax_mode));
    setHydrated(true);
  }, [profile, hydrated, fallbackName, fallbackType]);

  const set = businessIsSet(profile);
  const showForm = plain || !set || editing;

  const onSave = async () => {
    if (!companyName.trim()) {
      setError("Enter the business name.");
      return;
    }
    setSaving(true);
    onBusy?.(true);
    setError(null);
    try {
      const current = profile?.current_step;
      const next = await saveOnboardingProfile({
        company_name: companyName.trim(),
        business_type: businessType,
        team_size: teamSize,
        country,
        currency,
        tax_mode: taxMode,
        current_step: !current || current === "company" ? "connections" : current,
      });
      const user = authStore.getState().user;
      if (user) {
        authStore.updateUser({
          ...user,
          organization: next.profile.company_name,
          business_type: next.profile.business_type,
        });
      }
      accountingStore.updateProfile({ organization: next.profile.company_name });
      onSaved(next);
      setSaved(true);
      onEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this business.");
    } finally {
      setSaving(false);
      onBusy?.(false);
    }
  };

  return (
    <section id={plain ? undefined : "get-started"} className={plain ? "" : "kpm-card px-4 py-4 sm:px-5"}>
      {plain ? null : (
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-[var(--app-ink)]">Get Started</h2>
          <p className="mt-1 max-w-xl text-[12.5px] leading-5 text-[var(--app-muted)]">
            {set && !showForm
              ? `${profile?.company_name} is the business on this workspace.`
              : "Set your business. The name, type, and currency stay with this workspace."}
          </p>
        </div>
        {set && !showForm ? (
          <button
            type="button"
            onClick={() => onEditing(true)}
            className="inline-flex h-9 items-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 text-[13px] font-medium text-[var(--app-ink)] hover:bg-[var(--app-hover)]"
          >
            Edit business
          </button>
        ) : null}
      </div>
      )}

      {saved && !showForm ? (
        <p className="mt-3 text-[12.5px] font-medium text-[var(--app-ink)]">Business saved.</p>
      ) : null}

      {showForm ? (
        <form
          id={formId}
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave();
          }}
        >
          <label className="block text-[12.5px] font-medium text-[var(--app-ink)] sm:col-span-2">
            Business name
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              className={fieldClass}
              required
              autoComplete="organization"
            />
          </label>
          <label className="block text-[12.5px] font-medium text-[var(--app-ink)]">
            Business type
            <select
              value={businessType}
              onChange={(event) => setBusinessType(asBusinessType(event.target.value))}
              className={fieldClass}
            >
              {BUSINESS_TYPES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12.5px] font-medium text-[var(--app-ink)]">
            Team size
            <select value={teamSize} onChange={(event) => setTeamSize(asTeamSize(event.target.value))} className={fieldClass}>
              {TEAM_SIZES.map((item) => (
                <option key={item} value={item}>
                  {item === "2-10" ? "2–10" : item === "11-50" ? "11–50" : item}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12.5px] font-medium text-[var(--app-ink)]">
            Country
            <select value={country} onChange={(event) => setCountry(event.target.value)} className={fieldClass}>
              <option value="">Select a country</option>
              {COUNTRIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[12.5px] font-medium text-[var(--app-ink)]">
            Currency
            <select value={currency} onChange={(event) => setCurrency(event.target.value)} className={fieldClass}>
              {CURRENCIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="text-[12.5px] sm:col-span-2">
            <legend className="font-medium text-[var(--app-ink)]">Tax</legend>
            <div className="mt-2 flex flex-wrap gap-4 text-[var(--app-muted)]">
              <label className="inline-flex items-center gap-2">
                <input type="radio" name="dashboard-tax" checked={taxMode === "included"} onChange={() => setTaxMode("included")} />
                Prices include tax
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="dashboard-tax"
                  checked={taxMode === "added_at_sale"}
                  onChange={() => setTaxMode("added_at_sale")}
                />
                Tax is added at sale
              </label>
            </div>
          </fieldset>
          {error ? <p className="text-[12.5px] text-[var(--app-critical)] sm:col-span-2">{error}</p> : null}
          <div className="flex items-center gap-2 sm:col-span-2">
            {showActions ? (
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-9 items-center rounded-lg bg-[var(--app-nav-active-bg)] px-3.5 text-[13px] font-medium text-[var(--app-nav-active)] hover:opacity-90 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Save business"}
              </button>
            ) : null}
            {set && showActions ? (
              <button
                type="button"
                onClick={() => onEditing(false)}
                className="inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-medium text-[var(--app-muted)] hover:text-[var(--app-ink)]"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </section>
  );
}
