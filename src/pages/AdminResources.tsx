import { FormEvent, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, api } from "../api";
import { RowsSkeleton } from "../components/Skeleton";
import { money, titleCaseStatus } from "../format";
import { useAuth, useStore } from "../state";
import type { Catalog, Category, CmsPage, Color, Coupon, DeliveryZone, ManualPayment, Outlet, ProductCardData, Promotion, Settings, SizeGuide, StoreReturn, Subscriber, VariantRow } from "../types";

const field = "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#2ec9a8]";

function messageOf(reason: unknown, fallback: string) {
  if (!(reason instanceof ApiError)) return fallback;
  const details = reason.errors
    ?.map((issue) => `${issue.path}: ${issue.message}`)
    .join("; ");
  return details ? `${reason.message}. ${details}` : reason.message;
}

async function ensureGenericVariantDimensions() {
  const [sizes, fabrics] = await Promise.all([api.sizes(), api.fabrics()]);
  let size = sizes.find((item) => item.slug === "one-size");
  if (!size) {
    try {
      size = await api.createSize({ name: "One Size", slug: "one-size" });
    } catch (reason) {
      if (!(reason instanceof ApiError) || reason.status !== 409) throw reason;
      size = (await api.sizes({ fresh: true })).find((item) => item.slug === "one-size");
      if (!size) throw reason;
    }
  }

  let fabric = fabrics.find((item) => item.slug === "not-applicable");
  if (!fabric) {
    try {
      fabric = await api.createFabric({ name: "Not Applicable", slug: "not-applicable" });
    } catch (reason) {
      if (!(reason instanceof ApiError) || reason.status !== 409) throw reason;
      fabric = (await api.fabrics({ fresh: true })).find((item) => item.slug === "not-applicable");
      if (!fabric) throw reason;
    }
  }

  return { sizeId: size.id, fabricId: fabric.id };
}

