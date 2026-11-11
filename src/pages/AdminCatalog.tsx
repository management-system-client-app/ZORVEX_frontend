import { FormEvent, Fragment, useEffect, useState } from "react";
import { ApiError, api } from "../api";
import { RowsSkeleton } from "../components/Skeleton";
import { coverImage } from "../format";
import { useStore } from "../state";
import type { AdminHomeBlock, Category, ProductCardData, Settings } from "../types";

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const categoryFieldClass =
  "h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none focus:border-cyan-400";

type CollageSlot = "man" | "woman" | "child" | "accessories";
const COLLAGE_SLOTS: { id: CollageSlot; label: string; setting: keyof Settings }[] = [
  { id: "man", label: "Man", setting: "collageManImageUrl" },
  { id: "woman", label: "Woman", setting: "collageWomanImageUrl" },
  { id: "child", label: "Child", setting: "collageChildImageUrl" },
  { id: "accessories", label: "Accessories", setting: "collageAccessoriesImageUrl" },
];

const KINDS = [
  { id: "BANNER", label: "Slider banner" },
  { id: "CAMPAIGN", label: "Offer banner" },
  { id: "NEW_ARRIVAL", label: "New arrivals" },
  { id: "TRENDING", label: "Trending Now products" },
] as const;

function placementFor(block: AdminHomeBlock, orderedKindBlocks: AdminHomeBlock[]) {
  if (!block.isActive) return "Hidden — not shown on homepage";

  const activeBlocks = orderedKindBlocks.filter((item) => item.isActive);
  const position = activeBlocks.findIndex((item) => item.id === block.id) + 1;

  if (block.kind === "BANNER") return `Top slider · Slide ${position}`;
  if (block.kind === "NEW_ARRIVAL") return "New Collection product row";
  if (block.kind === "TRENDING") return "Trending Now product row";
  if (position <= 2) return `Top-right image ${position}`;
  return "Not displayed on homepage";
}

function messageOf(reason: unknown, fallback: string) {
  if (!(reason instanceof ApiError)) return fallback;
  const detail = reason.errors?.[0]?.message;
  return detail ? `${reason.message}. ${detail}` : reason.message;
}

function parentName(categories: Category[], parentId: string | null) {
  if (!parentId) return "—";
  return categories.find((category) => category.id === parentId)?.name ?? "—";
}

function hasAvailableStock(product: ProductCardData) {
  return product.variants?.some((variant) => variant.stock - (variant.reserved ?? 0) > 0) ?? false;
}

function isVideoUrl(value: string | null | undefined) {
  if (!value) return false;
  return /(\.(mp4|webm|mov|m4v|ogv|avi))(\?.*)?$/i.test(value) || /(?:^|\/)(video|mp4|webm|quicktime)/i.test(value);
}

