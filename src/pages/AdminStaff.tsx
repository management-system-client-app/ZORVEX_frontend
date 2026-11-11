import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api } from "../api";
import { money } from "../format";
import { useAuth } from "../state";
import type { ProductCardData, StaffAccount } from "../types";

type StaffMeta = {
  total: number;
  activeCount: number;
  limit: number;
  remaining: number;
};

const EMPTY_META: StaffMeta = { total: 0, activeCount: 0, limit: 20, remaining: 20 };
const fieldClass = "mt-1.5 h-11 w-full rounded-xl border border-slate-600 bg-[#171c24] px-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15";

function messageOf(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

function dateLabel(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function AdminStaff() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffAccount[]>([]);
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [meta, setMeta] = useState(EMPTY_META);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyStaffId, setBusyStaffId] = useState("");
  const [contactDrafts, setContactDrafts] = useState<Record<string, string>>({});
  const [copiedStaffId, setCopiedStaffId] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    whatsappNumber: "",
    temporaryPassword: "",
  });

  const loadStaff = useCallback(async () => {
    setError("");
    try {
      const result = await api.staff(true);
      setStaff(result.items);
      setMeta(result.meta);
    } catch (reason) {
      setError(messageOf(reason, "Could not load staff accounts"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  useEffect(() => {
    let active = true;
    api.products({ page: 1, limit: 100, status: "ACTIVE" })
      .then((result) => {
        if (!active) return;
        setProducts(result.items);
        setSelectedProductId((current) => current || result.items[0]?.id || "");
      })
      .catch((reason) => {
        if (active) setError(messageOf(reason, "Could not load products for staff links"));
      });

    return () => {
      active = false;
    };
  }, []);

  const createStaff = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.createStaff({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        whatsappNumber: form.whatsappNumber.trim(),
        temporaryPassword: form.temporaryPassword,
      });
      setForm({ firstName: "", lastName: "", email: "", whatsappNumber: "", temporaryPassword: "" });
      await loadStaff();
    } catch (reason) {
      setError(messageOf(reason, "Could not create staff account"));
    } finally {
      setSaving(false);
    }
  };

  const saveStaffContact = async (account: StaffAccount) => {
    setError("");
    setBusyStaffId(account.id);
    try {
      const whatsappNumber = (contactDrafts[account.id] ?? account.whatsappNumber ?? "").trim();
      await api.updateStaffContact(account.id, whatsappNumber);
      await loadStaff();
    } catch (reason) {
      setError(messageOf(reason, "Could not update staff WhatsApp number"));
    } finally {
      setBusyStaffId("");
    }
  };

  const copyReferralLink = async (account: StaffAccount) => {
    setError("");
    const product = products.find((item) => item.id === selectedProductId);
    if (!product) {
      setError("Select a product before copying a staff sales link");
      return;
    }

    try {
      const link = new URL(
        `/product/${encodeURIComponent(product.id)}`,
        window.location.origin,
      );
      link.searchParams.set("ref", account.id);
      await navigator.clipboard.writeText(link.toString());
      setCopiedStaffId(account.id);
      window.setTimeout(() => setCopiedStaffId(""), 1800);
    } catch (reason) {
      setError(messageOf(reason, "Could not copy the staff referral link"));
    }
  };

  const toggleStaffStatus = async (account: StaffAccount) => {
    setError("");
    setBusyStaffId(account.id);
    try {
      await api.updateStaffStatus(account.id, !account.isActive);
      await loadStaff();
    } catch (reason) {
      setError(messageOf(reason, "Could not update staff account"));
    } finally {
      setBusyStaffId("");
    }
  };

  if (user?.adminRole !== "SUPER_ADMIN") {
    return (
      <section className="rounded-2xl border border-rose-700/40 bg-rose-950/20 p-5 text-sm text-rose-200" role="alert">
        Only the store owner can manage staff accounts.
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-orange-400 bg-[#171c24] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-orange-800/60 bg-orange-950/30 text-orange-200">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7-3h6m-3-3v6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-300">Store access</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Staff accounts</h1>
            <p className="mt-0.5 text-xs text-slate-400">Create and manage your store team</p>
          </div>
        </div>
        <div className="rounded-xl border border-slate-700 bg-[#202630] px-4 py-2.5 text-right">
          <p className="text-lg font-semibold text-slate-100">{meta.activeCount}<span className="text-slate-500"> / {meta.limit}</span></p>
          <p className="text-[10px] uppercase tracking-wider text-slate-400">Active staff</p>
        </div>
      </header>

      {error ? (
        <p className="rounded-xl border border-rose-700/40 bg-rose-950/20 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
        <section className="overflow-hidden rounded-2xl border border-slate-700 bg-[#202630] shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Your team</h2>
              <p className="mt-1 text-xs text-slate-400">Staff sign in through the admin login page.</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-[10px] font-medium text-slate-400">
                Product for sales link
                <select
                  className={`${fieldClass} min-w-[190px]`}
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                >
                  <option value="">Select a product</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => void loadStaff()} disabled={loading} className="h-11 rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:border-orange-600 hover:text-orange-200 disabled:opacity-50">
                Refresh
              </button>
            </div>
          </div>
          {loading ? (
            <div className="space-y-3 p-5" aria-label="Loading staff accounts">
              {[0, 1, 2].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-700/40" />)}
            </div>
          ) : staff.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-sm font-medium text-slate-200">No staff accounts yet</p>
              <p className="mt-1 text-xs text-slate-400">Create an account to invite someone to your store team.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-700/80">
              {staff.map((account) => (
                <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-600 bg-[#171c24] text-sm font-semibold text-orange-200">
                      {account.firstName.slice(0, 1).toUpperCase()}{account.lastName.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-100">{account.firstName} {account.lastName}</span>
                      <span className="mt-0.5 block truncate text-xs text-slate-400">{account.email}</span>
                      <span className="mt-1 block text-[10px] text-slate-500">WhatsApp: {account.whatsappNumber || "Not set"}</span>
                      <span className="mt-1 block text-[10px] text-emerald-300">
                        Commission due: {money(account.commissionDue ?? 0)} · paid: {money(account.commissionPaid ?? 0)}
                      </span>
                      <span className="mt-1 block text-[10px] text-slate-500">Last login: {dateLabel(account.lastLoginAt)}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${account.isActive ? "border-emerald-700/50 bg-emerald-950/30 text-emerald-200" : "border-slate-600 bg-slate-800 text-slate-400"}`}>
                      {account.isActive ? "Active" : "Disabled"}
                    </span>
                    <button
                      type="button"
                      disabled={busyStaffId === account.id}
                      onClick={() => void toggleStaffStatus(account)}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${account.isActive ? "border-rose-800/50 text-rose-200 hover:bg-rose-950/40" : "border-emerald-800/50 text-emerald-200 hover:bg-emerald-950/40"}`}
                    >
                      {busyStaffId === account.id ? "Saving…" : account.isActive ? "Disable" : "Enable"}
                    </button>
                  </div>
                  <div className="flex w-full flex-wrap items-end gap-2 pl-[52px]">
                    <label className="min-w-[220px] flex-1 text-[10px] font-medium text-slate-400">
                      WhatsApp number
                      <input
                        type="tel"
                        autoComplete="tel"
                        placeholder="+8801XXXXXXXXX"
                        className={fieldClass}
                        value={contactDrafts[account.id] ?? account.whatsappNumber ?? ""}
                        onChange={(event) => setContactDrafts((current) => ({ ...current, [account.id]: event.target.value }))}
                      />
                    </label>
                    <button
                      type="button"
                      disabled={busyStaffId === account.id}
                      onClick={() => void saveStaffContact(account)}
                      className="h-11 rounded-xl border border-sky-700/50 px-3 text-xs font-semibold text-sky-200 transition-colors hover:bg-sky-950/30 disabled:opacity-50"
                    >
                      Save contact
                    </button>
                    <button
                      type="button"
                      disabled={!account.isActive}
                      onClick={() => void copyReferralLink(account)}
                      className="h-11 rounded-xl border border-orange-700/50 px-3 text-xs font-semibold text-orange-200 transition-colors hover:bg-orange-950/30 disabled:opacity-50"
                    >
                      {copiedStaffId === account.id ? "Link copied" : "Copy sales link"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <form onSubmit={createStaff} className="space-y-4 rounded-2xl border border-slate-700 border-t-2 border-t-orange-500 bg-[#202630] p-5 shadow-sm">
          <div className="border-b border-slate-700 pb-4">
            <h2 className="text-sm font-semibold text-slate-100">Add a staff member</h2>
            <p className="mt-1 text-xs text-slate-400">{meta.remaining} active account slot{meta.remaining === 1 ? "" : "s"} available</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-300">
              First name
              <input required maxLength={80} autoComplete="given-name" className={fieldClass} value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
            </label>
            <label className="text-xs font-medium text-slate-300">
              Last name
              <input required maxLength={80} autoComplete="family-name" className={fieldClass} value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-300">
            Email
            <input required type="email" autoComplete="email" className={fieldClass} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label className="block text-xs font-medium text-slate-300">
            WhatsApp number
            <input required type="tel" autoComplete="tel" placeholder="+8801XXXXXXXXX" className={fieldClass} value={form.whatsappNumber} onChange={(event) => setForm((current) => ({ ...current, whatsappNumber: event.target.value }))} />
          </label>
          <label className="block text-xs font-medium text-slate-300">
            Temporary password
            <input required type="password" minLength={8} maxLength={72} autoComplete="new-password" className={fieldClass} value={form.temporaryPassword} onChange={(event) => setForm((current) => ({ ...current, temporaryPassword: event.target.value }))} />
          </label>
          <p className="rounded-lg border border-amber-800/40 bg-amber-950/20 px-3 py-2.5 text-xs leading-relaxed text-amber-100/80">
            Share the temporary password securely. Staff can sign in at the admin login page. Their sales link records referred orders, and customers can contact them on this WhatsApp number.
          </p>
          <button type="submit" disabled={saving || meta.remaining === 0} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-orange-500 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50">
            {saving ? "Creating account…" : "Create staff account"}
          </button>
        </form>
      </div>
    </div>
  );
}