function later(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function Panel({ title, error, children }: { title: string; error: string; children: ReactNode }) {
  return (
    <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      {children}
      {error ? <p className="text-sm text-rose-700 lg:col-span-2">{error}</p> : null}
      <span className="sr-only">{title}</span>
    </div>
  );
}
export function AdminCoupons() {
  const [items, setItems] = useState<Coupon[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [type, setType] = useState("PERCENTAGE");
  const [value, setValue] = useState("10");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    api.coupons().then(setItems).catch((reason) => setError(messageOf(reason, "Could not load coupons"))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const now = Date.now();
  const liveCount = items.filter((item) => item.isActive && new Date(item.startsAt).getTime() <= now && new Date(item.endsAt).getTime() > now).length;
  const editingCoupon = items.find((item) => item.id === editing);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = editing
        ? { type, value: Number(value) }
        : { code, type, value: Number(value), startsAt: new Date().toISOString(), endsAt: later(30) };
      await api.saveCoupon(body, editing ?? undefined);
      setEditing(null);
      setCode("");
      load();
    } catch (reason) {
      setError(messageOf(reason, "Could not save the coupon"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-amber-400 bg-[#171c24] p-5 shadow-sm">
        <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl border border-amber-700/60 bg-amber-950/35 text-amber-300"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 8h16v8H4zM8 8v2m8-2v2m-8 4v2m8-2v2M4 12h16" strokeLinecap="round" strokeLinejoin="round" /></svg></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300">Discount tools</p><h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Coupons</h1><p className="mt-0.5 text-xs text-slate-400">Create and manage checkout discount codes</p></div></div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#202630] px-3 py-1.5 text-xs text-slate-300"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 8h16v12H4zM7 8V5h10v3M8 12h8M8 16h5" strokeLinecap="round" strokeLinejoin="round" /></svg>{loading ? "Loading…" : `${items.length} total`}</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/25 px-3 py-1.5 text-xs text-emerald-200"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 12.5 9.5 17 19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>{liveCount} live</span>
        </div>
      </header>
      {error ? <p className="rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-700 border-t-2 border-t-amber-500 bg-[#202630] p-5 shadow-sm lg:sticky lg:top-4 lg:self-start">
          <div className="flex items-center gap-3 border-b border-slate-700 pb-4"><span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-700/60 bg-amber-950/35 text-xs font-semibold text-amber-300">01</span><div><h2 className="text-sm font-semibold text-slate-100">{editing ? "Edit coupon" : "Create coupon"}</h2><p className="text-xs text-slate-400">Set a code and discount value</p></div></div>
          {editing ? <div className="rounded-xl border border-amber-800/50 bg-[#171c24] px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Coupon code</p><p className="mt-0.5 font-mono text-sm font-semibold tracking-wider text-amber-200">{editingCoupon?.code}</p></div> : <label className="block text-xs font-medium text-slate-300">Coupon code<input className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm font-mono uppercase tracking-wider text-white outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-500 focus:border-amber-400" required minLength={3} placeholder="e.g. WELCOME10" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /></label>}
          <label className="block text-xs font-medium text-slate-300">Discount type<select className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none focus:border-amber-400" value={type} onChange={(event) => setType(event.target.value)}><option value="PERCENTAGE">Percentage</option><option value="FIXED_AMOUNT">Fixed amount</option></select></label>
          <label className="block text-xs font-medium text-slate-300">Discount value<div className="relative mt-1.5"><input className="h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 pr-12 text-sm text-white outline-none focus:border-amber-400" required inputMode="decimal" placeholder="10" value={value} onChange={(event) => setValue(event.target.value)} /><span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-amber-300">{type === "PERCENTAGE" ? "%" : "৳"}</span></div></label>
          <div className="flex items-center justify-between rounded-lg border border-amber-800/40 bg-gradient-to-r from-amber-950/45 via-[#171c24] to-[#171c24] px-3 py-2"><span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-300/70">Preview</span><span className="truncate text-xs font-medium text-slate-100">{editingCoupon?.code ?? (code.trim() || "COUPON")}</span><span className="rounded-md border border-amber-500/40 bg-gradient-to-br from-amber-500/30 to-amber-900/40 px-2 py-1 text-xs font-semibold text-amber-100">{value || "0"}{type === "PERCENTAGE" ? "% off" : " off"}</span></div>
          {editing ? <button type="button" className="w-full rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-700/40" onClick={() => { setEditing(null); setCode(""); setType("PERCENTAGE"); setValue("10"); }}>Cancel edit</button> : null}
          <button disabled={busy} className="w-full rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-wait disabled:opacity-50">{busy ? "Saving…" : editing ? "Save changes" : "Create coupon"}</button>
        </form>
        <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-amber-500 bg-[#202630] shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-5 py-4"><div><h2 className="text-sm font-semibold text-slate-100">Coupon book</h2><p className="text-xs text-slate-400">Codes and discount rules</p></div><span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-[#171c24] px-2.5 py-1 text-xs text-slate-300"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 8h16v8H4zM8 8v2m8-2v2m-8 4v2m8-2v2M4 12h16" strokeLinecap="round" strokeLinejoin="round" /></svg>{items.length} codes</span></div>
          {loading ? <div className="p-5"><RowsSkeleton rows={5} columns={2} /></div> : items.length === 0 ? <div className="px-5 py-12 text-center"><p className="text-sm font-medium text-slate-200">No coupons yet</p><p className="mt-1 text-xs text-slate-400">Create a coupon to offer a checkout discount.</p></div> : (
            <ul className="space-y-1 px-4 py-3">{items.map((item) => {
              const isLive = item.isActive && new Date(item.startsAt).getTime() <= now && new Date(item.endsAt).getTime() > now;
              const isExpired = new Date(item.endsAt).getTime() <= now;
              return <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-transparent px-3 py-3.5 transition-colors duration-200 hover:border-amber-700/40 hover:bg-amber-950/15">
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold tracking-wider text-amber-200">{item.code}</span><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${isLive ? "border-emerald-800/60 bg-emerald-950/25 text-emerald-200" : isExpired || !item.isActive ? "border-slate-600 bg-[#171c24] text-slate-400" : "border-amber-800/60 bg-amber-950/25 text-amber-200"}`}>{isLive ? "Live" : isExpired ? "Expired" : item.isActive ? "Scheduled" : "Inactive"}</span></div><p className="mt-1 text-xs text-slate-400">{item.type === "PERCENTAGE" ? `${item.value}% discount` : `${item.value} fixed discount`} · Ends {new Date(item.endsAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p></div>
                <span className="rounded-lg border border-amber-800/50 bg-amber-950/30 px-2.5 py-1 text-xs font-semibold text-amber-200">{item.type === "PERCENTAGE" ? `${item.value}%` : money(item.value)}</span>
                <div className="flex items-center gap-2"><button type="button" aria-label={`Edit ${item.code}`} title={`Edit ${item.code}`} className="grid h-9 w-9 place-items-center rounded-lg border border-slate-600 bg-[#202630] text-slate-300 transition-colors hover:border-amber-700 hover:bg-amber-950/40 hover:text-amber-200" onClick={async () => { try { const coupon = await api.coupon(item.id); setEditing(coupon.id); setType(coupon.type); setValue(String(coupon.value)); setError(""); } catch (reason) { setError(messageOf(reason, "Could not load coupon")); } }}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m15 5 4 4M4 20l4.5-1 10.2-10.2a2.1 2.1 0 0 0-3-3L5.5 16 4 20z" strokeLinecap="round" strokeLinejoin="round" /></svg></button><button type="button" aria-label={`Delete ${item.code}`} title={`Delete ${item.code}`} className="grid h-9 w-9 place-items-center rounded-lg border border-rose-400/30 bg-rose-500/10 text-rose-300 transition-colors hover:border-rose-700 hover:bg-rose-700 hover:text-white" onClick={async () => { if (!window.confirm(`Delete coupon ${item.code}?`)) return; try { await api.deleteCoupon(item.id); if (editing === item.id) setEditing(null); load(); } catch (reason) { setError(messageOf(reason, "Could not delete coupon")); } }}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" /></svg></button></div>
              </li>;
            })}</ul>
          )}
        </section>
      </div>
    </div>
  );
}

export function AdminPromotions() {
  const [items, setItems] = useState<Promotion[]>([]);
  const [name, setName] = useState("");
  const [type, setType] = useState("PERCENTAGE");
  const [value, setValue] = useState("10");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.adminPromotions().then(setItems).catch((reason) => setError(messageOf(reason, "Could not load promotions"))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const activeCount = items.filter((item) => item.isActive !== false).length;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api.savePromotion({ name, type, value: Number(value), startsAt: new Date().toISOString(), endsAt: later(30) });
      setName("");
      load();
    } catch (reason) {
      setError(messageOf(reason, "Could not save the promotion"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-amber-500/60 bg-[#171c24] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-amber-700/50 bg-amber-950/25 text-amber-200"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300">Campaign tools</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Promotions</h1>
            <p className="mt-0.5 text-xs text-slate-400">Create and control store-wide discount campaigns</p>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#202630] px-3 py-1.5 text-xs text-slate-300"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8M8 13h8M8 17h4" strokeLinecap="round" strokeLinejoin="round" /></svg>{loading ? "Loading…" : `${items.length} total`}</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/25 px-3 py-1.5 text-xs text-emerald-200"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 12.5 9.5 17 19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>{activeCount} active</span>
        </div>
      </header>
      {error ? <p className="rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-700 border-t-2 border-t-amber-500/60 bg-[#202630] p-5 shadow-sm lg:sticky lg:top-4 lg:self-start">
          <div className="flex items-center gap-3 border-b border-slate-700 pb-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-700/50 bg-amber-950/25 text-xs font-semibold text-amber-200">01</span>
            <div><h2 className="text-sm font-semibold text-slate-100">Create promotion</h2><p className="text-xs text-slate-400">Define a discount campaign</p></div>
          </div>
          <label className="block text-xs font-medium text-slate-300">Promotion name<input className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" required minLength={2} placeholder="e.g. Weekend offer" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="block text-xs font-medium text-slate-300">Discount type<select className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none focus:border-amber-400" value={type} onChange={(event) => setType(event.target.value)}><option value="PERCENTAGE">Percentage</option><option value="FIXED_AMOUNT">Fixed amount</option></select></label>
          <label className="block text-xs font-medium text-slate-300">Discount value<div className="relative mt-1.5"><input className="h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 pr-12 text-sm text-white outline-none focus:border-amber-400" required inputMode="decimal" placeholder="10" value={value} onChange={(event) => setValue(event.target.value)} /><span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-amber-300">{type === "PERCENTAGE" ? "%" : "৳"}</span></div></label>
          <div className="flex items-center justify-between rounded-lg border border-amber-800/40 bg-gradient-to-r from-amber-950/45 via-[#171c24] to-[#171c24] px-3 py-2"><span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-300/70">Preview</span><span className="truncate text-xs font-medium text-slate-100">{name.trim() || "Promotion name"}</span><span className="rounded-md border border-amber-500/40 bg-gradient-to-br from-amber-500/30 to-amber-900/40 px-2 py-1 text-xs font-semibold text-amber-100">{value || "0"}{type === "PERCENTAGE" ? "% off" : " off"}</span></div>
          <button disabled={busy} className="w-full rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-wait disabled:opacity-50">{busy ? "Saving…" : "Create promotion"}</button>
        </form>
        <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-amber-500/60 bg-[#202630] shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
            <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-700/40 bg-amber-950/25 text-amber-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8M8 13h5" strokeLinecap="round" strokeLinejoin="round" /></svg></span><div><h2 className="text-sm font-semibold text-slate-100">Promotion board</h2><p className="text-xs text-slate-400">Campaign value and availability</p></div></div>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-[#171c24] px-2.5 py-1 text-xs text-slate-300"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8M8 13h5" strokeLinecap="round" strokeLinejoin="round" /></svg>{items.length} campaigns</span>
          </div>
          {loading ? <div className="p-5"><RowsSkeleton rows={5} columns={2} /></div> : items.length === 0 ? <div className="px-5 py-12 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-slate-700 bg-[#171c24] text-amber-200"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 3l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" /></svg></span><p className="mt-3 text-sm font-medium text-slate-200">No promotions yet</p><p className="mt-1 text-xs text-slate-400">Create a campaign to highlight a special discount.</p></div> : (
            <ul className="space-y-1 px-4 py-3">
              {items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-transparent px-3 py-3 transition-colors duration-200 hover:border-amber-700/30 hover:bg-slate-700/20">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-700/40 bg-amber-950/20 text-amber-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 3l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-semibold text-slate-100">{item.name}</span><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${item.isActive === false ? "border-slate-600 bg-[#171c24] text-slate-400" : "border-emerald-800/60 bg-emerald-950/25 text-emerald-200"}`}><span className={`h-1.5 w-1.5 rounded-full ${item.isActive === false ? "bg-slate-500" : "bg-emerald-300"}`} aria-hidden="true" />{item.isActive === false ? "Inactive" : "Active"}</span></div><p className="mt-1 text-xs text-slate-400">{item.description || (item.type === "PERCENTAGE" ? "Percentage discount" : "Fixed amount discount")}</p></div>
                  <span className="rounded-lg border border-amber-700/40 bg-amber-950/20 px-2.5 py-1 text-xs font-semibold text-amber-200">{item.type === "PERCENTAGE" ? `${item.value ?? 0}% off` : item.value != null ? money(item.value) : "Discount"}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" disabled={busyId === item.id} aria-label={item.isActive === false ? `Activate ${item.name}` : `Pause ${item.name}`} title={item.isActive === false ? "Activate" : "Pause"} className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 ${item.isActive === false ? "border-emerald-700/50 bg-emerald-500/10 text-emerald-300 hover:border-emerald-600 hover:bg-emerald-700 hover:text-white focus-visible:ring-emerald-400" : "border-amber-700/50 bg-amber-500/10 text-amber-300 hover:border-amber-600 hover:bg-amber-700 hover:text-white focus-visible:ring-amber-400"}`} onClick={async () => { setBusyId(item.id); setError(""); try { await api.savePromotion({ isActive: item.isActive === false }, item.id); load(); } catch (reason) { setError(messageOf(reason, "Could not update promotion")); } finally { setBusyId(null); } }}>{item.isActive === false ? "Activate" : "Pause"}</button>
                    <button type="button" disabled={busyId === item.id} aria-label={`Delete ${item.name}`} title="Delete promotion" className="grid h-9 w-9 place-items-center rounded-lg border border-rose-400/30 bg-rose-500/10 text-rose-300 transition-colors hover:border-rose-700 hover:bg-rose-700 hover:text-white disabled:opacity-50" onClick={async () => { if (!window.confirm(`Delete promotion ${item.name}?`)) return; setBusyId(item.id); setError(""); try { await api.deletePromotion(item.id); load(); } catch (reason) { setError(messageOf(reason, "Could not delete promotion")); } finally { setBusyId(null); } }}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export function AdminCatalogExtras() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [fabric, setFabric] = useState("");
  const [composition, setComposition] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    Promise.all([api.catalog(), api.brands(), api.sizes(), api.fabrics()])
      .then(([catalog, brands, sizes, fabrics]) => setCatalog({ ...catalog, brands, sizes, fabrics }))
      .catch((reason) => setError(messageOf(reason, "Could not load catalog")))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  const brandCount = catalog?.brands.length ?? 0;
  const sizeCount = catalog?.sizes.length ?? 0;
  const fabricCount = catalog?.fabrics.length ?? 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-teal-500 bg-[#171c24] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-teal-700/60 bg-teal-950/40 text-teal-300"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 5h7v7H4V5zm9 0h7v7h-7V5zM4 14h7v5H4v-5zm9 0h7v5h-7v-5z" /></svg></span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-300">Catalog setup</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Brands & sizes</h1>
            <p className="mt-0.5 text-xs text-slate-400">Manage the attributes used to build your product catalog</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#202630] px-3 py-1.5 text-xs text-slate-300"><span className="grid h-6 w-6 place-items-center rounded-md bg-slate-800"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 7h16v13H4zM8 7V5h8v2M8 12h8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>{brandCount} brands</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#202630] px-3 py-1.5 text-xs text-slate-300"><span className="grid h-6 w-6 place-items-center rounded-md bg-slate-800"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 5h14v14H5zM9 5v14m6-14v14M5 10h14m-14 4h14" strokeLinecap="round" strokeLinejoin="round" /></svg></span>{sizeCount} sizes</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#202630] px-3 py-1.5 text-xs text-slate-300"><span className="grid h-6 w-6 place-items-center rounded-md bg-slate-800"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 5h16v14H4zM4 9h16M9 5v4m6-4v4M8 13h.01M12 13h.01M16 13h.01M8 16h.01M12 16h.01M16 16h.01" strokeLinecap="round" strokeLinejoin="round" /></svg></span>{fabricCount} fabrics</span>
        </div>
      </header>
      {error ? <p className="rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200 lg:col-span-3" role="alert">{error}</p> : null}
      <div className="grid gap-5 lg:grid-cols-3">
      <MiniCreate
        title="Brand"
        value={brand}
        setValue={setBrand}
        onSave={() =>
          api.createBrand({ name: brand.trim() }).then((created) => {
            setCatalog((current) => current && { ...current, brands: [...current.brands, created] });
          })
        }
        rows={(catalog?.brands ?? []).map((item) => item.name)}
        loading={loading}
        isDuplicate={(value) =>
          (catalog?.brands ?? []).some(
            (item) => item.name.trim().toLocaleLowerCase() === value.trim().toLocaleLowerCase(),
          )
        }
      />
      <MiniCreate
        title="Size"
        value={size}
        setValue={setSize}
        onSave={() =>
          api.createSize({ name: size.trim() }).then((created) => {
            setCatalog((current) => current && { ...current, sizes: [...current.sizes, created] });
          })
        }
        rows={(catalog?.sizes ?? []).map((item) => item.name)}
        loading={loading}
        options={["Free Size", "XS", "S", "M", "L", "XL", "XXL", "XXXL"]}
        isDuplicate={(value) =>
          (catalog?.sizes ?? []).some(
            (item) => item.name.trim().toLocaleLowerCase() === value.trim().toLocaleLowerCase(),
          )
        }
      />
      <form
        className="space-y-4 rounded-2xl border border-slate-700 border-t-2 border-t-orange-600 bg-[#202630] p-4 shadow-sm"
        onSubmit={(event) => {
          event.preventDefault();
          const normalizedFabric = fabric.trim().toLocaleLowerCase();
          const duplicateFabric = (catalog?.fabrics ?? []).some(
            (item) => item.name.trim().toLocaleLowerCase() === normalizedFabric,
          );
          if (duplicateFabric) {
            setError("Fabric already exists");
            return;
          }
          setError("");
          api.createFabric({ name: fabric.trim(), composition: composition.trim() || null }).then((created) => {
            setCatalog((current) => current && { ...current, fabrics: [...current.fabrics, created] });
            setFabric("");
            setComposition("");
          }).catch((reason) => setError(messageOf(reason, "Could not add the fabric")));
        }}
      >
        <div className="flex items-center gap-3 border-b border-slate-700 pb-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-orange-800/60 bg-orange-950/25 text-xs font-semibold text-orange-200">03</span>
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-orange-800/50 bg-orange-950/20 text-orange-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 4h16v16H4zM8 4v16m8-16v16M4 9h4m8 0h4M4 15h4m8 0h4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <div><h2 className="text-sm font-semibold text-slate-100">Fabric</h2><p className="text-xs text-slate-400">Add a material and composition</p></div>
        </div>
        <label className="block text-xs font-medium text-slate-300">Fabric name<input className={`${field} mt-1.5 border-slate-600 bg-[#171c24] text-white placeholder:text-slate-500 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20`} required placeholder="e.g. Cotton" value={fabric} onChange={(event) => setFabric(event.target.value)} /></label>
        <label className="block text-xs font-medium text-slate-300">Composition<input className={`${field} mt-1.5 border-slate-600 bg-[#171c24] text-white placeholder:text-slate-500 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/20`} placeholder="e.g. 100% cotton" value={composition} onChange={(event) => setComposition(event.target.value)} /></label>
        <div className="flex items-center gap-3 rounded-xl border border-orange-900/60 bg-gradient-to-r from-orange-950/30 to-[#171c24] p-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-orange-800/50 bg-orange-950/30 text-orange-200"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 4h16v16H4zM8 4v16m8-16v16M4 9h4m8 0h4M4 15h4m8 0h4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-orange-300">Material swatch</p><p className="mt-0.5 truncate text-sm font-semibold text-slate-100">{fabric.trim() || "Fabric name"}</p><p className="mt-0.5 truncate text-xs text-slate-400">{composition.trim() || "Composition details"}</p></div>
        </div>
        {(catalog?.fabrics ?? []).some(
          (item) => item.name.trim().toLocaleLowerCase() === fabric.trim().toLocaleLowerCase() && fabric.trim() !== "",
        ) ? <p className="rounded-lg border border-amber-700/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">Fabric already exists.</p> : null}
        {error ? <p className="rounded-lg border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
        <button
          disabled={loading || (catalog?.fabrics ?? []).some(
            (item) => item.name.trim().toLocaleLowerCase() === fabric.trim().toLocaleLowerCase() && fabric.trim() !== "",
          )}
          className="w-full rounded-xl bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add
        </button>
        {loading ? (
          <RowsSkeleton rows={3} />
        ) : (
          <details className="rounded-xl border border-slate-700 bg-[#171c24] px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-slate-300">
              Existing fabrics ({catalog?.fabrics.length ?? 0})
            </summary>
            {(catalog?.fabrics.length ?? 0) > 0 ? (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto border-t border-slate-700 pt-2 text-sm text-slate-300">
                {catalog?.fabrics.map((item) => <li key={item.id} className="rounded-md px-2 py-1 hover:bg-slate-700/30">{item.name}</li>)}
              </ul>
            ) : (
              <p className="mt-2 border-t border-slate-700 pt-2 text-sm text-slate-400">
                No fabrics added yet.
              </p>
            )}
          </details>
        )}
      </form>
      </div>
    </div>
  );
}

export function AdminColors() {
  const [colors, setColors] = useState<Color[]>([]);
  const [name, setName] = useState("");
  const [hexCode, setHexCode] = useState("#0000FF");
  const [error, setError] = useState("");
  const [permissionRequired, setPermissionRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api.colorList()
      .then((result) => {
        if (active) setColors(result);
      })
      .catch((reason) => {
        if (active) setError(messageOf(reason, "Could not load colors"));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const duplicate = colors.some(
    (color) => color.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase(),
  );

  return (
    <div className="space-y-5">
      <header className="overflow-hidden rounded-2xl border border-slate-700 border-l-2 bg-[#171c24] p-5 shadow-sm" style={{ borderLeftColor: hexCode }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-slate-600 bg-[#202630] p-1.5">
              <span className="h-full w-full rounded-lg" style={{ backgroundColor: hexCode }} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em]" style={{ color: hexCode }}>Palette management</p>
              <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Color studio</h1>
              <p className="mt-0.5 text-xs text-slate-400">Build a reusable palette for product variants</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#202630] px-3 py-1.5 text-xs font-medium text-slate-300">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9h-4a2 2 0 0 1-2-2V8a5 5 0 0 0-3-5zM7 12h.01M10 7h.01M15 7h.01" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {loading ? "Loading colors…" : `${colors.length} saved colors`}
          </span>
        </div>
        <div className="mt-4 flex h-2 overflow-hidden rounded-full bg-[#252b35]" aria-label="Saved color palette preview">
          {colors.length > 0 ? colors.slice(0, 12).map((color) => <span key={color.id} className="min-w-2 flex-1" style={{ backgroundColor: color.hexCode }} title={`${color.name} ${color.hexCode}`} />) : <span className="w-full" style={{ backgroundColor: hexCode }} />}
        </div>
      </header>
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <form
          className="space-y-4 rounded-2xl border border-slate-700 border-t-2 bg-[#202630] p-5 shadow-sm lg:sticky lg:top-4 lg:self-start"
          style={{ borderTopColor: hexCode }}
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            setPermissionRequired(false);
            if (duplicate) {
              setError("A color with this name already exists.");
              return;
            }
            setSaving(true);
            try {
              const created = await api.createColor({ name: name.trim(), hexCode });
              setColors((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
              setName("");
            } catch (reason) {
              setPermissionRequired(reason instanceof ApiError && reason.status === 403);
              setError(messageOf(reason, "Could not add color"));
            } finally {
              setSaving(false);
            }
          }}
        >
          <div className="flex items-center gap-3 border-b border-slate-700 pb-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl border text-xs font-semibold text-white" style={{ borderColor: hexCode, backgroundColor: hexCode }}>01</span>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Add a color</h2>
              <p className="text-xs text-slate-400">Create a reusable product swatch</p>
            </div>
          </div>
          <label className="grid gap-1.5 text-xs font-medium text-slate-300">
            <span>Color name</span>
            <input
              className="h-11 w-full rounded-xl border-2 bg-[#171c24] px-4 text-sm text-white outline-none placeholder:text-slate-500"
              style={{ borderColor: hexCode }}
              required
              minLength={2}
              maxLength={120}
              placeholder="e.g. Ocean blue"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300" htmlFor="admin-color-picker">Choose color</label>
            <div className="flex items-center gap-3 rounded-xl border border-slate-600 bg-[#171c24] p-2.5">
              <input
                id="admin-color-picker"
                className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-slate-600 bg-[#202630] p-1"
                type="color"
                value={hexCode}
                aria-label="Choose color swatch"
                onChange={(event) => setHexCode(event.target.value.toUpperCase())}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-100">{name.trim() || "Color preview"}</p>
                <p className="mt-0.5 font-mono text-xs uppercase text-slate-400">{hexCode}</p>
              </div>
              <span className="h-8 w-8 shrink-0 rounded-full border border-white/20 shadow-inner" style={{ backgroundColor: hexCode }} aria-hidden="true" />
            </div>
          </div>
          {duplicate ? <p className="rounded-lg border border-amber-700/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-200" role="status">A color with this name already exists.</p> : null}
          {error ? (
            permissionRequired ? (
              <div className="flex gap-3 rounded-xl border border-amber-700/50 bg-amber-950/20 p-3 text-amber-100" role="alert">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-amber-700/50 bg-amber-950/40" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M7 10V7a5 5 0 0 1 10 0v3m-12 0h14v11H5V10zm7 4v3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
                <div>
                  <p className="text-sm font-semibold">Admin access required</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-amber-100/80">Sign in with an admin account to add colors. If you already have admin access, sign out and sign in again.</p>
                </div>
              </div>
            ) : <p className="rounded-lg border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200" role="alert">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={loading || saving || duplicate}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition duration-200 hover:brightness-90 hover:shadow-md focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: hexCode }}
          >
            {!saving ? <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 3v10M3 8h10" strokeLinecap="round" /></svg> : null}
            {saving ? "Saving…" : "Add color"}
          </button>
        </form>
        <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 bg-[#202630] shadow-sm" style={{ borderTopColor: hexCode }}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl border text-slate-100" style={{ borderColor: hexCode, backgroundColor: hexCode }}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9h-4a2 2 0 0 1-2-2V8a5 5 0 0 0-3-5zM7 12h.01M10 7h.01M15 7h.01" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Saved colors</h2>
                <p className="mt-0.5 text-xs text-slate-400">Your store’s reusable color palette</p>
              </div>
            </div>
            <span className="rounded-lg border border-slate-600 bg-[#171c24] px-2.5 py-1 text-xs font-medium text-slate-300">{colors.length} total</span>
          </div>
          {loading ? <div className="p-5"><RowsSkeleton rows={4} /></div> : colors.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-slate-700 bg-[#171c24] text-slate-400">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9h-4a2 2 0 0 1-2-2V8a5 5 0 0 0-3-5zM7 12h.01M10 7h.01M15 7h.01" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </span>
              <p className="mt-3 text-sm font-medium text-slate-200">No colors yet</p>
              <p className="mt-1 text-xs text-slate-400">Add a color to start building your palette.</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-700 px-5">
              {colors.map((color) => (
                <li key={color.id} className="flex items-center gap-3 py-3 transition-colors duration-200 hover:bg-slate-700/15">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-600 bg-[#171c24] p-1">
                    <span className="h-full w-full rounded-lg" style={{ backgroundColor: color.hexCode }} aria-label={`${color.name} swatch`} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">{color.name}</span>
                  <span className="rounded-md border border-slate-700 bg-[#171c24] px-2 py-1 font-mono text-[11px] text-slate-300">{color.hexCode.toUpperCase()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function MiniCreate({
  title,
  value,
  setValue,
  onSave,
  rows,
  loading = false,
  options,
  isDuplicate,
}: {
  title: string;
  value: string;
  setValue: (value: string) => void;
  onSave: () => Promise<unknown>;
  rows: string[];
  loading?: boolean;
  options?: string[];
  isDuplicate?: (value: string) => boolean;
}) {
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const duplicate = isDuplicate?.(value) ?? false;
  const isBrand = title === "Brand";
  const isSize = title === "Size";
  return (
    <form
      className={`space-y-4 rounded-2xl border border-slate-700 border-t-2 ${isBrand ? "border-t-cyan-500" : "border-t-blue-500"} bg-[#202630] p-4 shadow-sm lg:sticky lg:top-4 lg:self-start`}
      onSubmit={async (event) => {
        event.preventDefault();
        if (submittingRef.current) return;
        setError("");
        if (duplicate) {
          setError(`${title} already exists`);
          return;
        }
        submittingRef.current = true;
        setSubmitting(true);
        try {
          await onSave();
          setValue("");
        } catch (reason) {
          setError(messageOf(reason, "Could not save"));
        } finally {
          submittingRef.current = false;
          setSubmitting(false);
        }
      }}
    >
      <div className="flex items-center gap-3 border-b border-slate-700 pb-3">
        <span className={`grid h-9 w-9 place-items-center rounded-xl border text-xs font-semibold ${isBrand ? "border-cyan-800/60 bg-cyan-950/25 text-cyan-200" : "border-blue-800/60 bg-blue-950/25 text-blue-200"}`}>{title === "Brand" ? "01" : "02"}</span>
        <span className={`grid h-9 w-9 place-items-center rounded-xl border border-slate-700 bg-[#171c24] ${isBrand ? "text-cyan-200" : "text-blue-200"}`}>
          {title === "Brand" ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8M8 13h5m7-8v14" strokeLinecap="round" strokeLinejoin="round" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h16M8 3v4m8 3v4m-5 3v4" strokeLinecap="round" /></svg>
          )}
        </span>
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          <p className="text-xs text-slate-400">{isBrand ? "Add a product label" : "Set the available size scale"}</p>
        </div>
      </div>
      {options ? (
        <select className={`${field} border-slate-600 bg-[#171c24] text-white focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20`} required value={value} onChange={(event) => setValue(event.target.value)}>
          <option value="">Choose size</option>
          {options.map((option) => (
            <option key={option} value={option} disabled={isDuplicate?.(option)}>
              {option}
            </option>
          ))}
        </select>
      ) : (
        <input className={`${field} border-slate-600 bg-[#171c24] text-white placeholder:text-slate-500 ${isBrand ? "focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20" : "focus:border-teal-400 focus:ring-2 focus:ring-teal-500/20"}`} required placeholder="e.g. Northstar" value={value} onChange={(event) => setValue(event.target.value)} />
      )}
      {isBrand ? <div className="flex items-center gap-3 rounded-xl border border-cyan-900/60 bg-gradient-to-r from-cyan-950/30 to-[#171c24] p-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-cyan-800/60 bg-[#171c24] font-serif text-lg font-semibold text-cyan-200">{value.trim().slice(0, 1).toUpperCase() || "B"}</span><div className="min-w-0"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-cyan-300">Brand mark preview</p><p className="mt-0.5 truncate text-sm font-semibold text-slate-100">{value.trim() || "Your brand name"}</p></div></div> : null}
      {isSize ? <div className="rounded-xl border border-blue-900/60 bg-gradient-to-br from-blue-950/30 to-[#171c24] p-3"><div className="mb-2.5 flex items-center justify-between gap-2"><div><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-blue-300">Size scale preview</p><p className="mt-0.5 text-xs text-slate-400">{value || "Choose a size to preview"}</p></div><span className="rounded-md border border-blue-800/50 bg-blue-950/30 px-2 py-1 text-[10px] font-medium text-blue-200">{options?.length ?? 0} options</span></div><div className="grid grid-cols-4 gap-1.5">{options?.map((option) => <span key={option} className={`grid min-h-9 place-items-center rounded-lg border px-1 text-center text-[10px] font-semibold transition-colors ${value === option ? "border-blue-400 bg-blue-700 text-white shadow-sm" : isDuplicate?.(option) ? "border-slate-700 bg-[#171c24] text-slate-600 line-through" : "border-slate-700 bg-[#171c24] text-slate-300"}`}>{option}</span>)}</div></div> : null}
      {duplicate ? <p className="rounded-lg border border-amber-700/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">{title} already exists.</p> : null}
      {error ? <p className="rounded-lg border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
      <button disabled={duplicate || loading || submitting} className={`w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${isBrand ? "bg-cyan-700 hover:bg-cyan-600 focus-visible:ring-2 focus-visible:ring-cyan-400" : "bg-blue-700 hover:bg-blue-600 focus-visible:ring-2 focus-visible:ring-blue-400"}`}>{submitting ? "Saving…" : `Add ${title.toLowerCase()}`}</button>
      {loading ? (
        <RowsSkeleton rows={3} />
      ) : (
        <details className="rounded-xl border border-slate-700 bg-[#171c24] px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-300">
            Existing {title.toLowerCase()}s ({rows.length})
          </summary>
          {rows.length > 0 ? (
            <ul className="mt-2 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto border-t border-slate-700 pt-2 text-xs text-slate-300">
              {rows.map((row, index) => <li key={`${row}-${index}`} className="rounded-md border border-slate-700 bg-[#202630] px-2 py-1">{row}</li>)}
            </ul>
          ) : (
            <p className="mt-2 border-t border-slate-700 pt-2 text-xs text-slate-400">
              No {title.toLowerCase()}s added yet.
            </p>
          )}
        </details>
      )}
    </form>
  );
}

export function AdminOutlets() {
  const [items, setItems] = useState<Outlet[]>([]);
  const [form, setForm] = useState({ name: "", address: "", city: "", phone: "", hours: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api.outlets().then(setItems).catch((reason) => setError(messageOf(reason, "Could not load outlets"))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const cities = [...new Set(items.map((item) => item.city.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  function clearForm() {
    setForm({ name: "", address: "", city: "", phone: "", hours: "" });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.saveOutlet({ ...form, hours: form.hours || null });
      clearForm();
      load();
    } catch (reason) {
      setError(messageOf(reason, "Could not save the outlet"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-emerald-500 bg-[#171c24] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-700/60 bg-emerald-950/30 text-emerald-200">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zM12 10h.01" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Store locations</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Outlets</h1>
            <p className="mt-0.5 text-xs text-slate-400">A clear view of every place your customers can visit</p>
          </div>
        </div>
        <div className="flex gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#202630] px-3 py-1.5 text-xs text-slate-300"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 10h18M5 10V6l7-3 7 3v4M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" /></svg>{loading ? "Loading…" : `${items.length} ${items.length === 1 ? "outlet" : "outlets"}`}</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/25 px-3 py-1.5 text-xs text-emerald-200"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0zM12 10h.01" strokeLinecap="round" strokeLinejoin="round" /></svg>{loading ? "…" : `${cities.length} ${cities.length === 1 ? "city" : "cities"}`}</span>
        </div>
      </header>
      {error ? <p className="rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-700 border-t-2 border-t-emerald-600 bg-[#202630] p-5 shadow-sm lg:sticky lg:top-4 lg:self-start">
          <div className="flex items-center gap-3 border-b border-slate-700 pb-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-700/60 bg-emerald-950/25 text-xs font-semibold text-emerald-200">01</span>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Add an outlet</h2>
              <p className="text-xs text-slate-400">Add a location to your store directory</p>
            </div>
          </div>
          <label className="block text-xs font-medium text-slate-300">Outlet name
            <input className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400" required placeholder="e.g. Dhanmondi flagship" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </label>
          <label className="block text-xs font-medium text-slate-300">Street address
            <input className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400" required placeholder="House, road, area" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
          </label>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-300">City
              <input className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400" required placeholder="Dhaka" value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} />
            </label>
            <label className="block text-xs font-medium text-slate-300">Phone
              <input className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400" required type="tel" placeholder="+880 1XXX-XXXXXX" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </label>
          </div>
          <label className="block text-xs font-medium text-slate-300">Opening hours <span className="font-normal text-slate-500">(optional)</span>
            <input className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-emerald-400" placeholder="Every day, 10:00 AM – 9:00 PM" value={form.hours} onChange={(event) => setForm({ ...form, hours: event.target.value })} />
          </label>
          <div className="flex items-center gap-3 overflow-hidden rounded-xl border border-emerald-900/60 bg-gradient-to-r from-emerald-950/35 to-[#171c24] px-3 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-800/60 bg-emerald-950/40 text-emerald-200"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zM12 10h.01" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-300">Directory preview</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-100">{form.name.trim() || "Your outlet name"}</p>
              <p className="mt-0.5 truncate text-xs text-slate-400">{[form.city.trim(), form.address.trim()].filter(Boolean).join(" · ") || "City and address will appear here"}</p>
            </div>
          </div>
          <button disabled={saving} className="w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-wait disabled:opacity-50">{saving ? "Saving…" : "Add outlet"}</button>
        </form>
        <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-emerald-600 bg-[#202630] shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-800/60 bg-emerald-950/25 text-emerald-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 10h18M5 10V6l7-3 7 3v4M5 10v10h14V10M9 20v-6h6v6" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <div><h2 className="text-sm font-semibold text-slate-100">Outlet directory</h2><p className="text-xs text-slate-400">Address, contact and opening hours</p></div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-[#171c24] px-2.5 py-1 text-xs text-slate-300"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 10h18M5 10V6l7-3 7 3v4M5 10v10h14V10" strokeLinecap="round" strokeLinejoin="round" /></svg>{items.length} total</span>
          </div>
          {loading ? <div className="p-5"><RowsSkeleton rows={4} columns={2} /></div> : items.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-emerald-800/50 bg-emerald-950/20 text-emerald-200"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zM12 10h.01" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <p className="mt-3 text-sm font-medium text-slate-200">No outlets yet</p>
              <p className="mt-1 text-xs text-slate-400">Add your first store location to get started.</p>
            </div>
          ) : (
            <ul className="space-y-2 p-4">
              {items.map((item, index) => (
                <li key={item.id} className="group flex flex-wrap items-start gap-3 rounded-xl border border-slate-700 bg-[#171c24] p-3 transition-colors duration-200 hover:border-emerald-800/60 hover:bg-[#192321]">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-800/50 bg-emerald-950/25 text-emerald-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11zM12 10h.01" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-slate-100">{item.name}</h3>
                      <span className="rounded-md border border-emerald-800/50 bg-emerald-950/20 px-2 py-0.5 text-[10px] font-medium text-emerald-200">{item.city}</span>
                    </div>
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-slate-400"><svg viewBox="0 0 24 24" className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z" strokeLinecap="round" strokeLinejoin="round" /></svg>{item.address}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-300">
                      <span className="rounded-md border border-slate-700 bg-[#202630] px-2 py-1">{item.phone}</span>
                      {item.hours ? <span className="rounded-md border border-slate-700 bg-[#202630] px-2 py-1">{item.hours}</span> : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="hidden font-mono text-[10px] text-slate-600 sm:block">{String(index + 1).padStart(2, "0")}</span>
                    <button type="button" aria-label={`Delete outlet ${item.name}`} title="Delete outlet" className="grid h-9 w-9 place-items-center rounded-lg border border-rose-400/30 bg-rose-500/10 text-rose-300 transition-colors hover:border-rose-700 hover:bg-rose-700 hover:text-white" onClick={async () => {
                      if (!window.confirm(`Delete outlet ${item.name}?`)) return;
                      setError("");
                      try {
                        await api.deleteOutlet(item.id);
                        load();
                      } catch (reason) {
                        setError(messageOf(reason, "Could not delete the outlet"));
                      }
                    }}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export function AdminPages() {
  const [items, setItems] = useState<CmsPage[]>([]);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  function load() {
    setLoading(true);
    api.managePages().then(setItems).catch((reason) => setError(messageOf(reason, "Could not load pages"))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function clearForm() {
    setSlug("");
    setTitle("");
    setBody("");
    setEditing(false);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.savePage(slug, { title, body });
      clearForm();
      load();
    } catch (reason) {
      setError(messageOf(reason, "Could not save the page"));
    } finally {
      setSaving(false);
    }
  }

  const populatedCount = items.filter((item) => item.body?.trim()).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-cyan-500 bg-[#171c24] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-800/60 bg-cyan-950/30 text-cyan-200"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 3h9l5 5v13H6zM14 3v6h6M9 13h8M9 17h6" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300">Content studio</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Pages</h1>
            <p className="mt-0.5 text-xs text-slate-400">Build and maintain the pages across your storefront</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#202630] px-3 py-1.5 text-xs text-slate-300"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M6 3h9l5 5v13H6zM14 3v6h6M9 13h8M9 17h6" strokeLinecap="round" strokeLinejoin="round" /></svg>{loading ? "Loading…" : `${items.length} ${items.length === 1 ? "page" : "pages"}`}</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-cyan-800/60 bg-cyan-950/25 px-3 py-1.5 text-xs text-cyan-200"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 12.5 9.5 17 19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>{populatedCount} with content</span>
        </div>
      </header>
      {error ? <p className="rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-700 border-t-2 border-t-cyan-600 bg-[#202630] p-5 shadow-sm lg:sticky lg:top-4 lg:self-start">
          <div className="flex items-center justify-between gap-3 border-b border-slate-700 pb-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-800/60 bg-cyan-950/25 text-cyan-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg></span>
              <div><h2 className="text-sm font-semibold text-slate-100">{editing ? "Edit page" : "Create a page"}</h2><p className="text-xs text-slate-400">{editing ? "Update your storefront content" : "Add a page to your storefront"}</p></div>
            </div>
            {editing ? <button type="button" className="rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700/40" onClick={clearForm}>Cancel</button> : null}
          </div>
          <label className="block text-xs font-medium text-slate-300">Page address
            <div className="mt-1.5 flex h-11 items-center overflow-hidden rounded-xl border-2 border-slate-600 bg-[#171c24] focus-within:border-cyan-400">
              <span className="shrink-0 border-r border-slate-700 px-3 text-xs text-slate-500">/pages/</span>
              <input className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm text-white outline-none placeholder:text-slate-500" required placeholder="about-us" value={slug} onChange={(event) => setSlug(event.target.value)} />
            </div>
          </label>
          <label className="block text-xs font-medium text-slate-300">Page title
            <input className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400" required placeholder="About our store" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="block text-xs font-medium text-slate-300">Page content
            <textarea className="mt-1.5 min-h-40 w-full resize-y rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400" required placeholder="Write the page content…" value={body} onChange={(event) => setBody(event.target.value)} />
          </label>
          <div className="overflow-hidden rounded-xl border border-cyan-900/60 bg-gradient-to-br from-cyan-950/30 to-[#171c24] p-3.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-cyan-300">Page preview</span>
              <span className="font-mono text-[10px] text-slate-500">{body.length} chars</span>
            </div>
            <p className="mt-2 truncate text-sm font-semibold text-slate-100">{title.trim() || "Your page title"}</p>
            <p className="mt-1 truncate font-mono text-[11px] text-cyan-200/80">/pages/{slug.trim() || "your-page"}</p>
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">{body.trim() || "Your page content preview will appear here."}</p>
          </div>
          <button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-wait disabled:opacity-50">
            {!saving ? <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 3v10M3 8h10" strokeLinecap="round" /></svg> : null}
            {saving ? "Saving…" : editing ? "Save changes" : "Publish page"}
          </button>
        </form>
        <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-cyan-600 bg-[#202630] shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-800/50 bg-cyan-950/25 text-cyan-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 3h9l5 5v13H6zM14 3v6h6M9 13h8M9 17h6" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <div><h2 className="text-sm font-semibold text-slate-100">Page library</h2><p className="text-xs text-slate-400">Storefront content and page addresses</p></div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-[#171c24] px-2.5 py-1 text-xs text-slate-300"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M6 3h9l5 5v13H6zM14 3v6h6" strokeLinecap="round" strokeLinejoin="round" /></svg>{items.length} total</span>
          </div>
          {loading ? <div className="p-5"><RowsSkeleton rows={4} columns={2} /></div> : items.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-cyan-800/50 bg-cyan-950/20 text-cyan-200"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M6 3h9l5 5v13H6zM14 3v6h6M9 13h8M9 17h6" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <p className="mt-3 text-sm font-medium text-slate-200">No pages yet</p>
              <p className="mt-1 text-xs text-slate-400">Create a page to add useful content to your storefront.</p>
            </div>
          ) : (
            <ul className="space-y-2 p-4">
              {items.map((item) => (
                <li key={item.slug} className="flex flex-wrap items-start gap-3 rounded-xl border border-slate-700 bg-[#171c24] p-3.5 transition-colors duration-200 hover:border-cyan-800/50 hover:bg-[#192225]">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-800/50 bg-cyan-950/25 text-cyan-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M6 3h9l5 5v13H6zM14 3v6h6M9 13h8M9 17h6" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-slate-100">{item.title}</h3>
                    <p className="mt-1 truncate font-mono text-[11px] text-cyan-200/80">/pages/{item.slug}</p>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">{item.body?.trim() || "No page content yet."}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button type="button" aria-label={`Edit page ${item.title}`} title="Edit page" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-600 bg-[#202630] text-slate-300 transition-colors hover:border-cyan-700 hover:bg-cyan-950/40 hover:text-cyan-200" onClick={async () => {
                      setError("");
                      setEditing(true);
                      setSlug(item.slug);
                      setTitle(item.title);
                      setBody(item.body ?? "");
                      try {
                        const page = await api.page(item.slug);
                        setBody(page.body ?? "");
                      } catch (reason) {
                        setError(messageOf(reason, "Could not load the page"));
                      }
                    }}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m15 5 4 4M4 20l4-.8L19 8a2.1 2.1 0 0 0-3-3L5 16l-1 4z" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
                    <button type="button" aria-label={`Delete page ${item.title}`} title="Delete page" className="grid h-9 w-9 place-items-center rounded-lg border border-rose-400/30 bg-rose-500/10 text-rose-300 transition-colors hover:border-rose-700 hover:bg-rose-700 hover:text-white" onClick={async () => {
                      if (!window.confirm(`Delete page ${item.title}?`)) return;
                      setError("");
                      try {
                        await api.deletePage(item.slug);
                        if (slug === item.slug) clearForm();
                        load();
                      } catch (reason) {
                        setError(messageOf(reason, "Could not delete the page"));
                      }
                    }}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export function AdminDelivery() {
  const [items, setItems] = useState<DeliveryZone[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [fee, setFee] = useState("60");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.zones().then(setItems).catch((reason) => setError(messageOf(reason, "Could not load zones"))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const activeCount = items.filter((item) => item.isActive).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-sky-600 bg-[#171c24] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-sky-800/60 bg-sky-950/30 text-sky-200"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7zM7 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-300">Shipping setup</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Delivery zones</h1>
            <p className="mt-0.5 text-xs text-slate-400">Set delivery coverage and customer fees</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#202630] px-3 py-1.5 text-xs text-slate-300"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" strokeLinecap="round" strokeLinejoin="round" /></svg>{loading ? "Loading…" : `${items.length} zones`}</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-sky-800/60 bg-sky-950/25 px-3 py-1.5 text-xs text-sky-200"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-sky-300" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 12.5 9.5 17 19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>{activeCount} active</span>
        </div>
      </header>
      {error ? <p className="rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <form
        className="space-y-4 rounded-2xl border border-slate-700 border-t-2 border-t-sky-700 bg-[#202630] p-5 shadow-sm lg:sticky lg:top-4 lg:self-start"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          try {
            await api.saveZone({ name: name.trim(), city: city.trim() || null, fee: Number(fee) }, editing ?? undefined);
            setEditing(null);
            setName("");
            setCity("");
            load();
          } catch (reason) {
            setError(messageOf(reason, "Could not save the zone"));
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="flex items-center gap-3 border-b border-slate-700 pb-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-sky-800/60 bg-sky-950/25 text-xs font-semibold text-sky-200">01</span>
          <div><h2 className="text-sm font-semibold text-slate-100">{editing ? "Edit delivery zone" : "Add delivery zone"}</h2><p className="text-xs text-slate-400">Define area and delivery fee</p></div>
        </div>
        <label className="block text-xs font-medium text-slate-300">Zone name<input className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400" required placeholder="e.g. Metro express" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="block text-xs font-medium text-slate-300">City <span className="font-normal text-slate-500">(blank means all cities)</span><input className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400" placeholder="City name" value={city} onChange={(event) => setCity(event.target.value)} /></label>
        <label className="block text-xs font-medium text-slate-300">Delivery fee<div className="relative mt-1.5"><input className="h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 pr-12 text-sm text-white outline-none focus:border-sky-400" required inputMode="decimal" placeholder="60" value={fee} onChange={(event) => setFee(event.target.value)} /><span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-semibold text-sky-300">৳</span></div></label>
        <div className="flex items-center justify-between rounded-lg border border-sky-800/40 bg-gradient-to-r from-sky-950/45 via-[#171c24] to-[#171c24] px-3 py-2"><span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-sky-300/70">Preview</span><span className="truncate text-xs font-medium text-slate-100">{name.trim() || "Zone name"} · {city.trim() || "All cities"}</span><span className="rounded-md border border-sky-500/40 bg-gradient-to-br from-sky-500/25 to-sky-900/40 px-2 py-1 text-xs font-semibold text-sky-100">৳{fee || "0"}</span></div>
        <button disabled={busy} className="w-full rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-wait disabled:opacity-50">{busy ? "Saving…" : editing ? "Save changes" : "Add zone"}</button>
      </form>
      <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-sky-700 bg-[#202630] shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl border border-sky-800/50 bg-sky-950/25 text-sky-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7zM7 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" strokeLinecap="round" strokeLinejoin="round" /></svg></span><div><h2 className="text-sm font-semibold text-slate-100">Delivery network</h2><p className="text-xs text-slate-400">Coverage areas and fee settings</p></div></div>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-[#171c24] px-2.5 py-1 text-xs text-slate-300"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" strokeLinecap="round" strokeLinejoin="round" /></svg>{items.length} zones</span>
        </div>
        {loading ? <div className="p-5"><RowsSkeleton rows={4} columns={3} /></div> : items.length === 0 ? <div className="px-5 py-12 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-slate-700 bg-[#171c24] text-sky-200"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 7h11v10H3zM14 10h4l3 3v4h-7z" /></svg></span><p className="mt-3 text-sm font-medium text-slate-200">No delivery zones yet</p><p className="mt-1 text-xs text-slate-400">Create a zone to set delivery coverage and fees.</p></div> : (
          <ul className="space-y-1 px-4 py-3">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-transparent px-3 py-3 transition-colors duration-200 hover:border-slate-600 hover:bg-[#171c24]">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky-800/40 bg-sky-950/20 text-sky-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0zM12 10h.01" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-semibold text-slate-100">{item.name}</span><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${item.isActive ? "border-emerald-800/60 bg-emerald-950/25 text-emerald-200" : "border-slate-600 bg-[#202630] text-slate-400"}`}><span className={`h-1.5 w-1.5 rounded-full ${item.isActive ? "bg-emerald-300" : "bg-slate-500"}`} />{item.isActive ? "Active" : "Inactive"}</span></div><p className="mt-1 text-xs text-slate-400">{item.city || "All cities"}{item.freeShippingOver != null ? ` · Free over ${money(item.freeShippingOver)}` : ""}</p></div>
                <span className="rounded-lg border border-sky-800/50 bg-sky-950/20 px-2.5 py-1 text-xs font-semibold text-sky-200">৳{item.fee}</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={busyId === item.id} className="grid h-9 w-9 place-items-center rounded-lg border border-rose-400/30 bg-rose-500/10 text-rose-300 transition-colors hover:border-rose-700 hover:bg-rose-700 hover:text-white disabled:opacity-50" aria-label={`Delete ${item.name}`} title="Delete zone" onClick={async () => { if (!window.confirm(`Delete delivery zone ${item.name}?`)) return; setBusyId(item.id); setError(""); try { await api.deleteZone(item.id); load(); } catch (reason) { setError(messageOf(reason, "Could not delete delivery zone")); } finally { setBusyId(null); } }}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      </div>
    </div>
  );
}

export function AdminNewsletter() {
  const [items, setItems] = useState<Subscriber[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  function load() {
    setLoading(true);
    api.subscribers().then(setItems).catch((reason) => setError(messageOf(reason, "Could not load subscribers"))).finally(() => setLoading(false));
  }
  useEffect(load, []);
  const activeCount = items.filter((item) => item.isActive).length;
  const filteredItems = items.filter((item) => item.email.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-lime-400 bg-[#171c24] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-lime-800/60 bg-lime-950/30 text-lime-200"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 6h16v12H4zM4 7l8 6 8-6M7 10v5m10-5v5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-lime-300">Campaign audience</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Newsletter</h1>
            <p className="mt-0.5 text-xs text-slate-400">Keep track of the people who want to hear from your store</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#202630] px-3 py-1.5 text-xs text-slate-300"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 6h16v12H4zM4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" /></svg>{loading ? "Loading…" : `${items.length} total`}</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-lime-800/60 bg-lime-950/25 px-3 py-1.5 text-xs text-lime-200"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-lime-300" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 12.5 9.5 17 19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>{activeCount} subscribed</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-[#202630] px-3 py-1.5 text-xs text-slate-400"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18M4 6h16v12H4z" strokeLinecap="round" strokeLinejoin="round" /></svg>{items.length - activeCount} unsubscribed</span>
        </div>
      </header>
      {error ? <p className="rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-lime-500 bg-[#202630] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-lime-800/50 bg-lime-950/25 text-lime-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 6h16v12H4zM4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            <div><h2 className="text-sm font-semibold text-slate-100">Subscriber list</h2><p className="text-xs text-slate-400">Search and manage your email audience</p></div>
          </div>
          <label className="relative block w-full sm:w-72">
            <span className="sr-only">Search subscribers by email</span>
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" strokeLinecap="round" /></svg>
            <input className="h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] pr-3 pl-9 text-sm text-white outline-none placeholder:text-slate-500 focus:border-lime-400" type="search" placeholder="Search email address" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
        </div>
        {loading ? <div className="p-5"><RowsSkeleton rows={5} columns={3} /></div> : items.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-lime-800/50 bg-lime-950/20 text-lime-200"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 6h16v12H4zM4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            <p className="mt-3 text-sm font-medium text-slate-200">No subscribers yet</p>
            <p className="mt-1 text-xs text-slate-400">New signups will appear here as customers join your newsletter.</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="px-5 py-10 text-center"><p className="text-sm font-medium text-slate-200">No matching subscribers</p><p className="mt-1 text-xs text-slate-400">Try another email address.</p></div>
        ) : (
          <ul className="divide-y divide-slate-700">
            {filteredItems.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition-colors duration-200 hover:bg-[#171c24]">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-lime-800/50 bg-lime-950/25 text-sm font-semibold uppercase text-lime-200">{item.email.slice(0, 1)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">{item.email}</p>
                  <p className="mt-1 text-[11px] text-slate-500">Joined {new Date(item.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${item.isActive ? "border-lime-800/60 bg-lime-950/25 text-lime-200" : "border-slate-600 bg-[#171c24] text-slate-400"}`}><span className={`h-1.5 w-1.5 rounded-full ${item.isActive ? "bg-lime-300" : "bg-slate-500"}`} aria-hidden="true" />{item.isActive ? "Subscribed" : "Unsubscribed"}</span>
                <button type="button" aria-label={`Delete subscriber ${item.email}`} title="Delete subscriber" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-rose-400/30 bg-rose-500/10 text-rose-300 transition-colors hover:border-rose-700 hover:bg-rose-700 hover:text-white" onClick={async () => {
                  if (!window.confirm(`Delete subscriber ${item.email}?`)) return;
                  setError("");
                  try {
                    await api.deleteSubscriber(item.id);
                    load();
                  } catch (reason) {
                    setError(messageOf(reason, "Could not delete the subscriber"));
                  }
                }}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function AdminSettings() {
  const { user, updateProfile, saveAvatar } = useAuth();
  const { settings, settingsReady } = useStore();
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordNote, setPasswordNote] = useState("");
  const [form, setForm] = useState<Settings>(settings);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  useEffect(() => setForm(settings), [settings]);

  if (!settingsReady) return <RowsSkeleton rows={8} />;

  const fieldGroups = [
    {
      title: "Store identity & support",
      description: "How customers identify and contact your store",
      fields: [
        { key: "storeName", label: "Store name", type: "text", placeholder: "Your store name" },
        { key: "supportEmail", label: "Support email", type: "email", placeholder: "help@example.com" },
        { key: "supportPhone", label: "Support phone", type: "tel", placeholder: "+880 1XXX-XXXXXX" },
        { key: "address", label: "Store address", type: "text", placeholder: "Street, city, country" },
      ],
    },
    {
      title: "Social presence",
      description: "Connect customers to your social channels",
      fields: [
        { key: "facebookUrl", label: "Facebook URL", type: "url", placeholder: "https://facebook.com/yourstore" },
        { key: "instagramUrl", label: "Instagram URL", type: "url", placeholder: "https://instagram.com/yourstore" },
      ],
    },
    {
      title: "Payment contacts",
      description: "Merchant account numbers shown to customers",
      fields: [
        { key: "bkashNumber", label: "bKash number", type: "tel", placeholder: "01XXXXXXXXX" },
        { key: "nagadNumber", label: "Nagad number", type: "tel", placeholder: "01XXXXXXXXX" },
        { key: "rocketNumber", label: "Rocket number", type: "tel", placeholder: "01XXXXXXXXX" },
      ],
    },
  ] as const;

  return (
        <div className="space-y-5">
          <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-orange-400 bg-[#171c24] p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-orange-800/60 bg-orange-950/30 text-orange-200"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM19 13a7 7 0 0 0 0-2l2-1.5-2-3.5-2.5 1a7 7 0 0 0-1.7-1L14.5 3h-5L9 6a7 7 0 0 0-1.7 1L5 6 3 9.5 5 11a7 7 0 0 0 0 2l-2 1.5L5 18l2.3-1a7 7 0 0 0 1.7 1l.5 3h5l.3-3a7 7 0 0 0 1.7-1l2.5 1 2-3.5z" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-300">Store control</p><h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Settings</h1><p className="mt-0.5 text-xs text-slate-400">Store details, customer contacts and account security</p></div>
            </div>
            <span className="inline-flex items-center gap-2 rounded-lg border border-orange-800/50 bg-orange-950/20 px-3 py-1.5 text-xs text-orange-200"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 10h18M5 10V6l7-3 7 3v4M5 10v10h14V10M9 20v-6h6v6" strokeLinecap="round" strokeLinejoin="round" /></svg>{form.storeName || "Your store"}</span>
          </header>
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
            <form className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-orange-500 bg-[#202630] shadow-sm" onSubmit={async (event) => {
              event.preventDefault();
              setError("");
              setNote("");
              setSettingsSaving(true);
              try {
                await api.updateSettings(form);
                setNote("Store settings saved");
              } catch (reason) {
                setError(messageOf(reason, "Could not save settings"));
              } finally {
                setSettingsSaving(false);
              }
            }}>
              <div className="flex items-center gap-3 border-b border-slate-700 px-5 py-4"><span className="grid h-9 w-9 place-items-center rounded-xl border border-orange-800/50 bg-orange-950/25 text-orange-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 7h18v13H3zM7 7V5h10v2M8 12h8" strokeLinecap="round" strokeLinejoin="round" /></svg></span><div><h2 className="text-sm font-semibold text-slate-100">Store profile</h2><p className="text-xs text-slate-400">Information and payment contacts for your storefront</p></div></div>
              <div className="space-y-5 p-5">
                {fieldGroups.map((group, groupIndex) => (
                  <section key={group.title} className={groupIndex > 0 ? "border-t border-slate-700 pt-5" : ""}>
                    <div className="mb-3"><h3 className="text-xs font-semibold text-slate-200">{group.title}</h3><p className="mt-0.5 text-[11px] text-slate-500">{group.description}</p></div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {group.fields.map(({ key, label, type, placeholder }) => (
                        <label key={key} className={`block text-xs font-medium text-slate-300 ${key === "address" ? "sm:col-span-2" : ""}`}>
                          {label}
                          <input type={type} required={key === "storeName"} className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-400" placeholder={placeholder} value={form[key] ?? ""} onChange={(event) => setForm({ ...form, [key]: key === "storeName" ? event.target.value : event.target.value || null })} />
                        </label>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700 bg-[#171c24] px-5 py-4">
                <div aria-live="polite">{error ? <p className="text-xs text-rose-300" role="alert">{error}</p> : note ? <p className="inline-flex items-center gap-1.5 text-xs text-emerald-300"><svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3 8 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" /></svg>{note}</p> : <p className="text-xs text-slate-500">Changes apply to your storefront settings.</p>}</div>
                <button type="submit" disabled={settingsSaving} className="rounded-xl bg-orange-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 disabled:cursor-wait disabled:opacity-50">{settingsSaving ? "Saving…" : "Save store settings"}</button>
              </div>
            </form>
            <aside className="space-y-5">
              <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-amber-500 bg-[#202630] shadow-sm">
                <div className="flex items-center gap-3 border-b border-slate-700 px-5 py-4"><span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-800/50 bg-amber-950/25 text-amber-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" strokeLinecap="round" /></svg></span><div><h2 className="text-sm font-semibold text-slate-100">Admin profile</h2><p className="text-xs text-slate-400">Your account and profile photo</p></div></div>
                <div className="p-5">
                  <div className="flex items-center gap-4">
                    {user?.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-14 w-14 rounded-full border border-slate-600 object-cover" /> : user ? <span className="grid h-14 w-14 place-items-center rounded-full border border-amber-700/60 bg-amber-950/40 text-lg font-bold text-amber-200">{user.firstName.slice(0, 1)}</span> : null}
                    <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-100">{user ? `${user.firstName} ${user.lastName}` : "Admin"}</p><p className="mt-1 truncate text-xs text-slate-400">{user?.email}</p><span className="mt-2 inline-flex rounded-full border border-emerald-800/60 bg-emerald-950/25 px-2 py-0.5 text-[10px] font-medium text-emerald-200">Administrator</span></div>
                  </div>
                  <label className={`relative mt-5 flex cursor-pointer items-center gap-3 overflow-hidden rounded-xl border border-dashed p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-400/50 ${avatarSaving ? "border-amber-700/50 bg-amber-950/20" : "border-slate-600 bg-[#171c24] hover:border-amber-600/70 hover:bg-amber-950/10"}`}>
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-amber-800/50 bg-amber-950/30 text-amber-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 16V4m0 0L8 8m4-4 4 4M5 14v5h14v-5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-slate-200">{avatarSaving ? "Uploading photo…" : "Choose a new photo"}</span>
                      <span className="mt-1 block text-[10px] text-slate-500">AVIF, JPEG, PNG or WebP</span>
                    </span>
                    <span className="shrink-0 rounded-lg border border-slate-600 bg-[#202630] px-2.5 py-1.5 text-[10px] font-semibold text-amber-200">Browse</span>
                    <input type="file" aria-label="Upload admin profile photo" accept="image/avif,image/jpeg,image/png,image/webp" disabled={avatarSaving} className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait" onChange={async (event) => {
                      const input = event.currentTarget;
                      const file = input.files?.[0];
                      if (!file) return;
                      setPasswordNote("");
                      setAvatarSaving(true);
                      try {
                        await saveAvatar(file);
                        setPasswordNote("Photo saved");
                      } catch (reason) {
                        setPasswordNote(messageOf(reason, "Could not save the photo"));
                      } finally {
                        setAvatarSaving(false);
                        input.value = "";
                      }
                    }} />
                  </label>
                  {avatarSaving ? <p className="mt-2 text-xs text-amber-200" role="status">Uploading photo…</p> : null}
                  {passwordNote === "Photo saved" ? <p className="mt-2 text-xs text-emerald-300" role="status">Photo saved</p> : null}
                </div>
              </section>
              <form className="space-y-4 rounded-2xl border border-slate-700 border-t-2 border-t-rose-600 bg-[#202630] p-5 shadow-sm" onSubmit={async (event) => {
                event.preventDefault();
                setPasswordNote("");
                setPasswordSaving(true);
                try {
                  await updateProfile(password);
                  setPassword({ currentPassword: "", newPassword: "", confirmPassword: "" });
                  setPasswordNote("Password changed");
                } catch (reason) {
                  setPasswordNote(messageOf(reason, "Could not change the password"));
                } finally {
                  setPasswordSaving(false);
                }
              }}>
                <div className="flex items-center gap-3 border-b border-slate-700 pb-4"><span className="grid h-9 w-9 place-items-center rounded-xl border border-rose-800/50 bg-rose-950/25 text-rose-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M7 10V7a5 5 0 0 1 10 0v3m-12 0h14v11H5V10zm7 4v3" strokeLinecap="round" strokeLinejoin="round" /></svg></span><div><h2 className="text-sm font-semibold text-slate-100">Account security</h2><p className="text-xs text-slate-400">Change your admin password</p></div></div>
                <label className="block text-xs font-medium text-slate-300">Current password<input type="password" autoComplete="current-password" required className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none focus:border-rose-400" value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })} /></label>
                <label className="block text-xs font-medium text-slate-300">New password<input type="password" autoComplete="new-password" required minLength={8} className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none focus:border-rose-400" value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })} /></label>
                <label className="block text-xs font-medium text-slate-300">Confirm new password<input type="password" autoComplete="new-password" required minLength={8} className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none focus:border-rose-400" value={password.confirmPassword} onChange={(event) => setPassword({ ...password, confirmPassword: event.target.value })} /></label>
                {passwordNote && passwordNote !== "Photo saved" ? <p className={`text-xs ${passwordNote === "Password changed" ? "text-emerald-300" : "text-rose-300"}`} role="status">{passwordNote}</p> : null}
                <button type="submit" disabled={passwordSaving} className="w-full rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:cursor-wait disabled:opacity-50">{passwordSaving ? "Updating…" : "Update password"}</button>
              </form>
            </aside>
          </div>
        </div>
      );
}

export function AdminReturns() {
  const [items, setItems] = useState<StoreReturn[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  function load() {
    setLoading(true);
    api.returns().then(setItems).catch((reason) => setError(messageOf(reason, "Could not load returns"))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const requestedCount = items.filter((item) => item.status === "REQUESTED").length;
  const approvedCount = items.filter((item) => item.status === "APPROVED").length;

  async function review(item: StoreReturn, decision: "APPROVED" | "REJECTED") {
    setBusyId(item.id);
    setError("");
    try {
      await api.reviewReturn(item.id, { decision, ...(note ? { adminNote: note } : {}) });
      load();
    } catch (reason) {
      setError(messageOf(reason, decision === "APPROVED" ? "Could not approve return" : "Could not reject return"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-orange-500 bg-[#171c24] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-orange-800/60 bg-orange-950/30 text-orange-200"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 12h13m-5-5 5 5-5 5M20 5v14" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-orange-300">Order care</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Returns</h1>
            <p className="mt-0.5 text-xs text-slate-400">Review customer requests and decide the next step</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#202630] px-3 py-1.5 text-xs text-slate-300"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" strokeLinecap="round" strokeLinejoin="round" /></svg>{loading ? "Loading…" : `${items.length} total`}</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-amber-800/60 bg-amber-950/25 px-3 py-1.5 text-xs text-amber-200"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-amber-300" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 7v5l3 2m5-2a8 8 0 1 1-2.34-5.66" strokeLinecap="round" strokeLinejoin="round" /></svg>{requestedCount} requested</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/25 px-3 py-1.5 text-xs text-emerald-200"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 12.5 9.5 17 19 7" strokeLinecap="round" strokeLinejoin="round" /></svg>{approvedCount} approved</span>
        </div>
      </header>
      {error ? <p className="rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      <label className="block rounded-2xl border border-slate-700 border-t-2 border-t-orange-600 bg-[#202630] p-4 text-xs font-medium text-slate-300 shadow-sm">
        Admin note for the next decision <span className="font-normal text-slate-500">(optional)</span>
        <input className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-400" placeholder="Add context for the customer" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-orange-600 bg-[#202630] shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
        <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl border border-orange-800/50 bg-orange-950/30 text-orange-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" strokeLinecap="round" strokeLinejoin="round" /></svg></span><div><h2 className="text-sm font-semibold text-slate-100">Return queue</h2><p className="text-xs text-slate-400">Requests, reasons and item details</p></div></div>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-[#171c24] px-2.5 py-1 text-xs text-slate-300"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8" strokeLinecap="round" strokeLinejoin="round" /></svg>{items.length} requests</span>
        </div>
        {loading ? <div className="p-5"><RowsSkeleton rows={4} columns={2} /></div> : items.length === 0 ? (
          <div className="px-5 py-12 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-slate-700 bg-[#171c24] text-slate-400"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M4 12h13m-5-5 5 5-5 5M20 5v14" strokeLinecap="round" strokeLinejoin="round" /></svg></span><p className="mt-3 text-sm font-medium text-slate-200">No return requests</p><p className="mt-1 text-xs text-slate-400">New customer requests will appear here.</p></div>
        ) : (
          <ul className="space-y-1 px-4 py-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-xl border border-transparent px-3 py-3.5 transition-colors duration-200 hover:border-orange-800/40 hover:bg-orange-950/15">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-orange-800/50 bg-orange-950/25 text-orange-300"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 6h16v12H4zM8 10h8m-8 4h5" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-mono text-sm font-semibold text-orange-200">{item.order?.orderNumber ?? item.returnNumber ?? "Return request"}</p>
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${item.status === "REQUESTED" ? "border-amber-800/60 bg-amber-950/25 text-amber-200" : item.status === "APPROVED" ? "border-emerald-800/60 bg-emerald-950/25 text-emerald-200" : item.status === "REJECTED" ? "border-rose-800/60 bg-rose-950/25 text-rose-200" : "border-slate-600 bg-[#202630] text-slate-300"}`}><span className={`h-1.5 w-1.5 rounded-full ${item.status === "REQUESTED" ? "bg-amber-300" : item.status === "APPROVED" ? "bg-emerald-300" : item.status === "REJECTED" ? "bg-rose-300" : "bg-slate-400"}`} />{titleCaseStatus(item.status)}</span>
                      </div>
                      <p className="mt-1 truncate text-xs text-slate-400">{item.user ? `${item.user.firstName} ${item.user.lastName} · ${item.user.email}` : "Customer"}</p>
                      <p className="mt-2 text-sm font-medium text-slate-200">{titleCaseStatus(item.reason)}{item.note ? ` · ${item.note}` : ""}</p>
                      {(item.items ?? []).length > 0 ? <ul className="mt-2 flex flex-wrap gap-1.5">{(item.items ?? []).map((line) => <li key={line.id} className="rounded-md border border-slate-700 bg-[#202630] px-2 py-1 text-[11px] text-slate-300">{line.orderItem?.productName ?? "Item"} × {line.quantity}</li>)}</ul> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.refundAmount != null ? <span className="rounded-lg border border-slate-700 bg-[#202630] px-2.5 py-1.5 text-xs font-semibold text-slate-200">Refund {money(item.refundAmount)}</span> : null}
                    {item.status === "REQUESTED" ? <>
                      <button type="button" disabled={busyId === item.id} className="rounded-lg border border-emerald-800/60 bg-emerald-950/25 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition-colors hover:border-emerald-600 hover:bg-emerald-700 hover:text-white disabled:opacity-50" onClick={() => review(item, "APPROVED")}>{busyId === item.id ? "Reviewing…" : "Approve"}</button>
                      <button type="button" disabled={busyId === item.id} className="rounded-lg border border-rose-800/60 bg-rose-950/25 px-3 py-1.5 text-xs font-semibold text-rose-200 transition-colors hover:border-rose-700 hover:bg-rose-700 hover:text-white disabled:opacity-50" onClick={() => review(item, "REJECTED")}>Reject</button>
                    </> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function AdminPayments() {
  const [items, setItems] = useState<ManualPayment[]>([]);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  function load() {
    setLoading(true);
    api.manualPayments().then(setItems).catch((err) => setError(messageOf(err, "Could not load payments"))).finally(() => setLoading(false));
  }
  useEffect(load, []);

  const pendingCount = items.filter((item) => item.status === "PENDING").length;
  const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-emerald-700 bg-[#171c24] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-800/60 bg-emerald-950/25 text-emerald-200"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 7h18v13H3zM7 7V5h10v2m-14 5h18m-13 4h4" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Finance desk</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Payments</h1>
            <p className="mt-0.5 text-xs text-slate-400">Review manual payment submissions</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#202630] px-3 py-1.5 text-xs text-slate-300"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8M8 13h8M8 17h4" strokeLinecap="round" strokeLinejoin="round" /></svg>{loading ? "Loading…" : `${items.length} total`}</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-amber-800/60 bg-amber-950/25 px-3 py-1.5 text-xs text-amber-200"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-amber-300" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 7v5l3 2m5-2a8 8 0 1 1-2.34-5.66" strokeLinecap="round" strokeLinejoin="round" /></svg>{pendingCount} pending</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/25 px-3 py-1.5 text-xs text-emerald-200"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 2v20m5-16H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" strokeLinecap="round" /></svg>{money(totalAmount)} total value</span>
        </div>
      </header>
      {error ? <p className="rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      <label className="block rounded-2xl border border-slate-700 border-t-2 border-t-rose-800/60 bg-[#202630] p-4 text-xs font-medium text-slate-300 shadow-sm">
        Rejection reason <span className="font-normal text-slate-500">(used when rejecting a payment)</span>
        <input className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-rose-400" placeholder="Add a reason for the customer" value={reason} onChange={(event) => setReason(event.target.value)} />
      </label>
      <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-emerald-700 bg-[#202630] shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-800/50 bg-emerald-950/20 text-emerald-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8M8 13h4m4 0h.01" strokeLinecap="round" strokeLinejoin="round" /></svg></span><div><h2 className="text-sm font-semibold text-slate-100">Payment review queue</h2><p className="text-xs text-slate-400">Transactions awaiting verification</p></div></div>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-[#171c24] px-2.5 py-1 text-xs text-slate-300"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 5h16v14H4zM8 9h8M8 13h4m4 0h.01" strokeLinecap="round" strokeLinejoin="round" /></svg>{items.length} submissions</span>
        </div>
        {loading ? <div className="p-5"><RowsSkeleton rows={5} columns={4} /></div> : items.length === 0 ? (
          <div className="px-5 py-12 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-slate-700 bg-[#171c24] text-slate-400"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M3 7h18v13H3zM7 7V5h10v2m-14 5h18" strokeLinecap="round" strokeLinejoin="round" /></svg></span><p className="mt-3 text-sm font-medium text-slate-200">No payment submissions</p><p className="mt-1 text-xs text-slate-400">Customer payment references will appear here.</p></div>
        ) : (
          <ul className="space-y-1 px-4 py-3">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-transparent px-3 py-3.5 transition-colors duration-200 hover:border-emerald-800/40 hover:bg-emerald-950/15">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-800/40 bg-emerald-950/20 text-emerald-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 7h18v13H3zM7 7V5h10v2m-14 5h18" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-semibold text-slate-100">{item.order?.orderNumber ?? item.provider}</span><span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${item.status === "PENDING" ? "border-amber-800/60 bg-amber-950/25 text-amber-200" : item.status === "APPROVED" ? "border-emerald-800/60 bg-emerald-950/25 text-emerald-200" : "border-slate-600 bg-[#202630] text-slate-300"}`}><span className={`h-1.5 w-1.5 rounded-full ${item.status === "PENDING" ? "bg-amber-300" : item.status === "APPROVED" ? "bg-emerald-300" : "bg-slate-400"}`} />{titleCaseStatus(item.status)}</span></div>
                  <p className="mt-1 truncate text-xs text-slate-400">{item.provider}{item.transactionId ? ` · Transaction ${item.transactionId}` : " · No transaction ID"}</p>
                </div>
                <span className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 px-2.5 py-1 text-xs font-semibold text-emerald-200">{money(item.amount)}</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={busyId === item.id} className="rounded-lg border border-emerald-800/60 bg-emerald-950/25 px-3 py-1.5 text-xs font-semibold text-emerald-200 transition-colors hover:border-emerald-600 hover:bg-emerald-700 hover:text-white disabled:opacity-50" onClick={async () => { setBusyId(item.id); try { await api.approvePayment(item.id); load(); } catch (reasonError) { setError(messageOf(reasonError, "Could not approve payment")); } finally { setBusyId(null); } }}>{busyId === item.id ? "Working…" : "Approve"}</button>
                  <button type="button" disabled={busyId === item.id} className="rounded-lg border border-rose-800/60 bg-rose-950/25 px-3 py-1.5 text-xs font-semibold text-rose-200 transition-colors hover:border-rose-700 hover:bg-rose-700 hover:text-white disabled:opacity-50" onClick={async () => { setBusyId(item.id); try { await api.rejectPayment(item.id, reason || "Rejected"); load(); } catch (reasonError) { setError(messageOf(reasonError, "Could not reject payment")); } finally { setBusyId(null); } }}>{busyId === item.id ? "Working…" : "Reject"}</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function AdminSizeGuides() {
  const [items, setItems] = useState<SizeGuide[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const columns = ["Size", "Bust (in)", "Waist (in)", "Length (in)"];
  const rows = [
    ["XS", "32", "26", "42"],
    ["S", "34", "28", "44"],
    ["M", "36", "30", "46"],
    ["L", "38", "32", "48"],
    ["XL", "40", "34", "50"],
  ];

  function load() {
    setLoading(true);
    api.adminSizeGuides().then(setItems).catch((reason) => setError(messageOf(reason, "Could not load size guides"))).finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    api.adminCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const coveredCategories = new Set(items.map((item) => item.categoryId)).size;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.saveSizeGuide({ categoryId, title, columns, rows });
      setTitle("");
      load();
    } catch (reason) {
      setError(messageOf(reason, "Could not save the size guide"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-blue-500 bg-[#171c24] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-blue-800/60 bg-blue-950/30 text-blue-200"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 7.5 7.5 3 21 16.5 16.5 21 3 7.5zM7 7l2-2m1 6 2-2m1 6 2-2m1 6 2-2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-blue-300">Fit & sizing</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Size guide studio</h1>
            <p className="mt-0.5 text-xs text-slate-400">Help shoppers find the right fit for every category</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#202630] px-3 py-1.5 text-xs text-slate-300"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M3 7.5 7.5 3 21 16.5 16.5 21 3 7.5zM7 7l2-2m1 6 2-2m1 6 2-2" strokeLinecap="round" strokeLinejoin="round" /></svg>{loading ? "Loading…" : `${items.length} ${items.length === 1 ? "guide" : "guides"}`}</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-blue-800/60 bg-blue-950/25 px-3 py-1.5 text-xs text-blue-200"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-blue-300" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 5h16v14H4zM4 10h16M9 5v14m5-14v14" strokeLinecap="round" strokeLinejoin="round" /></svg>{coveredCategories} categories covered</span>
        </div>
      </header>
      {error ? <p className="rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-slate-700 border-t-2 border-t-blue-600 bg-[#202630] p-5 shadow-sm lg:sticky lg:top-4 lg:self-start">
          <div className="flex items-center gap-3 border-b border-slate-700 pb-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-blue-800/60 bg-blue-950/25 text-blue-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 5v14M5 12h14" strokeLinecap="round" /></svg></span>
            <div><h2 className="text-sm font-semibold text-slate-100">Create a fit guide</h2><p className="text-xs text-slate-400">Choose a category and name your chart</p></div>
          </div>
          <label className="block text-xs font-medium text-slate-300">Product category
            <select className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none focus:border-blue-400" required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">Select a category</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="block text-xs font-medium text-slate-300">Guide name
            <input className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400" required placeholder="e.g. Women's tops" value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <div className="overflow-hidden rounded-xl border border-blue-800/50 bg-gradient-to-br from-blue-950/45 via-[#171c24] to-[#171c24]">
            <div className="flex items-center justify-between border-b border-slate-700 px-3 py-2.5">
              <div><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-blue-300">Chart preview</p><p className="mt-0.5 text-xs font-medium text-slate-200">{title.trim() || "Standard size chart"}</p></div>
              <span className="rounded-md border border-slate-700 bg-[#202630] px-2 py-1 text-[10px] text-slate-400">INCHES</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[280px] text-left text-[10px]">
                <thead className="bg-[#202630] text-slate-400"><tr>{columns.map((column) => <th key={column} className="whitespace-nowrap px-2.5 py-2 font-medium">{column}</th>)}</tr></thead>
                <tbody>{rows.slice(0, 3).map((row) => <tr key={row[0]} className="border-t border-slate-700 text-slate-300">{row.map((cell, index) => <td key={`${row[0]}-${index}`} className="px-2.5 py-2">{cell}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <p className="border-t border-slate-700 px-3 py-2 text-[10px] text-slate-500">Includes 5 standard sizes from XS to XL</p>
          </div>
          <button disabled={saving || categories.length === 0} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50">
            {!saving ? <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 3v10M3 8h10" strokeLinecap="round" /></svg> : null}
            {saving ? "Saving…" : "Add size guide"}
          </button>
        </form>
        <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-blue-600 bg-[#202630] shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-blue-800/50 bg-blue-950/25 text-blue-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 5h16v14H4zM4 10h16M9 5v14m5-14v14" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <div><h2 className="text-sm font-semibold text-slate-100">Saved fit guides</h2><p className="text-xs text-slate-400">Open a chart to check its measurement table</p></div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-[#171c24] px-2.5 py-1 text-xs text-slate-300"><svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 5h16v14H4zM4 10h16M9 5v14m5-14v14" strokeLinecap="round" strokeLinejoin="round" /></svg>{items.length} total</span>
          </div>
          {loading ? <div className="p-5"><RowsSkeleton rows={4} columns={2} /></div> : items.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-blue-800/50 bg-blue-950/20 text-blue-200"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 5h16v14H4zM4 10h16M9 5v14m5-14v14" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <p className="mt-3 text-sm font-medium text-slate-200">No size guides yet</p>
              <p className="mt-1 text-xs text-slate-400">Create a fit chart to help customers choose a size.</p>
            </div>
          ) : (
            <ul className="space-y-2 p-4">
              {items.map((item) => (
                <li key={item.id} className="rounded-xl border border-slate-700 bg-[#171c24] transition-colors duration-200 hover:border-blue-800/50">
                  <div className="flex flex-wrap items-start gap-3 p-3.5">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-blue-800/50 bg-blue-950/25 text-blue-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 7.5 7.5 3 21 16.5 16.5 21 3 7.5zM7 7l2-2m1 6 2-2m1 6 2-2" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-sm font-semibold text-slate-100">{item.title}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-blue-800/50 bg-blue-950/20 px-2 py-0.5 text-[10px] font-medium text-blue-200">{categories.find((category) => category.id === item.categoryId)?.name ?? "Unassigned category"}</span>
                        <span className="text-[10px] text-slate-500">{item.rows.length} sizes · {item.columns.length} measurements</span>
                      </div>
                    </div>
                    <button type="button" aria-label={`Delete size guide ${item.title}`} title="Delete size guide" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-rose-400/30 bg-rose-500/10 text-rose-300 transition-colors hover:border-rose-700 hover:bg-rose-700 hover:text-white" onClick={async () => {
                      if (!window.confirm(`Delete size guide ${item.title}?`)) return;
                      setError("");
                      try {
                        await api.deleteSizeGuide(item.id);
                        load();
                      } catch (reason) {
                        setError(messageOf(reason, "Could not delete the size guide"));
                      }
                    }}><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
                  </div>
                  <details className="group border-t border-slate-700">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-blue-200">
                      <span>View measurements</span>
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m3 6 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </summary>
                    <div className="overflow-x-auto border-t border-slate-700">
                      <table className="w-full min-w-[420px] text-left text-xs">
                        <thead className="bg-[#202630] text-[10px] uppercase tracking-wide text-slate-400"><tr>{item.columns.map((column) => <th key={column} className="whitespace-nowrap px-3 py-2 font-medium">{column}</th>)}</tr></thead>
                        <tbody>{item.rows.map((row, index) => <tr key={`${item.id}-${index}`} className="border-t border-slate-700 text-slate-300">{row.map((cell, cellIndex) => <td key={`${item.id}-${index}-${cellIndex}`} className="px-3 py-2">{cell}</td>)}</tr>)}</tbody>
                      </table>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export function AdminVariants() {
  const [items, setItems] = useState<VariantRow[]>([]);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [productId, setProductId] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [productResults, setProductResults] = useState<ProductCardData[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductCardData | null>(null);
  const [productLoading, setProductLoading] = useState(false);
  const [productSearchError, setProductSearchError] = useState("");
  const [sizeId, setSizeId] = useState("");
  const [fabricId, setFabricId] = useState("");
  const [colorId, setColorId] = useState("");
  const [colorQuery, setColorQuery] = useState("");
  const [selectedColor, setSelectedColor] = useState<Color | null>(null);
  const [colorResults, setColorResults] = useState<Color[]>([]);
  const [colorLoading, setColorLoading] = useState(false);
  const [colorError, setColorError] = useState("");
  const [sku, setSku] = useState("");
  const [optionLabel, setOptionLabel] = useState("");
  const [stock, setStock] = useState("0");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyVariantId, setBusyVariantId] = useState<string | null>(null);
  function load() {
    setLoading(true);
    api.variants({ limit: 50, page: 1 }).then(setItems).catch((reason) => setError(messageOf(reason, "Could not load variants"))).finally(() => setLoading(false));
  }
  useEffect(() => {
    load();
    api.catalog().then(setCatalog).catch(() => undefined);
  }, []);

  useEffect(() => {
    const search = colorQuery.trim();
    setColorLoading(false);
    if (!search || colorId) {
      setColorResults([]);
      setColorError("");
      return;
    }

    let active = true;
    const timer = window.setTimeout(async () => {
      setColorLoading(true);
      setColorError("");
      try {
        const results = await api.searchColors(search);
        if (active) setColorResults(results);
      } catch (reason) {
        if (active) {
          setColorResults([]);
          setColorError(messageOf(reason, "Could not search colors"));
        }
      } finally {
        if (active) setColorLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [colorQuery, colorId]);

  useEffect(() => {
    const search = productQuery.trim();
    if (productId || search.length < 2) {
      setProductResults([]);
      setProductSearchError("");
      setProductLoading(false);
      return;
    }

    setProductResults([]);
    let active = true;
    const timer = window.setTimeout(async () => {
      setProductLoading(true);
      setProductSearchError("");
      try {
        const result = await api.products({ page: 1, limit: 10, search });
        if (active) setProductResults(result.items);
      } catch (reason) {
        if (active) {
          setProductResults([]);
          setProductSearchError(messageOf(reason, "Could not search products"));
        }
      } finally {
        if (active) setProductLoading(false);
      }
    }, 300);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [productQuery, productId]);

  const activeVariantCount = items.filter((item) => item.isActive).length;
  const lowStockCount = items.filter((item) => item.isActive && item.stock <= 5).length;
  const totalUnits = items.reduce((total, item) => total + item.stock, 0);
  const variantFieldClass = "h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none focus:border-amber-400";

  return (
    <Panel title="Variants" error={error}>
      <section className="flex flex-col gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-amber-500 bg-[#202630] p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between lg:col-span-2">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-amber-800/60 bg-amber-950/30 text-amber-200">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300">Variant workspace</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Variants</h1>
            <p className="mt-0.5 text-xs text-slate-400">Build combinations and monitor stock at a glance</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="min-w-24 rounded-lg border border-slate-700 bg-[#171c24] px-3 py-2">
            <dt className="inline-flex items-center gap-1 text-[10px] text-slate-400"><svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M2 5h12v9H2zM5 5V3h6v2m-9 3h12" strokeLinecap="round" strokeLinejoin="round" /></svg>Loaded</dt>
            <dd className="mt-0.5 text-sm font-semibold text-slate-100">{loading ? "—" : items.length}</dd>
          </div>
          <div className="min-w-24 rounded-lg border border-emerald-900/60 bg-emerald-950/20 px-3 py-2">
            <dt className="inline-flex items-center gap-1 text-[10px] text-emerald-300/80"><svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="m5.5 8 1.7 1.7 3.5-3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>Active</dt>
            <dd className="mt-0.5 text-sm font-semibold text-emerald-200">{loading ? "—" : activeVariantCount}</dd>
          </div>
          <div className="min-w-24 rounded-lg border border-rose-800/60 bg-rose-950/25 px-3 py-2">
            <dt className="inline-flex items-center gap-1 text-[10px] text-rose-300/80"><svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 2 1.8 13h12.4L8 2zM8 6v3m0 2v.01" strokeLinecap="round" strokeLinejoin="round" /></svg>Low stock</dt>
            <dd className="mt-0.5 text-sm font-semibold text-rose-200">{loading ? "—" : lowStockCount}</dd>
          </div>
          <div className="min-w-24 rounded-lg border border-slate-700 bg-[#171c24] px-3 py-2">
            <dt className="inline-flex items-center gap-1 text-[10px] text-slate-400"><svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true"><path d="m2 5 6-3 6 3v7l-6 3-6-3zM2 5l6 3 6-3M8 8v7" /></svg>Total units</dt>
            <dd className="mt-0.5 text-sm font-semibold text-slate-100">{loading ? "—" : totalUnits}</dd>
          </div>
        </dl>
      </section>
      <form
        className="space-y-4 rounded-2xl border border-slate-700 border-t-2 border-t-amber-600 bg-[#202630] p-4 shadow-sm lg:sticky lg:top-4 lg:self-start"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!productId) {
            setError("Search for a product and choose it from the suggestions.");
            return;
          }
          if (!sku.trim()) {
            setError("Enter a SKU for this variant.");
            return;
          }
          setSaving(true);
          setError("");
          setNote("");
          try {
            const genericDimensions =
              !sizeId || !fabricId ? await ensureGenericVariantDimensions() : null;
            const resolvedSizeId = sizeId || genericDimensions?.sizeId;
            const resolvedFabricId = fabricId || genericDimensions?.fabricId;
            const existingVariants = await api.variants({
              productId,
              limit: 100,
              page: 1,
            });
            const matchingVariant = existingVariants.find((variant) =>
              variant.sizeId === (resolvedSizeId ?? null) &&
              variant.fabricId === (resolvedFabricId ?? null) &&
              variant.colorId === (colorId || null),
            );
            if (matchingVariant) {
              const quantityToAdd = Number(stock);
              await api.saveVariant({
                stock: matchingVariant.stock + quantityToAdd,
              }, matchingVariant.id);
              setNote(`This option already existed. Added ${quantityToAdd} units to its stock.`);
              setSku("");
              setOptionLabel("");
              setColorId("");
              setColorQuery("");
              setSelectedColor(null);
              load();
              return;
            }
            const variantInput = {
              productId,
              sizeId: resolvedSizeId,
              fabricId: resolvedFabricId,
              colorId: colorId || null,
              optionLabel: optionLabel.trim() || "Standard",
              sku: sku.trim(),
              stock: Number(stock),
            };
            try {
              await api.saveVariant(variantInput);
            } catch (reason) {
              const backendDoesNotSupportOptionLabel =
                reason instanceof ApiError &&
                reason.status === 422 &&
                reason.errors?.some((issue) => issue.message === 'Unrecognized key: "optionLabel"');
              if (!backendDoesNotSupportOptionLabel) throw reason;
              const { optionLabel: _unsupportedOptionLabel, ...compatibleInput } = variantInput;
              await api.saveVariant(compatibleInput);
              setNote("Variant added. This server version does not save option labels; update the backend to enable them.");
              setSku("");
              setOptionLabel("");
              setColorId("");
              setColorQuery("");
              setSelectedColor(null);
              load();
              return;
            }
            setSku("");
            setOptionLabel("");
            setColorId("");
            setColorQuery("");
            setSelectedColor(null);
            setNote("Variant added successfully.");
            load();
          } catch (reason) {
            setError(messageOf(reason, "Could not save the variant"));
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="flex items-center gap-3 border-b border-slate-700 pb-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-800/60 bg-amber-950/25 text-xs font-semibold text-amber-200">01</span>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Create variant</h2>
            <p className="text-xs text-slate-400">Product, options and inventory</p>
          </div>
        </div>
        <div className="relative">
          <label className="mb-1.5 block text-xs font-medium text-slate-300" htmlFor="variant-product-search">Product</label>
          <input
            id="variant-product-search"
            className={`${variantFieldClass} placeholder:text-slate-500`}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={productResults.length > 0 && !productId}
            aria-controls="variant-product-options"
            placeholder="Search product name"
            value={productQuery}
            onChange={(event) => {
              setProductId("");
              setSelectedProduct(null);
              setProductQuery(event.target.value);
              setProductSearchError("");
            }}
          />
          {productLoading ? <p className="mt-1.5 text-xs text-slate-400" role="status">Searching products…</p> : null}
          {productSearchError ? <p className="mt-1.5 text-xs text-rose-300" role="alert">{productSearchError}</p> : null}
          {!productLoading && !productSearchError && productQuery.trim().length >= 2 && !productId && productResults.length === 0
            ? <p className="mt-1.5 text-xs text-slate-400">No products found.</p>
            : null}
          {selectedProduct ? (
            <p className="mt-2 inline-flex items-center gap-2 rounded-lg border border-amber-800/50 bg-amber-950/20 px-2.5 py-1.5 text-xs text-amber-100">
              Selected {selectedProduct.name}
              <button
                type="button"
                className="ml-1 text-slate-400 hover:text-white"
                aria-label="Choose a different product"
                onClick={() => {
                  setProductId("");
                  setSelectedProduct(null);
                  setProductQuery("");
                }}
              >
                Change
              </button>
            </p>
          ) : null}
          {!productId && productResults.length > 0 ? (
            <ul id="variant-product-options" className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-600 bg-[#171c24] p-1 shadow-xl" role="listbox" aria-label="Product suggestions">
              {productResults.map((product) => (
                <li key={product.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-amber-950/40 hover:text-amber-100"
                    onClick={() => {
                      setProductId(product.id);
                      setSelectedProduct(product);
                      setProductQuery(product.name);
                      setProductResults([]);
                      setProductSearchError("");
                    }}
                  >
                    <span className="truncate">{product.name}</span>
                    <span className="shrink-0 text-xs text-slate-400">{product.category?.name ?? "Uncategorized"}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <label className="block text-xs font-medium text-slate-300">
          Size <span className="font-normal text-slate-500">(optional)</span>
          <select className={`${variantFieldClass} mt-1.5`} value={sizeId} onChange={(event) => setSizeId(event.target.value)}>
            <option value="">No size</option>
            {(catalog?.sizes ?? []).map((size) => <option key={size.id} value={size.id}>{size.name}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Fabric <span className="font-normal text-slate-500">(optional)</span>
          <select className={`${variantFieldClass} mt-1.5`} value={fabricId} onChange={(event) => setFabricId(event.target.value)}>
            <option value="">No fabric</option>
            {(catalog?.fabrics ?? []).map((fabric) => <option key={fabric.id} value={fabric.id}>{fabric.name}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Option label <span className="font-normal text-slate-500">(e.g. 128 GB / Black)</span>
          <input className={`${variantFieldClass} mt-1.5 placeholder:text-slate-500`} placeholder="Standard" value={optionLabel} onChange={(event) => setOptionLabel(event.target.value)} />
        </label>
        <div className="relative">
          <label className="mb-1.5 block text-xs font-medium text-slate-300" htmlFor="variant-color-search">Color <span className="font-normal text-slate-500">(optional)</span></label>
          <input
            id="variant-color-search"
            className={`${variantFieldClass} placeholder:text-slate-500`}
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={colorResults.length > 0 && !colorId}
            aria-controls="variant-color-options"
            placeholder="Search color name (e.g. blue)"
            value={colorQuery}
            onChange={(event) => {
              setColorId("");
              setSelectedColor(null);
              setColorQuery(event.target.value);
              setColorError("");
            }}
          />
          {colorLoading ? <p className="mt-1.5 text-xs text-slate-400" role="status">Searching colors…</p> : null}
          {colorError ? <p className="mt-1.5 text-xs text-rose-300" role="alert">{colorError}</p> : null}
          {!colorLoading && !colorError && colorQuery.trim() && !colorId && colorResults.length === 0
            ? <p className="mt-1.5 text-xs text-slate-400">No colors found.</p>
            : null}
          {colorId && selectedColor ? (
            <p className="mt-2 inline-flex items-center gap-2 rounded-lg border border-amber-800/50 bg-amber-950/20 px-2.5 py-1.5 text-xs text-amber-100">
              <span className="h-4 w-4 rounded-full border border-white/20" style={{ backgroundColor: selectedColor.hexCode }} />
              Selected {colorQuery}<span className="text-slate-500">{selectedColor.hexCode}</span>
            </p>
          ) : null}
          {!colorId && colorResults.length > 0 ? (
            <ul id="variant-color-options" className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-600 bg-[#171c24] p-1 shadow-xl" role="listbox" aria-label="Color suggestions">
              {colorResults.map((color) => (
                <li key={color.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-amber-950/40 hover:text-amber-100"
                    onClick={() => {
                      setColorId(color.id);
                      setSelectedColor(color);
                      setColorQuery(color.name);
                      setColorResults([color]);
                      setColorError("");
                    }}
                  >
                    <span className="h-5 w-5 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: color.hexCode }} aria-hidden="true" />
                    <span>{color.name}</span>
                    <span className="ml-auto text-xs text-slate-400">{color.hexCode}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <label className="block text-xs font-medium text-slate-300">
          SKU
          <input className={`${variantFieldClass} mt-1.5 font-mono placeholder:font-sans placeholder:text-slate-500`} required placeholder="e.g. TEE-BLK-M" value={sku} onChange={(event) => setSku(event.target.value)} />
        </label>
        <label className="block text-xs font-medium text-slate-300">
          Stock quantity
          <input className={`${variantFieldClass} mt-1.5`} type="number" min="0" step="1" inputMode="numeric" required value={stock} onChange={(event) => setStock(event.target.value)} />
        </label>
        <div className="rounded-xl border border-amber-800/50 bg-gradient-to-r from-amber-950/30 via-[#171c24] to-[#171c24] p-3">
          <div className="flex items-center justify-between gap-2 border-b border-slate-700 pb-2">
            <div className="flex items-center gap-2">
              <span className="text-amber-300"><svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="M2 4h12v9H2zM5 7h6M5 10h3" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-300">Live preview</p>
            </div>
            <span className="rounded-md border border-slate-700 bg-[#202630] px-1.5 py-0.5 text-[10px] text-slate-400">{stock || "0"} units</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="max-w-full truncate rounded-md border border-amber-800/50 bg-amber-950/25 px-2 py-1 font-mono text-[10px] text-amber-200">{sku || "SKU pending"}</span>
            <span className="rounded-md border border-slate-700 bg-[#202630] px-2 py-1 text-[10px] text-slate-300">{optionLabel || catalog?.sizes.find((size) => size.id === sizeId)?.name || "Option"}</span>
            {fabricId ? <span className="rounded-md border border-slate-700 bg-[#202630] px-2 py-1 text-[10px] text-slate-300">{catalog?.fabrics.find((fabric) => fabric.id === fabricId)?.name ?? "Fabric"}</span> : null}
            {selectedColor ? <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-[#202630] px-2 py-1 text-[10px] text-slate-300"><span className="h-2 w-2 rounded-full border border-white/20" style={{ backgroundColor: selectedColor.hexCode }} />{selectedColor.name}</span> : null}
          </div>
        </div>
        <button disabled={saving} className="w-full rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-semibold text-white transition duration-200 hover:bg-amber-600 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 disabled:cursor-wait disabled:opacity-60">
          {saving ? "Adding variant…" : "Add variant"}
        </button>
      </form>
      <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-amber-600 bg-[#202630] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-800/50 bg-amber-950/25 text-amber-200"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m2 6 6-3 6 3 6-3 2 1v14l-8 4-6-3-6 3V6zm6-3v14m6-11v15m6-21v14" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            <div>
            <h2 className="text-sm font-semibold text-slate-100">Variant inventory</h2>
            <p className="mt-0.5 text-xs text-slate-400">Manage product options and stock status</p>
            </div>
          </div>
          <span className="rounded-lg border border-slate-600 bg-[#171c24] px-2.5 py-1 text-xs font-medium text-slate-300">{items.length} variants</span>
        </div>
        {note ? <p role="status" className="mx-5 mt-4 rounded-xl border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">{note}</p> : null}
        {loading ? <div className="p-5"><RowsSkeleton rows={5} columns={5} /></div> : items.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-slate-700 bg-[#171c24] text-slate-400">0</span>
            <p className="mt-3 text-sm font-medium text-slate-200">No variants yet</p>
            <p className="mt-1 text-xs text-slate-400">Create a variant using the form to start tracking options and stock.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-[#171c24] text-[11px] uppercase tracking-[0.1em] text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium"><span className="inline-flex items-center gap-1.5"><svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true"><path d="M2 3h7l5 5-6 6-6-6z" /><circle cx="5.5" cy="6.5" r="1" /></svg>Variant / SKU</span></th>
                  <th className="px-5 py-3 text-right font-medium"><span className="inline-flex items-center justify-end gap-1.5"><svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M3 4h10M3 8h10M3 12h10" /><circle cx="6" cy="4" r="1" fill="#171c24" /><circle cx="10" cy="8" r="1" fill="#171c24" /><circle cx="5" cy="12" r="1" fill="#171c24" /></svg>Options</span></th>
                  <th className="px-5 py-3 font-medium"><span className="inline-flex items-center gap-1.5"><svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" aria-hidden="true"><path d="m2 5 6-3 6 3v6l-6 3-6-3zM2 5l6 3 6-3M8 8v6" /></svg>Inventory</span></th>
                  <th className="px-5 py-3 font-medium"><span className="inline-flex items-center gap-1.5"><svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="m5.5 8 1.7 1.7 3.5-3.5" /></svg>Status</span></th>
                  <th className="px-5 py-3 text-right font-medium"><span className="inline-flex items-center justify-end gap-1.5"><svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="3" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none" /><circle cx="13" cy="8" r="1" fill="currentColor" stroke="none" /></svg>Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const sizeName = item.sizeId ? catalog?.sizes.find((size) => size.id === item.sizeId)?.name ?? item.sizeId : null;
                  const fabricName = item.fabricId ? catalog?.fabrics.find((fabric) => fabric.id === item.fabricId)?.name ?? item.fabricId : null;
                  return (
                    <tr key={item.id} className="border-t border-slate-700 transition-colors duration-200 hover:bg-slate-700/20">
                      <td className="px-5 py-4">
                        <p className="font-mono font-semibold text-amber-200">{item.sku}</p>
                        <p className="mt-1 max-w-40 truncate text-[10px] text-slate-500" title={item.productId}>Product {item.productId}</p>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {item.optionLabel ? <span className="rounded-md border border-slate-600 bg-[#171c24] px-2 py-1 text-xs text-slate-200">{item.optionLabel}</span> : null}
                          {sizeName ? <span className="rounded-md border border-slate-600 bg-[#171c24] px-2 py-1 text-xs text-slate-200"><span className="text-slate-400">Size:</span> {sizeName}</span> : null}
                          {fabricName ? <span className="rounded-md border border-slate-600 bg-[#171c24] px-2 py-1 text-xs text-slate-200"><span className="text-slate-400">Fabric:</span> {fabricName}</span> : null}
                          {item.colorId ? <span className="rounded-md border border-slate-600 bg-[#171c24] px-2 py-1 text-xs text-slate-300" title={item.colorId}>Color: {item.colorId.slice(0, 8)}</span> : null}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${item.stock <= 5 ? "border-rose-800/60 bg-rose-950/30 text-rose-200" : "border-emerald-800/60 bg-emerald-950/30 text-emerald-200"}`}>
                          {item.stock} {item.stock === 1 ? "unit" : "units"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${item.isActive ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-200" : "border-slate-600 bg-[#171c24] text-slate-400"}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${item.isActive ? "bg-emerald-300" : "bg-slate-500"}`} aria-hidden="true" />
                          {item.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            disabled={busyVariantId === item.id}
                            className={`rounded-lg border border-slate-600 bg-[#202630] px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 ${item.isActive ? "hover:border-amber-700 hover:bg-amber-950/40 hover:text-amber-200 focus-visible:ring-amber-500" : "hover:border-emerald-700 hover:bg-emerald-950/40 hover:text-emerald-200 focus-visible:ring-emerald-500"}`}
                            onClick={async () => {
                              setBusyVariantId(item.id);
                              setError("");
                              try {
                                await api.saveVariant({ isActive: !item.isActive }, item.id);
                                setItems((current) => current.map((variant) =>
                                  variant.id === item.id ? { ...variant, isActive: !item.isActive } : variant,
                                ));
                                setNote(`Variant ${item.isActive ? "deactivated" : "activated"}.`);
                              } catch (reason) {
                                setError(messageOf(reason, "Could not update variant status"));
                              } finally {
                                setBusyVariantId(null);
                              }
                            }}
                          >
                            {item.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            type="button"
                            disabled={busyVariantId === item.id}
                            className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2.5 py-1.5 text-xs font-medium text-rose-300 transition-colors duration-200 hover:border-rose-700 hover:bg-rose-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 disabled:opacity-50"
                            onClick={async () => {
                              if (!window.confirm(`Delete variant ${item.sku}?`)) return;
                              setBusyVariantId(item.id);
                              setError("");
                              try {
                                const result = await api.deleteVariant(item.id);
                                setNote(result.message);
                                if (result.deactivated) {
                                  setItems((current) => current.map((variant) =>
                                    variant.id === item.id ? { ...variant, isActive: false } : variant,
                                  ));
                                } else {
                                  setItems((current) => current.filter((variant) => variant.id !== item.id));
                                }
                              } catch (reason) {
                                setError(messageOf(reason, "Could not delete variant"));
                              } finally {
                                setBusyVariantId(null);
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Panel>
  );
}
