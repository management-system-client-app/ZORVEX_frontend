import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../api";
import { DetailSkeleton } from "../components/Skeleton";
import { useStore } from "../state";
import type { Color, ProductImage } from "../types";

type SizeRow = { sizeId: string; fabricId: string; colorId: string; stock: string };
type GeneralVariantRow = { optionLabel: string; sku: string; stock: string };
const MAX_PRODUCT_IMAGES = 6;

const fieldClass =
  "h-11 w-full rounded-xl border border-slate-600 bg-[#171c24] px-3 text-sm text-white outline-none transition-all duration-200 ease-out placeholder:text-slate-500 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20";

function messageOf(reason: unknown, fallback: string) {
  if (!(reason instanceof ApiError)) return fallback;
  const detail = reason.errors?.[0]?.message;
  return detail ? `${reason.message}. ${detail}` : reason.message;
}

function ColorImagePicker({
  colors,
  selectedIds,
  previews,
  existingImages,
  disabled,
  onSelect,
  onUpload,
}: {
  colors: Color[];
  selectedIds: string[];
  previews: Record<string, string>;
  existingImages: ProductImage[];
  disabled: boolean;
  onSelect?: (colorId: string) => void;
  onUpload: (colorId: string, files: File[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      {colors.map((color) => {
        const selected = selectedIds.includes(color.id);
        const image = previews[color.id] ?? existingImages.find((photo) => photo.colorId === color.id)?.url;
        return (
          <div key={color.id} className={`flex h-16 w-40 shrink-0 items-center gap-2.5 rounded-xl border px-3 transition-colors duration-200 ease-out ${selected ? "border-amber-600 bg-amber-950/25 hover:bg-amber-950/40" : "border-slate-700 bg-[#171c24] hover:border-slate-500 hover:bg-[#1d232d]"}`}>
            <label className="group relative block h-10 w-10 shrink-0 cursor-pointer" title={`Upload ${color.name} photo`}>
              <span className={`relative block h-10 w-10 shrink-0 overflow-hidden rounded-full border-2 bg-[#171c24] transition-all duration-200 ${selected ? "border-amber-300 ring-2 ring-amber-500/40 group-hover:ring-amber-400/60" : "border-slate-600 hover:border-amber-400 hover:ring-2 hover:ring-slate-600/60"}`}>
                {image ? (
                  <img src={image} alt={`${color.name} color`} className="absolute inset-0 block h-full w-full object-cover" />
                ) : (
                  <span className="absolute inset-0 block h-full w-full" style={{ backgroundColor: color.hexCode }} />
                )}
              </span>
              <span aria-hidden="true" className="absolute right-0 bottom-0 grid h-5 w-5 place-items-center rounded-full border-2 border-[#202630] bg-amber-300 text-sm font-bold leading-none text-amber-950 shadow-md transition-colors duration-200 group-hover:bg-amber-500 group-hover:text-white">+</span>
              <input
                className="sr-only"
                type="file"
                accept="image/avif,image/jpeg,image/png,image/webp"
                multiple
                disabled={disabled}
                aria-label={`Upload ${color.name} photos`}
                onChange={(event) => {
                  onUpload(color.id, [...(event.target.files ?? [])]);
                  event.target.value = "";
                }}
              />
            </label>
            {onSelect ? (
              <button
                type="button"
                aria-pressed={selected}
                className={`min-w-0 flex-1 truncate text-left text-sm font-medium transition-colors duration-200 ${selected ? "text-[#f0c0cf]" : "text-slate-300 hover:text-white"}`}
                onClick={() => onSelect(color.id)}
              >
                {color.name}{selected ? " ✓" : ""}
              </button>
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-200">{color.name}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function AdminProductForm() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const { catalog } = useStore();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [gender, setGender] = useState("UNISEX");
  const [basePrice, setBasePrice] = useState("");
  const [compareAtPrice, setCompareAtPrice] = useState("");
  const [brandId, setBrandId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [inventoryMode, setInventoryMode] = useState<"general" | "apparel">("general");
  const [generalVariants, setGeneralVariants] = useState<GeneralVariantRow[]>([
    { optionLabel: "", sku: "", stock: "0" },
  ]);
  const [rows, setRows] = useState<SizeRow[]>([]);
  const [selectedSizeIds, setSelectedSizeIds] = useState<string[]>([]);
  const [selectedColorIds, setSelectedColorIds] = useState<string[]>([]);
  const [bulkFabricId, setBulkFabricId] = useState("");
  const [colors, setColors] = useState<Color[]>([]);
  const [productColorIds, setProductColorIds] = useState<string[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [imageColorIds, setImageColorIds] = useState<(string | null)[]>([]);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});
  const previewUrls = useRef<string[]>([]);
  const [existingImages, setExistingImages] = useState<ProductImage[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(!editing);
  const selectedCategory = catalog.categories.find((category) => category.id === categoryId);
  const isApparelCategory = selectedCategory && ["men", "women"].includes(selectedCategory.slug);

  useEffect(() => () => previewUrls.current.forEach((url) => URL.revokeObjectURL(url)), []);

  useEffect(() => {
    api.colorList().then(setColors).catch((reason) => {
      setError(messageOf(reason, "Could not load colors"));
    });
  }, []);

  useEffect(() => {
    if (!id) return;
    api
      .product(id)
      .then((product) => {
        setName(product.name);
        setDescription(product.description);
        setStatus(product.status);
        setGender(product.gender);
        setBasePrice(String(product.basePrice));
        setCompareAtPrice(product.compareAtPrice == null ? "" : String(product.compareAtPrice));
        setBrandId(product.brand.id);
        setCategoryId(product.category.id);
        setExistingImages(product.images);
        setProductColorIds([
          ...new Set(product.variants.flatMap((variant) => variant.color ? [variant.color.id] : [])),
        ]);
        setReady(true);
      })
      .catch((reason) => {
        setError(messageOf(reason, "Could not load the product"));
        setReady(true);
      });
  }, [id]);

  function updateRowStock(index: number, stock: string) {
    const numericStock = stock.replace(/\D/g, "");
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, stock: numericStock } : row)));
  }

  function updateGeneralVariant(index: number, key: keyof GeneralVariantRow, value: string) {
    setGeneralVariants((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)),
    );
  }

  function addImages(files: File[], colorId: string | null = null) {
    const available = MAX_PRODUCT_IMAGES - existingImages.length - images.length;
    if (files.length > available) {
      setError(`You can add only ${available} more image${available === 1 ? "" : "s"} to this product.`);
    } else {
      setError("");
    }
    const additions = files.slice(0, available);
    setImages((current) => [...current, ...additions]);
    setImageColorIds((current) => [...current, ...additions.map(() => colorId)]);
    if (colorId && additions[0]) {
      const preview = URL.createObjectURL(additions[0]);
      previewUrls.current.push(preview);
      setImagePreviews((current) => ({ ...current, [colorId]: preview }));
      if (!editing) {
        setSelectedColorIds((current) => current.includes(colorId) ? current : [...current, colorId]);
      }
    }
  }

  const photoColors = editing
    ? colors.filter((color) => productColorIds.includes(color.id))
    : colors.filter((color) => selectedColorIds.includes(color.id));

  function addSelectedCombinations() {
    setError("");
    if (selectedSizeIds.length === 0) {
      setError("Choose at least one size");
      return;
    }
    if (!bulkFabricId) {
      setError("Choose a fabric for these combinations");
      return;
    }

    const colorIds = selectedColorIds.length > 0 ? selectedColorIds : [""];
    const existing = new Set(
      rows
        .filter((row) => row.sizeId && row.fabricId)
        .map((row) => `${row.sizeId}:${row.fabricId}:${row.colorId}`),
    );
    const additions: SizeRow[] = [];
    for (const sizeId of selectedSizeIds) {
      for (const colorId of colorIds) {
        const key = `${sizeId}:${bulkFabricId}:${colorId}`;
        if (existing.has(key)) continue;
        existing.add(key);
        additions.push({ sizeId, fabricId: bulkFabricId, colorId, stock: "" });
      }
    }

    const completeRowCount = rows.filter((row) => row.sizeId && row.fabricId).length;
    if (completeRowCount + additions.length > 30) {
      setError("A product can have at most 30 size, color and fabric combinations.");
      return;
    }
    if (additions.length === 0) {
      setError("These combinations have already been added");
      return;
    }

    setRows((current) => [...current, ...additions]);
  }

  function toggleSelection(selection: string[], value: string, update: (next: string[]) => void) {
    update(selection.includes(value) ? selection.filter((item) => item !== value) : [...selection, value]);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const price = Number(basePrice);
    const compare = compareAtPrice.trim() === "" ? undefined : Number(compareAtPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setError("Price must be greater than 0");
      return;
    }
    if (compare != null && (!Number.isFinite(compare) || compare <= price)) {
      setError("Compare price must be greater than the price");
      return;
    }

    setBusy(true);
    try {
      if (editing && id) {
        await api.updateProduct(id, {
          name: name.trim(),
          description: description.trim(),
          status,
          gender,
          basePrice: price,
          compareAtPrice: compare ?? null,
          brandId,
          categoryId,
        }, images, imageColorIds);
        navigate("/admin/products");
        return;
      }

      const sizes = inventoryMode === "apparel"
        ? rows
            .filter((row) => row.sizeId && row.fabricId)
            .map((row) => ({
              sizeId: row.sizeId,
              fabricId: row.fabricId,
              ...(row.colorId ? { colorId: row.colorId } : {}),
              stock: Number(row.stock) || 0,
            }))
        : undefined;
      const variants = inventoryMode === "general"
        ? generalVariants.map((row) => ({
            optionLabel: row.optionLabel.trim() || "Standard",
            ...(row.sku.trim() ? { sku: row.sku.trim().toUpperCase() } : {}),
            stock: Number(row.stock) || 0,
          }))
        : undefined;
      if (inventoryMode === "apparel" && sizes?.length === 0) {
        setError("Add at least one size and fabric");
        setBusy(false);
        return;
      }

      await api.createProduct(
        {
          name: name.trim(),
          description: description.trim(),
          status,
          gender,
          basePrice: price,
          ...(compare != null ? { compareAtPrice: compare } : {}),
          brandId,
          categoryId,
          ...(sizes ? { sizes } : {}),
          ...(variants ? { variants } : {}),
        },
        images,
        imageColorIds,
      );
      navigate("/admin/products");
    } catch (reason) {
      setError(messageOf(reason, "Could not save the product"));
    } finally {
      setBusy(false);
    }
  }

  if (!ready) return <DetailSkeleton />;

  return (
    <form onSubmit={onSubmit} className="mx-auto w-full space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-emerald-500 bg-[#171c24] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-800/60 bg-emerald-950/30 text-emerald-200">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Product studio</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-100">{editing ? "Edit product" : "Add product"}</h1>
            <p className="mt-0.5 text-xs text-slate-400">{editing ? `Updating ${name || "this listing"} · manage its details and imagery.` : "Build a product listing with pricing, variants and imagery."}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editing ? (
            <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${status === "ACTIVE" ? "border-emerald-800/60 bg-emerald-950/25 text-emerald-200" : status === "DRAFT" ? "border-amber-800/60 bg-amber-950/25 text-amber-200" : "border-slate-600 bg-[#202630] text-slate-300"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status === "ACTIVE" ? "bg-emerald-300" : status === "DRAFT" ? "bg-amber-300" : "bg-slate-400"}`} />
              {status}
            </span>
          ) : null}
          <Link to="/admin/products" className="group inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-[#202630] px-3.5 py-2.5 text-sm font-medium text-slate-200 transition-colors duration-200 hover:border-emerald-700 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
            <span className="transition-transform duration-200 group-hover:-translate-x-0.5"><svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M10 6 4 12l6 6M4 12h16" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
            Back
          </Link>
        </div>
      </header>
      {error ? <p className="rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-emerald-600 bg-[#202630] shadow-sm">
        <div className="border-b border-slate-700 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-700 text-xs font-bold text-white">01</span>
            <h2 className="text-sm font-semibold text-slate-100">Product details</h2>
          </div>
          <p className="mt-1.5 pl-10 text-xs text-slate-400">{editing ? "Keep the product details and listing information up to date." : "Add the core information customers need to find this product."}</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 [&>label>span]:text-slate-400">
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="text-slate-500">Name</span>
          <input className={fieldClass} required minLength={2} value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm sm:col-span-2">
          <span className="text-slate-500">Description</span>
          <textarea
            className={`${fieldClass} h-28 py-2`}
            required
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-slate-500">Price</span>
          <input className={fieldClass} required inputMode="decimal" value={basePrice} onChange={(event) => setBasePrice(event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-slate-500">Compare price</span>
          <input className={fieldClass} inputMode="decimal" value={compareAtPrice} onChange={(event) => setCompareAtPrice(event.target.value)} />
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-slate-500">Category</span>
          <select
            className={fieldClass}
            required
            value={categoryId}
            onChange={(event) => {
              const nextCategory = catalog.categories.find((category) => category.id === event.target.value);
              setCategoryId(event.target.value);
              const isApparel = nextCategory && ["men", "women"].includes(nextCategory.slug);
              setInventoryMode(isApparel ? "apparel" : "general");
              setGender(nextCategory?.slug === "men" ? "MEN" : nextCategory?.slug === "women" ? "WOMEN" : "UNISEX");
            }}
          >
            <option value="">Choose</option>
            {catalog.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1.5 text-sm">
          <span className="text-slate-500">Brand</span>
          <select className={fieldClass} required value={brandId} onChange={(event) => setBrandId(event.target.value)}>
            <option value="">Choose</option>
            {catalog.brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>
        {isApparelCategory ? (
          <label className="grid gap-1.5 text-sm">
            <span className="text-slate-500">Gender</span>
            <select className={fieldClass} value={gender} onChange={(event) => setGender(event.target.value)}>
              <option value="WOMEN">Women</option>
              <option value="MEN">Men</option>
              <option value="KIDS">Kids</option>
              <option value="UNISEX">Unisex</option>
            </select>
          </label>
        ) : null}
        <label className="grid gap-1.5 text-sm">
          <span className="text-slate-500">Status</span>
          <select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
        </div>
      </section>

      {editing ? null : (
        <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-amber-600 bg-[#202630] shadow-sm">
          <div className="border-b border-slate-700 px-5 py-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-700 text-xs font-bold text-white">B</span>
                <h2 className="text-sm font-semibold text-slate-100">Variants & inventory</h2>
              </div>
              <p className="mt-1.5 pl-10 text-xs text-slate-400">Choose sizes and colors, then set stock for each combination.</p>
            </div>
          </div>
          <div className="space-y-5 p-5">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Product option type">
            <button type="button" className={`rounded-lg border px-3 py-2 text-xs font-medium ${inventoryMode === "general" ? "border-amber-400 bg-amber-950/30 text-amber-100" : "border-slate-600 text-slate-300"}`} aria-pressed={inventoryMode === "general"} onClick={() => setInventoryMode("general")}>
              General product
            </button>
            <button type="button" className={`rounded-lg border px-3 py-2 text-xs font-medium ${inventoryMode === "apparel" ? "border-amber-400 bg-amber-950/30 text-amber-100" : "border-slate-600 text-slate-300"}`} aria-pressed={inventoryMode === "apparel"} onClick={() => setInventoryMode("apparel")}>
              Apparel sizes
            </button>
          </div>
          {inventoryMode === "general" ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">Add one inventory option per sellable item, such as a phone storage size, scent, pack size, or a standard item.</p>
              {generalVariants.map((row, index) => (
                <div key={index} className="grid gap-3 rounded-xl border border-slate-700 bg-[#171c24] p-3 sm:grid-cols-[1fr_1fr_110px_auto]">
                  <label className="grid gap-1 text-xs text-slate-400">
                    Option label
                    <input className={fieldClass} placeholder="e.g. 128 GB / Black" value={row.optionLabel} onChange={(event) => updateGeneralVariant(index, "optionLabel", event.target.value)} />
                  </label>
                  <label className="grid gap-1 text-xs text-slate-400">
                    SKU <span className="text-slate-500">(auto-generated if blank)</span>
                    <input className={`${fieldClass} font-mono`} placeholder="e.g. PHONE-128-BLACK" value={row.sku} onChange={(event) => updateGeneralVariant(index, "sku", event.target.value)} />
                  </label>
                  <label className="grid gap-1 text-xs text-slate-400">
                    Stock
                    <input className={fieldClass} type="number" min="0" step="1" value={row.stock} onChange={(event) => updateGeneralVariant(index, "stock", event.target.value)} />
                  </label>
                  <button type="button" className="self-end rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-300 disabled:opacity-40" disabled={generalVariants.length === 1} onClick={() => setGeneralVariants((current) => current.filter((_, rowIndex) => rowIndex !== index))}>
                    Remove
                  </button>
                </div>
              ))}
              <button type="button" className="rounded-lg border border-amber-700/70 px-3 py-2 text-xs font-medium text-amber-100 hover:bg-amber-950/30" onClick={() => setGeneralVariants((current) => [...current, { optionLabel: "", sku: "", stock: "0" }])}>
                + Add another option
              </button>
            </div>
          ) : (
          <div className="space-y-5">
          <div className="space-y-4 border-b border-slate-700 pb-5">
            <div className="flex items-start gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-amber-700 text-xs font-bold text-white">A</span>
              <div>
                <h3 className="text-sm font-semibold text-slate-100">Build combinations</h3>
                <p className="mt-0.5 text-xs text-slate-400">Every selected size is paired with each selected color.</p>
              </div>
            </div>
            <div>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Sizes</p>
              <div className="flex flex-wrap gap-2">
                {catalog.sizes.map((size) => {
                  const selected = selectedSizeIds.includes(size.id);
                  return (
                    <button
                      key={size.id}
                      type="button"
                      aria-pressed={selected}
                      className={`min-w-12 rounded-xl border px-3.5 py-2.5 text-xs transition-colors duration-200 ease-out active:transform-none active:filter-none ${selected ? "border-amber-300 bg-amber-700 font-semibold text-white hover:bg-amber-600" : "border-slate-600 text-slate-300 hover:border-amber-600 hover:bg-slate-700/60 hover:text-white"}`}
                      onClick={() => toggleSelection(selectedSizeIds, size.id, setSelectedSizeIds)}
                    >
                      {size.name}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Colors <span className="font-normal normal-case tracking-normal">(optional)</span></p>
              <ColorImagePicker
                colors={colors}
                selectedIds={selectedColorIds}
                previews={imagePreviews}
                existingImages={existingImages}
                disabled={existingImages.length + images.length >= MAX_PRODUCT_IMAGES}
                onSelect={(colorId) => toggleSelection(selectedColorIds, colorId, setSelectedColorIds)}
                onUpload={(colorId, files) => addImages(files, colorId)}
              />
              {colors.length === 0 ? <span className="mt-2 block text-xs text-slate-400">No colors available. Add colors in Admin → Colors.</span> : null}
            </div>
            <div className="grid gap-2 border-t border-slate-700 pt-4 sm:grid-cols-[1fr_auto]">
              <select className={`${fieldClass} border-slate-600 bg-[#171c24] text-white`} value={bulkFabricId} onChange={(event) => setBulkFabricId(event.target.value)}>
                <option value="">Choose fabric for variants</option>
                {catalog.fabrics.map((fabric) => (
                  <option key={fabric.id} value={fabric.id}>{fabric.name}</option>
                ))}
              </select>
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-amber-700 px-5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 ease-out hover:bg-amber-600 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                onClick={addSelectedCombinations}
              >
                <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M8 3v10M3 8h10" strokeLinecap="round" /></svg>
                Add combinations
              </button>
            </div>
            <p className="text-[11px] text-slate-400">Stock is entered separately for each generated variant below.</p>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-700 text-xs font-bold text-white">B</span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-100">Added combinations</h3>
                  <p className="text-xs text-slate-400">Set stock for each combination selected above.</p>
                </div>
              </div>
              <span className="rounded-full border border-amber-800/50 bg-amber-950/25 px-2.5 py-1 text-xs font-medium text-amber-200">{rows.length} rows</span>
            </div>
            {rows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-amber-800/50 bg-amber-950/10 px-4 py-6 text-center text-sm text-slate-400">
                Select sizes, colors and fabric above, then add combinations.
              </p>
            ) : rows.map((row, index) => {
              const sizeName = catalog.sizes.find((size) => size.id === row.sizeId)?.name || "Choose size";
              const color = colors.find((item) => item.id === row.colorId);
              const fabricName = catalog.fabrics.find((fabric) => fabric.id === row.fabricId)?.name || "No fabric";
              return (
                <div key={index} className="variant-combination-row rounded-xl border border-slate-700 bg-[#171c24] p-3 sm:p-4">
                  <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto]">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-amber-700 text-xs font-semibold text-white">{String(index + 1).padStart(2, "0")}</span>
                      <span className="rounded-lg border border-amber-800/50 bg-amber-950/25 px-2.5 py-1.5 text-xs font-semibold text-amber-100">{sizeName}</span>
                      {color ? (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-800/50 bg-amber-950/20 px-2.5 py-1.5 text-xs text-amber-100">
                          <span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ backgroundColor: color.hexCode }} />
                          {color.name}
                        </span>
                      ) : (
                        <span className="rounded-lg border border-slate-700 bg-[#202630] px-2.5 py-1.5 text-xs text-slate-400">No color</span>
                      )}
                      <span className="rounded-lg border border-amber-800/40 bg-[#202630] px-2.5 py-1.5 text-xs text-amber-100">{fabricName}</span>
                    </div>
                    <label className="variant-stock-panel grid grid-cols-[auto_minmax(100px,140px)] items-center gap-2 rounded-xl border border-amber-800/40 bg-[#202630] px-3 py-2 text-xs font-semibold text-amber-200 transition-colors duration-200 ease-out hover:border-amber-500 hover:bg-amber-950/30">
                      Stock
                      <input
                        className="h-9 w-full rounded-lg border border-slate-600 bg-[#171c24] px-3 text-sm text-white outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-500/20"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        aria-label={`Stock for ${sizeName}${color ? ` ${color.name}` : ""}`}
                        placeholder="0"
                        value={row.stock}
                        onChange={(event) => updateRowStock(index, event.target.value)}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
          )}
          </div>
        </section>

      )}

      {editing && photoColors.length > 0 ? (
        <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-cyan-600 bg-[#202630] shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-700 text-xs font-bold text-white">02</span>
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Color photos</h2>
                <p className="mt-1 text-xs text-slate-400">Add or replace photos assigned to each color on this product.</p>
              </div>
            </div>
            <span className="rounded-full bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200">{photoColors.length} colors</span>
          </div>
          <div className="p-5">
            <ColorImagePicker
              colors={photoColors}
              selectedIds={productColorIds}
              previews={imagePreviews}
              existingImages={existingImages}
              disabled={existingImages.length + images.length >= MAX_PRODUCT_IMAGES}
              onUpload={(colorId, files) => addImages(files, colorId)}
            />
          </div>
        </section>
      ) : null}

      <section className="space-y-4 overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-cyan-600 bg-[#202630] p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-cyan-700 text-xs font-bold text-white">03</span>
              <h2 className="text-sm font-semibold text-slate-100">Product photos</h2>
            </div>
            <p className="mt-2 text-xs text-slate-400">{editing ? "Manage the saved gallery and add new product photos." : `Add up to ${MAX_PRODUCT_IMAGES} images. Photos added here apply to all colors.`}</p>
            <p className="mt-1 text-xs text-slate-400">Use the color circles above to add photos for a specific color.</p>
          </div>
          <span className="rounded-full bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-100">
            {existingImages.length + images.length} / {MAX_PRODUCT_IMAGES} selected
          </span>
        </div>
        <div
          role="progressbar"
          aria-label="Product photos selected"
          aria-valuemin={0}
          aria-valuemax={MAX_PRODUCT_IMAGES}
          aria-valuenow={existingImages.length + images.length}
          className="h-1.5 overflow-hidden rounded-full bg-slate-700"
        >
          <span
            className="block h-full rounded-full bg-cyan-500"
            style={{ width: `${((existingImages.length + images.length) / MAX_PRODUCT_IMAGES) * 100}%` }}
          />
        </div>
        {existingImages.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {existingImages.map((photo) => (
              <div key={photo.id ?? photo.url} className="overflow-hidden rounded-xl border border-slate-600 bg-[#171c24]">
                <img src={photo.url} alt={photo.alt ?? name} className="aspect-square w-full object-cover" />
                <span className="block truncate px-2.5 py-2 text-xs text-slate-300">
                  {photo.colorId ? colors.find((color) => color.id === photo.colorId)?.name ?? "Color image" : "All colors"}
                </span>
              </div>
            ))}
          </div>
        ) : null}
        <label className="relative grid gap-2 rounded-2xl border border-dashed border-cyan-800/60 bg-[#171c24] p-4 text-sm transition-colors duration-200 hover:border-cyan-400 hover:bg-cyan-950/10 has-[:focus-visible]:border-cyan-400 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-cyan-500/30">
          <span className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-cyan-700 text-white">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M12 16V4m0 0 4 4m-4-4L8 8M4 16v4h16v-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold text-slate-100">{existingImages.length > 0 ? "Add more photos" : "Choose product photos"}</span>
              <span className="mt-1 block text-xs leading-relaxed text-slate-400">{MAX_PRODUCT_IMAGES - existingImages.length - images.length} more available · AVIF, JPEG, PNG or WebP</span>
              <span className="mt-1 block text-xs font-semibold text-cyan-300">Click to browse</span>
            </span>
          </span>
          <input
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            type="file"
            accept="image/avif,image/jpeg,image/png,image/webp"
            multiple
            disabled={existingImages.length + images.length >= MAX_PRODUCT_IMAGES}
            onChange={(event) => {
              const chosen = [...(event.target.files ?? [])];
              addImages(chosen);
              event.target.value = "";
            }}
          />
        </label>
        {images.length > 0 ? (
          <ul className="space-y-2">
            {images.map((photo, index) => (
              <li key={`${photo.name}-${photo.lastModified}-${index}`} className="flex items-center gap-3 rounded-xl border border-slate-700 bg-[#171c24] p-2.5">
                <span className="min-w-0 flex-1 truncate text-xs text-slate-200">{photo.name}</span>
                <span className="shrink-0 text-xs text-slate-400">
                  {imageColorIds[index] ? colors.find((color) => color.id === imageColorIds[index])?.name ?? "Color photo" : "All colors"}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-xs text-rose-300"
                  onClick={() => {
                    setImages((current) => current.filter((_, photoIndex) => photoIndex !== index));
                    setImageColorIds((current) => current.filter((_, photoIndex) => photoIndex !== index));
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-700 px-5 text-sm font-semibold text-white shadow-sm transition-colors duration-200 ease-out hover:bg-emerald-600 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#202630] disabled:cursor-wait disabled:opacity-60"
      >
        {!busy ? <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 8.5 6.2 12 13 4.5" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
        {busy ? "Saving…" : editing ? "Update product" : "Add product"}
      </button>
    </form>
  );
}