export function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [image, setImage] = useState<File | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);

  function load() {
    setLoading(true);
    api
      .adminCategories()
      .then(setCategories)
      .catch((reason) => setError(messageOf(reason, "Could not load categories")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  function reset() {
    setEditing(null);
    setName("");
    setDescription("");
    setParentId("");
    setSortOrder("0");
    setIsActive(true);
    setImage(null);
    setCurrentImage(null);
    setFormKey((key) => key + 1);
  }

  function startEdit(category: Category) {
    setEditing(category.id);
    setName(category.name);
    setDescription(category.description ?? "");
    setParentId(category.parentId ?? "");
    setSortOrder(String(category.sortOrder ?? 0));
    setIsActive(category.isActive !== false);
    setImage(null);
    setCurrentImage(category.imageUrl ?? null);
    setError("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api.saveCategory(
        {
          name: name.trim(),
          description: description.trim() || null,
          parentId: parentId || null,
          sortOrder: Number(sortOrder) || 0,
          isActive,
        },
        image,
        editing ?? undefined,
      );
      reset();
      load();
    } catch (reason) {
      setError(messageOf(reason, "Could not save the category"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(category: Category) {
    if (!window.confirm(`Delete ${category.name}?`)) return;
    setError("");
    try {
      await api.deleteCategory(category.id);
      if (editing === category.id) reset();
      load();
    } catch (reason) {
      setError(messageOf(reason, "Could not delete the category"));
    }
  }

  const activeCount = categories.filter((category) => category.isActive !== false).length;
  const hiddenCount = categories.length - activeCount;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-cyan-500 bg-[#171c24] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-cyan-800/60 bg-cyan-950/30 text-cyan-200">
            <Icon d="M4 5h7v7H4V5zm9 0h7v7h-7V5zM4 14h7v5H4v-5zm9 0h7v5h-7v-5z" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-300">Catalog structure</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Categories</h1>
            <p className="mt-0.5 text-xs text-slate-400">Organize products into clear collections</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-[#202630] px-3 py-1.5 text-xs font-medium text-slate-300"><Icon d="M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v5H4zM13 14h7v5h-7z" />{loading ? "Loading…" : `${categories.length} total`}</span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-800/60 bg-emerald-950/25 px-3 py-1.5 text-xs font-medium text-emerald-200"><Icon d="m5 12 4 4L19 6" />{activeCount} active</span>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-900/60 bg-rose-950/25 px-3 py-1.5 text-xs font-medium text-rose-200"><Icon d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A11 11 0 0 1 12 5c5 0 8.5 4.5 9 7-.2 1.1-.9 2.2-1.8 3.2M6.2 6.2C4.4 7.4 3.3 9.3 3 12c.5 2.5 4 7 9 7 1 0 2-.2 2.9-.6" />{hiddenCount} hidden</span>
        </div>
      </header>
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <form key={formKey} onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-slate-700 border-t-2 border-t-cyan-600 bg-[#202630] p-4 shadow-sm lg:sticky lg:top-4 lg:self-start">
        <div className="mb-1 flex items-center gap-2 border-b border-slate-700 pb-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-800 text-xs font-bold text-white">01</span>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">{editing ? "Edit category" : "Add category"}</h2>
            <p className="mt-0.5 text-[11px] text-slate-400">{editing ? "Update this collection" : "Create a product collection"}</p>
          </div>
        </div>
        <label className="block text-xs text-slate-300">
          Name
          <input className={`${categoryFieldClass} mt-1`} required minLength={2} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="block text-xs text-slate-300">
          Parent
          <select className={`${categoryFieldClass} mt-1`} value={parentId} onChange={(event) => setParentId(event.target.value)}>
            <option value="">None</option>
            {categories
              .filter((category) => category.id !== editing)
              .map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                  {category.isActive === false ? " (hidden)" : ""}
                </option>
              ))}
          </select>
        </label>
        <label className="block text-xs text-slate-300">
          Description
          <textarea className={`${categoryFieldClass} mt-1 h-20 resize-y py-2`} value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <label className="block text-xs text-slate-300">
          Sort
          <input className={`${categoryFieldClass} mt-1`} inputMode="numeric" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
        </label>
        <label className="block text-xs text-slate-300">
          Image
          <span className="relative mt-1.5 flex min-h-[76px] items-center gap-3 rounded-2xl border border-dashed border-cyan-800/60 bg-[#171c24] p-3 transition-colors duration-200 hover:border-cyan-400 hover:bg-cyan-950/10 has-[:focus-visible]:border-cyan-400 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cyan-500/30">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-700 text-white">
              <Icon d="M12 16V4m0 0 4 4m-4-4L8 8M4 16v4h16v-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-100">{image?.name ?? (currentImage ? "Replace current image" : "Choose category image")}</span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-400">AVIF, JPEG, PNG or WebP</span>
              <span className="mt-1 block text-xs font-semibold text-cyan-300">Click to browse</span>
            </span>
            <input
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              type="file"
              accept="image/avif,image/jpeg,image/png,image/webp"
              aria-label="Choose category image"
              onChange={(event) => {
                const input = event.currentTarget;
                setImage(input.files?.[0] ?? null);
                setError("");
                input.value = "";
              }}
            />
          </span>
        </label>
        {currentImage ? <img src={currentImage} alt="" className="h-28 w-full rounded-xl border border-slate-700 bg-[#171c24] object-cover" /> : null}
        <label className={`inline-flex w-fit items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors ${isActive ? "border-emerald-800/60 bg-emerald-950/25 text-emerald-200 hover:border-emerald-600" : "border-slate-600 bg-[#171c24] text-slate-300 hover:border-slate-400"}`}>
          <input className="h-3.5 w-3.5 accent-emerald-500" type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-slate-500"}`} />
          Active
        </label>
        {error ? <p className="text-sm text-rose-700">{error}</p> : null}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-cyan-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#202630] disabled:opacity-50">
            {!busy ? <Icon d="M12 5v14m-7-7h14" /> : null}
            {busy ? "Saving…" : editing ? "Update" : "Add"}
          </button>
          {editing ? (
            <button type="button" className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 transition-colors duration-200 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d39aac] focus-visible:ring-offset-2 focus-visible:ring-offset-[#202630]" onClick={reset}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-cyan-600 bg-[#202630] shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-700 px-4 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-cyan-800/50 bg-cyan-950/25 text-cyan-200"><Icon d="M4 5h7v7H4V5zm9 0h7v7h-7V5zM4 14h7v5H4v-5zm9 0h7v5h-7v-5z" /></span>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Category directory</h2>
              <p className="mt-0.5 text-xs text-slate-400">Parent relationships and visibility</p>
            </div>
          </div>
          <span className="rounded-lg border border-slate-600 bg-[#171c24] px-2.5 py-1 text-xs text-slate-300">{categories.length} entries</span>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-[#171c24] text-xs tracking-wide text-slate-400 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium"><span className="inline-flex items-center gap-1.5"><Icon d="M4 5h7v7H4V5zm9 0h7v7h-7V5zM4 14h7v5H4v-5zm9 0h7v5h-7v-5z" />Category</span></th>
              <th className="px-4 py-3 font-medium"><span className="inline-flex items-center gap-1.5"><Icon d="M4 5h6v6H4zM14 13h6v6h-6zM10 8h4v8h-4" />Parent</span></th>
              <th className="px-4 py-3 text-right font-medium"><span className="inline-flex items-center justify-end gap-1.5"><Icon d="M4 6h16M4 12h16M4 18h16" />Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={3} className="p-4"><RowsSkeleton rows={5} columns={3} /></td></tr> : categories.map((category) => (
              <tr key={category.id} className="border-t border-slate-700 transition-colors duration-200 hover:bg-slate-700/30">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {category.imageUrl ? (
                      <img src={category.imageUrl} alt="" className="h-10 w-10 rounded-lg border border-slate-600 object-cover" />
                    ) : (
                      <span className="grid h-10 w-10 place-items-center rounded-lg border border-slate-600 bg-slate-700 text-xs font-semibold text-slate-200">
                        {category.name.slice(0, 1)}
                      </span>
                    )}
                    <span>
                      <span className="block font-medium text-slate-100">{category.name}</span>
                      <span className={`mt-1 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${category.isActive === false ? "border-rose-500/30 bg-rose-500/10 text-rose-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${category.isActive === false ? "bg-rose-400" : "bg-emerald-400"}`} />
                        {category.isActive === false ? "Hidden" : "Active"}
                      </span>
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-300">{parentName(categories, category.parentId)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-600 bg-[#202630] px-3 text-sm font-medium text-slate-300 transition-colors duration-200 hover:border-cyan-700 hover:bg-cyan-950/40 hover:text-cyan-200"
                      onClick={() => startEdit(category)}
                    >
                      <Icon d="m15 5 4 4M4 20l4.5-1 10.2-10.2a2.1 2.1 0 0 0-3-3L5.5 16 4 20z" />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 text-sm font-medium text-rose-300 transition-colors duration-200 hover:border-rose-700 hover:bg-rose-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#202630]"
                      onClick={() => remove(category)}
                    >
                      <Icon d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" />
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && categories.length === 0 && !error ? <div className="px-4 py-12 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-slate-700 bg-[#171c24] text-slate-400"><Icon d="M4 5h7v7H4V5zm9 0h7v7h-7V5zM4 14h7v5H4v-5zm9 0h7v5h-7v-5z" /></span><p className="mt-3 text-sm font-medium text-slate-200">No categories yet</p><p className="mt-1 text-xs text-slate-400">Create a category to organize your products.</p></div> : null}
      </section>
      </div>
    </div>
  );
}

export function AdminBanners() {
  const { settings, updateSettings } = useStore();
  const [blocks, setBlocks] = useState<AdminHomeBlock[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [kind, setKind] = useState<(typeof KINDS)[number]["id"]>("BANNER");
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [isActive, setIsActive] = useState(true);
  const [image, setImage] = useState<File | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [collageFiles, setCollageFiles] = useState<Record<CollageSlot, File | null>>({
    man: null,
    woman: null,
    child: null,
    accessories: null,
  });
  const [collageUploading, setCollageUploading] = useState<CollageSlot | null>(null);
  const [collageError, setCollageError] = useState("");
  const [collageNote, setCollageNote] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<ProductCardData[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<ProductCardData[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [formKey, setFormKey] = useState(0);

  function load() {
    setLoading(true);
    api.homeBlocks().then(setBlocks).catch((reason) => setError(messageOf(reason, "Could not load banners"))).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    api.adminCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (kind !== "TRENDING") return;
    let active = true;
    api.products({
      status: "ACTIVE",
      inStock: true,
      search: productSearch.trim() || undefined,
      limit: 100,
      page: 1,
    })
      .then(({ items }) => {
        if (active) setProductOptions(items.filter(hasAvailableStock));
      })
      .catch((reason) => {
        if (active) setError(messageOf(reason, "Could not load products"));
      });
    return () => {
      active = false;
    };
  }, [kind, productSearch]);

  function reset() {
    setEditing(null);
    setKind("BANNER");
    setTitle("");
    setSubtitle("");
    setLinkUrl("");
    setCategoryId("");
    setSortOrder("0");
    setIsActive(true);
    setImage(null);
    setCurrentImage(null);
    setProductSearch("");
    setSelectedProducts([]);
    setFormKey((key) => key + 1);
  }

  function startEdit(block: AdminHomeBlock) {
    setEditing(block.id);
    setKind(block.kind);
    setTitle(block.title);
    setSubtitle(block.subtitle ?? "");
    setLinkUrl(block.linkUrl ?? "");
    setCategoryId(block.categoryId ?? "");
    setSortOrder(String(block.sortOrder));
    setIsActive(block.isActive);
    setImage(null);
    setCurrentImage(block.imageUrl);
    setProductSearch("");
    setSelectedProducts(block.products ?? []);
    setError("");
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if ((kind === "BANNER" || kind === "CAMPAIGN") && !image && !currentImage) {
      setError("Add an image for this banner");
      return;
    }
    setBusy(true);
    try {
      await api.saveHomeBlock(
        {
          kind,
          title: title.trim(),
          subtitle: subtitle.trim() || null,
          linkUrl: linkUrl.trim() || null,
          categoryId: categoryId || null,
          productIds: kind === "TRENDING" ? selectedProducts.map((product) => product.id) : [],
          sortOrder: Number(sortOrder) || 0,
          isActive,
        },
        image,
        editing ?? undefined,
      );
      reset();
      load();
    } catch (reason) {
      setError(messageOf(reason, "Could not save the banner"));
    } finally {
      setBusy(false);
    }
  }

  async function remove(block: AdminHomeBlock) {
    if (!window.confirm(`Delete ${block.title}?`)) return;
    setError("");
    try {
      await api.deleteHomeBlock(block.id);
      if (editing === block.id) reset();
      load();
    } catch (reason) {
      setError(messageOf(reason, "Could not delete the banner"));
    }
  }

  const activeBannerCount = blocks.filter((block) => block.isActive).length;
  const hiddenBannerCount = blocks.length - activeBannerCount;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-amber-500 bg-[#171c24] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-amber-800/60 bg-amber-950/30 text-amber-200">
            <Icon d="M4 6h16v12H4V6zm2 2v8l5-3 5 3V8H6z" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-300">Homepage content</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Banners & campaigns</h1>
            <p className="mt-0.5 text-xs text-slate-400">Control the visual stories and product features on your storefront</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-[#202630] px-3 py-1.5 text-xs font-medium text-slate-300"><Icon d="M4 5h16v14H4zM8 9h8M8 13h8" />{loading ? "Loading…" : `${blocks.length} total`}</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-emerald-800/60 bg-emerald-950/25 px-3 py-1.5 text-xs font-medium text-emerald-200"><Icon d="m5 12 4 4L19 6" />{activeBannerCount} active</span>
          <span className="inline-flex items-center gap-2 rounded-lg border border-rose-900/60 bg-rose-950/25 px-3 py-1.5 text-xs font-medium text-rose-200"><Icon d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A10.8 10.8 0 0 1 12 5c5 0 8.5 5 8.5 7s-1.3 3.2-2.6 4.4M6.2 6.2C3.8 7.7 2.5 10 2.5 12c0 2 3.5 7 9.5 7 1 0 2-.2 2.8-.5" />{hiddenBannerCount} hidden</span>
        </div>
      </header>
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
      <form key={formKey} onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-slate-700 border-t-2 border-t-amber-600 bg-[#202630] p-4 shadow-sm lg:sticky lg:top-4 lg:self-start">
        <div className="mb-1 flex items-center gap-2 border-b border-slate-700 pb-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-700 text-xs font-bold text-white">01</span>
          <div>
            <h2 className="text-sm font-semibold text-slate-100">{editing ? "Edit banner" : "Add banner"}</h2>
            <p className="mt-0.5 text-[11px] text-slate-400">{editing ? "Update this homepage feature" : "Create a homepage feature"}</p>
          </div>
        </div>
        <label className="block text-xs text-slate-300">
          Type
          <select className="mt-1 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none focus:border-amber-400" value={kind} onChange={(event) => setKind(event.target.value as (typeof KINDS)[number]["id"])}>
            {KINDS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {kind === "CAMPAIGN" ? (
          <p className="rounded-xl border border-slate-700 bg-[#171c24] p-3 text-xs leading-relaxed text-slate-400">
            The first two active offer banners by Sort order appear as the two images beside the top slider. Additional offer banners are not displayed on the homepage.
          </p>
        ) : null}
        {kind === "TRENDING" ? (
          <div className="space-y-2 rounded-xl border border-slate-700 bg-[#171c24] p-3">
            <p className="text-xs leading-relaxed text-slate-400">Choose up to 24 active products with available stock. They will appear in Trending Now in the order selected.</p>
            <input
              className="h-11 w-full rounded-xl border-2 border-slate-600 bg-[#202630] px-4 text-sm text-white outline-none focus:border-amber-400"
              placeholder="Search products"
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
            />
            {selectedProducts.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-200">Selected ({selectedProducts.length}/24)</p>
                {selectedProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1 text-xs text-slate-200 hover:bg-slate-800">
                    <span className="truncate">{product.name}</span>
                    <button
                      type="button"
                      className="shrink-0 rounded-md px-2 py-1 text-rose-300 transition-colors hover:bg-rose-500/10 hover:text-rose-200"
                      onClick={() => setSelectedProducts((selected) => selected.filter((item) => item.id !== product.id))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="max-h-44 space-y-1 overflow-y-auto">
              {productOptions.map((product) => {
                const selected = selectedProducts.some((item) => item.id === product.id);
                return (
                  <label key={product.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800">
                    <input
                      className="accent-amber-400"
                      type="checkbox"
                      checked={selected}
                      disabled={!selected && selectedProducts.length >= 24}
                      onChange={(event) =>
                        setSelectedProducts((current) =>
                          event.target.checked
                            ? [...current, product]
                            : current.filter((item) => item.id !== product.id),
                        )
                      }
                    />
                    <span className="truncate">{product.name}</span>
                  </label>
                );
              })}
              {productOptions.length === 0 ? <p className="px-2 py-1 text-xs text-slate-400">No available products found.</p> : null}
            </div>
          </div>
        ) : null}
        <label className="block text-xs text-slate-300">
          Title
          <input className="mt-1 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none focus:border-amber-400" required minLength={2} value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="block text-xs text-slate-300">
          Subtitle
          <input className="mt-1 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none focus:border-amber-400" value={subtitle} onChange={(event) => setSubtitle(event.target.value)} />
        </label>
        <label className="block text-xs text-slate-300">
          Link
          <input className="mt-1 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-amber-400" placeholder="/shop" value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} />
        </label>
        <label className="block text-xs text-slate-300">
          Category
          <select className="mt-1 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none focus:border-amber-400" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
            <option value="">None</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-slate-300">
          Sort
          <input className="mt-1 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none focus:border-amber-400" inputMode="numeric" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} />
        </label>
        {kind !== "TRENDING" ? (
          <label className="block text-xs text-slate-300">
            Image or video
            <span className="relative mt-1.5 flex min-h-[76px] items-center gap-3 rounded-2xl border border-dashed border-amber-700/50 bg-[#171c24] p-3 transition-colors duration-200 hover:border-amber-400 hover:bg-amber-950/15 has-[:focus-visible]:border-amber-400 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-500/30">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-700 text-white">
                <Icon d="M12 16V4m0 0 4 4m-4-4L8 8M4 16v4h16v-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-100">{image?.name ?? (currentImage ? "Replace current media" : "Add banner")}</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-400">Images: AVIF, JPEG, PNG, WebP  Videos: MP4, WebM, MOV</span>
                <span className="mt-1 block text-xs font-semibold text-amber-300">Click to browse</span>
              </span>
              <input
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                type="file"
                accept="image/*,video/*"
                aria-label="Choose banner image or video"
                onChange={(event) => {
                  const input = event.currentTarget;
                  const file = input.files?.[0];
                  setImage(file ?? null);
                  setError("");
                  input.value = "";
                }}
              />
            </span>
          </label>
        ) : null}
        {currentImage ? (
          isVideoUrl(currentImage) ? (
            <video src={currentImage} controls className="h-28 w-full rounded-xl border border-slate-700 bg-[#171c24] object-contain" />
          ) : (
            <img src={currentImage} alt="" className="h-28 w-full rounded-xl border border-slate-700 bg-[#171c24] object-contain" />
          )
        ) : null}
        <label className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-600 bg-[#171c24] px-2.5 py-1 text-[11px] font-medium text-slate-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
          <input className="h-3.5 w-3.5 accent-amber-400" type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-emerald-400" : "bg-slate-500"}`} />
          Active
        </label>
        {error ? <p className="rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p> : null}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#202630] disabled:opacity-50">
            {busy ? "Saving…" : editing ? "Update" : "Add"}
          </button>
          {editing ? (
            <button type="button" className="rounded-xl border border-slate-600 px-4 py-2 text-sm text-slate-200 transition-colors duration-200 hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#202630]" onClick={reset}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-[#202630] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg border border-amber-700/50 bg-amber-950/30 text-amber-200"><Icon d="M4 6h16v12H4V6zm2 2v8l5-3 5 3V8H6z" /></span>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Banner library</h2>
              <p className="text-[11px] text-slate-400">Sorted by homepage placement</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-[#171c24] px-2.5 py-1 text-xs text-slate-300"><Icon d="M4 5h16v14H4zM8 9h8M8 13h8" />{blocks.length} items</span>
        </div>
        {loading ? <RowsSkeleton rows={5} columns={2} /> : null}
        {!loading && blocks.length === 0 && !error ? (
          <p className="rounded-2xl border border-slate-700 bg-[#202630] px-4 py-8 text-sm text-slate-400">
            No banners yet. Add a slider banner to show it on the home page.
          </p>
        ) : null}
        {!loading && KINDS.map((item) => {
          const group = blocks
            .filter((block) => block.kind === item.id)
            .sort((first, second) => first.sortOrder - second.sortOrder);
          if (group.length === 0 && item.id !== "CAMPAIGN") return null;

          return (
            <Fragment key={item.id}>
              {group.length > 0 ? (
                <section className="overflow-hidden rounded-2xl border border-slate-700 bg-[#202630] shadow-sm">
                  <header className="border-b border-slate-700 border-l-2 border-l-amber-500 bg-[#171c24] px-4 py-3">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                      <span className="text-amber-300"><Icon d={item.id === "BANNER" ? "M4 6h16v12H4V6zm2 2v8l5-3 5 3V8H6z" : item.id === "TRENDING" ? "M3 3v18h18M7 14l4-4 4 3 6-7" : item.id === "NEW_ARRIVAL" ? "M12 3v18m9-9H3m15.4-6.4-12.8 12.8m0-12.8 12.8 12.8" : "M12 3l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z"} /></span>
                      {item.label}
                    </h2>
                  </header>
                  <div className="divide-y divide-slate-700">
                    {group.map((block) => (
                      <article key={block.id} className="flex flex-wrap items-center gap-3 p-4 transition-colors duration-200 hover:bg-slate-700/20">
                        {block.imageUrl ? (
                          isVideoUrl(block.imageUrl) ? (
                            <video src={block.imageUrl} muted className="h-16 w-24 shrink-0 rounded-lg border border-slate-700 bg-[#171c24] object-contain" />
                          ) : (
                            <img src={block.imageUrl} alt="" className="h-16 w-24 shrink-0 rounded-lg border border-slate-700 bg-[#171c24] object-contain" />
                          )
                        ) : block.kind === "TRENDING" && block.products?.[0] && coverImage(block.products[0]) ? (
                          <img
                            src={coverImage(block.products[0]) ?? ""}
                            alt={block.products[0].name}
                            className="h-16 w-24 shrink-0 rounded-lg border border-slate-700 bg-[#171c24] object-contain"
                          />
                        ) : (
                          <span className="grid h-16 w-24 shrink-0 place-items-center rounded-lg border border-slate-700 bg-[#171c24] text-xs text-slate-400">
                            {block.productIds.length} products
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-100">{block.title}</p>
                          <p className="mt-1 text-xs font-medium text-[#f0c0cf]">
                            {placementFor(block, group)}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#d39aac]/20 bg-[#7b3f55]/8 px-2 py-0.5 text-[10px] font-medium text-[#e9c5d1]">
                              <span className="h-1.5 w-1.5 rounded-full bg-[#d39aac]" />
                              Sort {block.sortOrder}
                            </span>
                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${block.isActive ? "border-emerald-500/20 bg-emerald-500/8 text-emerald-200" : "border-rose-500/20 bg-rose-500/8 text-rose-200"}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${block.isActive ? "bg-emerald-400" : "bg-rose-400"}`} />
                              {block.isActive ? "Active" : "Hidden"}
                            </span>
                            {block.kind === "TRENDING" ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600 bg-[#202630] px-2 py-0.5 text-[10px] font-medium text-slate-300">
                                {block.productIds.length} selected
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="ml-auto flex shrink-0 gap-2 text-sm">
                          <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-600 bg-[#202630] px-3 text-sm font-medium text-slate-300 transition-colors duration-200 hover:border-amber-700 hover:bg-amber-950/40 hover:text-amber-200" onClick={() => startEdit(block)}>
                            <Icon d="m15 5 4 4M4 20l4.5-1 10.2-10.2a2.1 2.1 0 0 0-3-3L5.5 16 4 20z" />
                            Edit
                          </button>
                          <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 text-sm font-medium text-rose-300 transition-colors duration-200 hover:border-rose-700 hover:bg-rose-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#202630]" onClick={() => remove(block)}>
                            <Icon d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" />
                            Delete
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
              {item.id === "CAMPAIGN" ? (
                <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-amber-600 bg-[#202630] p-4 shadow-sm">
                  <header className="mb-4 flex items-center gap-3 border-b border-slate-700 pb-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-700 text-xs font-bold text-white">02</span>
                    <div>
                      <h2 className="text-sm font-semibold text-slate-100">Category collage images</h2>
                      <p className="mt-1 text-xs text-slate-400">Upload separate images for Man, Woman, Child, and Accessories.</p>
                    </div>
                  </header>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {COLLAGE_SLOTS.map(({ id, label, setting }) => (
                      <div key={id} className="space-y-2 rounded-xl border border-slate-700 bg-[#171c24] p-3 transition-colors duration-200 hover:border-amber-800/60">
                        <p className="text-sm font-medium text-slate-100">{label}</p>
                        {settings[setting] ? (
                          <img src={settings[setting] ?? ""} alt={`${label} collage`} className="h-28 w-full rounded-lg border border-slate-700 bg-[#10151c] object-cover" />
                        ) : (
                          <div className="grid h-28 place-items-center rounded-lg border border-dashed border-slate-700 bg-[#202630] text-xs text-slate-400">No image uploaded</div>
                        )}
                        <div className="space-y-1">
                          <label className="relative flex min-h-10 items-center gap-2 rounded-lg border border-dashed border-slate-600 bg-[#202630] px-2.5 py-2 transition-colors duration-200 hover:border-amber-400 hover:bg-amber-950/20 has-[:focus-visible]:border-amber-400 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-amber-500/30">
                            <span className="text-amber-300"><Icon d="M12 16V4m0 0 4 4m-4-4L8 8M4 16v4h16v-4" /></span>
                            <span className="min-w-0 truncate text-xs text-slate-300">{collageFiles[id]?.name ?? "Choose an image"}</span>
                            <input
                              type="file"
                              accept="image/avif,image/jpeg,image/png,image/webp"
                              aria-label={`Choose ${label} collage image`}
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                              onChange={(event) => setCollageFiles((files) => ({ ...files, [id]: event.target.files?.[0] ?? null }))}
                            />
                          </label>
                        </div>
                        <button
                          type="button"
                          disabled={!collageFiles[id] || collageUploading !== null}
                          className="rounded-xl bg-amber-700 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-amber-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#171c24] disabled:opacity-50"
                          onClick={() => {
                            const file = collageFiles[id];
                            if (!file) return;
                            setCollageError("");
                            setCollageNote("");
                            setCollageUploading(id);
                            api.uploadCollageImage(id, file)
                              .then(({ imageUrl }) => {
                                updateSettings({ ...settings, [setting]: imageUrl });
                                setCollageFiles((files) => ({ ...files, [id]: null }));
                                setCollageNote(`${label} collage image saved`);
                              })
                              .catch((reason) => setCollageError(messageOf(reason, `Could not save ${label.toLowerCase()} image`)))
                              .finally(() => setCollageUploading(null));
                          }}
                        >
                          {collageUploading === id ? "Uploading…" : "Upload image"}
                        </button>
                      </div>
                    ))}
                  </div>
                  {collageError ? <p className="mt-3 rounded-lg border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{collageError}</p> : null}
                  {collageNote ? <p className="mt-3 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{collageNote}</p> : null}
                </section>
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </div>
    </div>
  );
}
