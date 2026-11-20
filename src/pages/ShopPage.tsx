import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { api, DATA_REFRESH_INTERVAL } from "../api";
import { ProductGrid } from "../components/ProductCard";
import { ProductGridSkeleton } from "../components/Skeleton";
import { useStore } from "../state";
import type { Color, PageMeta, ProductCardData } from "../types";

const sorts = [
  { id: "latest", label: "Latest" },
  { id: "price_desc", label: "Price high to low" },
  { id: "price_asc", label: "Price low to high" },
  { id: "name_asc", label: "A–Z" },
];

const genders = [
  { id: "WOMEN", label: "Women" },
  { id: "MEN", label: "Men" },
  { id: "KIDS", label: "Kids" },
  { id: "UNISEX", label: "Unisex" },
];

export function ShopPage() {
  const { catalog, categoryImages } = useStore();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const defaultGender = location.pathname === "/women" ? "WOMEN" : undefined;
  const [items, setItems] = useState<ProductCardData[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [colors, setColors] = useState<Color[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const loadedQueryKeyRef = useRef<string | null>(null);
  const [minPrice, setMinPrice] = useState(params.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(params.get("maxPrice") ?? "");

  const query = useMemo(
    () => ({
      status: "ACTIVE",
      limit: "50",
      page: params.get("page") ?? "1",
      sort: params.get("sort") ?? "latest",
      search: params.get("search") ?? undefined,
      categoryId: params.get("categoryId") ?? undefined,
      brandId: params.get("brandId") ?? undefined,
      gender: params.get("gender") ?? defaultGender,
      sizeId: params.get("sizeId") ?? undefined,
      colorId: params.get("colorId") ?? undefined,
      fabricId: params.get("fabricId") ?? undefined,
      minPrice: params.get("minPrice") ?? undefined,
      maxPrice: params.get("maxPrice") ?? undefined,
      inStock: params.get("inStock") === "true" ? "true" : undefined,
    }),
    [params, defaultGender],
  );
  const categoryScopeIds = useMemo(() => {
    if (!query.categoryId) return [];
    const ids = [query.categoryId];
    for (let index = 0; index < ids.length; index += 1) {
      for (const child of catalog.categories) {
        if (child.parentId === ids[index] && child.isActive !== false) ids.push(child.id);
      }
    }
    return ids;
  }, [catalog.categories, query.categoryId]);
  const categoryScopeKey = categoryScopeIds.join("|");

  useEffect(() => {
    let active = true;
    let refreshing = false;
    const refreshColors = async (fresh = false) => {
      if (!active || refreshing) return;
      refreshing = true;
      try {
        const result = await api.colors(fresh);
        if (active) setColors(result);
      } catch (reason) {
        if (active) console.warn("Product colors could not be refreshed", reason);
      } finally {
        refreshing = false;
      }
    };
    void refreshColors();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshColors(true);
    }, DATA_REFRESH_INTERVAL);
    const refreshOnFocus = () => void refreshColors(true);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, []);

  useEffect(() => {
    setMinPrice(params.get("minPrice") ?? "");
    setMaxPrice(params.get("maxPrice") ?? "");
  }, [params]);

  useEffect(() => {
    let active = true;
    const requestKey = JSON.stringify({ query, categoryScopeKey });
    let loadingInitial = loadedQueryKeyRef.current !== requestKey;
    let refreshing = false;
    let refreshQueued = false;

    const loadProducts = async (fresh = false) => {
      if (!active) return;
      if (refreshing) {
        if (fresh) refreshQueued = true;
        return;
      }
      refreshing = true;
      if (loadingInitial) {
        setLoading(true);
        setError("");
      }
      try {
        const productQuery = categoryScopeIds.length > 1
          ? { ...query, categoryId: undefined, categoryIds: categoryScopeIds.join(",") }
          : query;
        const result = await api.products(productQuery, fresh);
        if (!active) return;
        const sameQuery = loadedQueryKeyRef.current === requestKey;
        setItems((current) => {
          if (!sameQuery) return result.items;
          const refreshedIds = new Set(result.items.map((product) => product.id));
          return [...result.items, ...current.filter((product) => !refreshedIds.has(product.id))];
        });
        setMeta(result.meta);
        loadedQueryKeyRef.current = requestKey;
        setError("");
      } catch (reason: unknown) {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Could not load products");
        if (loadingInitial) setItems([]);
      } finally {
        if (active && loadingInitial) {
          loadingInitial = false;
          setLoading(false);
        }
        refreshing = false;
        if (active && refreshQueued) {
          refreshQueued = false;
          void loadProducts(true);
        }
      }
    };

    void loadProducts();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadProducts(true);
    }, DATA_REFRESH_INTERVAL);
    const refreshOnFocus = () => {
      if (document.visibilityState === "visible") void loadProducts(true);
    };
    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("app:products-changed", refreshOnFocus);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("app:products-changed", refreshOnFocus);
    };
  }, [query, categoryScopeKey]);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params);
    if (!value) next.delete(key);
    else next.set(key, value);
    if (key !== "page") next.delete("page");
    setParams(next, { preventScrollReset: true });
    if (key === "page") {
      window.requestAnimationFrame(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function applyPrice(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams(params);
    if (minPrice) next.set("minPrice", minPrice);
    else next.delete("minPrice");
    if (maxPrice) next.set("maxPrice", maxPrice);
    else next.delete("maxPrice");
    next.delete("page");
    setParams(next, { preventScrollReset: true });
    setSheet(false);
  }

  const category = catalog.categories.find((item) => item.id === params.get("categoryId"));
  const categoryProductImages = [...new Set(items
    .map((item) => item.imageUrl)
    .filter((imageUrl): imageUrl is string => Boolean(imageUrl)))];
  const categoryImage = category
    ? categoryImages.get(category.id) ?? category.imageUrl ?? categoryProductImages[0]
    : undefined;
  const heroImage = categoryImage ?? categoryProductImages[0] ?? "/collection-tech.svg";
  const gender = genders.find((item) => item.id === (params.get("gender") ?? defaultGender));
  const crumb = category?.name ?? gender?.label ?? (params.get("search") ? `Search: ${params.get("search")}` : "Shop");
  const activeFilterCount = ["categoryId", "brandId", "gender", "sizeId", "colorId", "fabricId", "minPrice", "maxPrice", "inStock"]
    .filter((key) => params.has(key)).length;
  const fabricsWithProducts = (meta?.total ?? 0) > 0 ? catalog.fabrics : [];
  const pageCount = Math.max(meta?.totalPages ?? 1, 1);
  const firstVisiblePage = Math.min(Math.max((meta?.page ?? 1) - 3, 1), Math.max(pageCount - 6, 1));
  const visiblePages = Array.from({ length: Math.min(pageCount, 7) }, (_, index) => firstVisiblePage + index);

  const filterProps = {
    catalog,
    fabricsWithProducts,
    colors,
    params,
    defaultGender,
    minPrice,
    maxPrice,
    setMinPrice,
    setMaxPrice,
    setParam,
    applyPrice,
    clear: () => {
      const next = new URLSearchParams();
      const search = params.get("search");
      if (search) next.set("search", search);
      setParams(next);
      setSheet(false);
    },
  };

  return (
    <div className="shop-page">
      <p className="crumb">
        <Link to="/">Home</Link> / {crumb}
      </p>
      <header
        className="shop-intro has-category-image"
        style={{ backgroundImage: `linear-gradient(90deg, rgb(12 31 47 / 78%), rgb(12 31 47 / 20%)), url("${heroImage}")` }}
      >
        <div>
          <span>BAZERGRID COLLECTION</span>
          <h1>{crumb}</h1>
          <p>Find your next best-selling product for your store.</p>
        </div>
      </header>
      <div className="shop">
        <aside className="filters">
          <Filters {...filterProps} />
        </aside>
        <div className="shop-results" ref={resultsRef}>
          <div className="shop-bar">
            <button type="button" className="btn-line filter-toggle" onClick={() => setSheet(true)}>
              Filters{activeFilterCount > 0 ? <span>{activeFilterCount}</span> : null}
            </button>
            <span className="shop-result-count">{meta ? <><strong>{meta.total}</strong> {meta.total === 1 ? "product" : "products"} found</> : "Loading products"}</span>
            <select
              className="sort"
              aria-label="Sort products"
              value={params.get("sort") ?? "latest"}
              onChange={(event) => setParam("sort", event.target.value)}
            >
              {sorts.map((sort) => (
                <option key={sort.id} value={sort.id}>
                  {sort.label}
                </option>
              ))}
            </select>
          </div>
          {error ? <p className="error">{error}</p> : null}
          {loading ? <ProductGridSkeleton /> : null}
          {!loading && items.length === 0 && !error ? <p className="empty">Sorry! No result.</p> : null}
          {!loading && items.length > 0 ? <ProductGrid products={items} shopCards /> : null}
          {!loading && meta && meta.total > 50 && items.length > 0 ? (
            <nav className="shop-pagination" aria-label="Product pages">
              <button
                type="button"
                className="page-arrow"
                aria-label="Previous page"
                disabled={meta.page <= 1}
                onClick={() => setParam("page", String(meta.page - 1))}
              >
                ‹
              </button>
              {visiblePages.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  className={pageNumber === meta.page ? "page-number active" : "page-number"}
                  aria-label={`Page ${pageNumber}`}
                  aria-current={pageNumber === meta.page ? "page" : undefined}
                  onClick={() => setParam("page", String(pageNumber))}
                >
                  {pageNumber}
                </button>
              ))}
              <button
                type="button"
                className="page-arrow"
                aria-label="Next page"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setParam("page", String(meta.page + 1))}
              >
                ›
              </button>
            </nav>
          ) : null}
        </div>
      </div>
      {sheet ? (
        <>
          <button className="sheet-back" aria-label="Close filters" onClick={() => setSheet(false)} />
          <div className="sheet filters-sheet" role="dialog" aria-label="Filters">
            <header>
              Filter
              <button type="button" onClick={() => setSheet(false)}>
                Close
              </button>
            </header>
            <div className="sheet-body">
              <Filters {...filterProps} />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function Filters({
  catalog,
  fabricsWithProducts,
  colors,
  params,
  defaultGender,
  minPrice,
  maxPrice,
  setMinPrice,
  setMaxPrice,
  setParam,
  applyPrice,
  clear,
}: {
  catalog: ReturnType<typeof useStore>["catalog"];
  fabricsWithProducts: ReturnType<typeof useStore>["catalog"]["fabrics"];
  colors: Color[];
  params: URLSearchParams;
  defaultGender?: string;
  minPrice: string;
  maxPrice: string;
  setMinPrice: (value: string) => void;
  setMaxPrice: (value: string) => void;
  setParam: (key: string, value: string | null) => void;
  applyPrice: (event: FormEvent) => void;
  clear: () => void;
}) {
  const selected = (key: string) => params.get(key) ?? (key === "gender" ? defaultGender ?? null : null);

  return (
    <div className="filter-panel">
      <header className="filter-panel-heading">
        <div className="filter-panel-title"><span>PERSONALIZE</span><h2>Refine your search</h2></div>
        <button type="button" onClick={clear}>Reset</button>
      </header>
      <FilterList
        title="Category"
        options={catalog.categories.map((item) => ({ id: item.id, label: item.name }))}
        selected={selected("categoryId")}
        onPick={(id) => setParam("categoryId", id)}
      />
      <div className="filter-block">
        <h3>Brand</h3>
        <select
          className="size-filter"
          aria-label="Filter by brand"
          value={selected("brandId") ?? ""}
          onChange={(event) => setParam("brandId", event.target.value || null)}
        >
          <option value="">All brands</option>
          {catalog.brands.map((brand) => (
            <option key={brand.id} value={brand.id}>
              {brand.name}
            </option>
          ))}
        </select>
      </div>
      <FilterList
        title="Gender"
        options={genders.map((item) => ({ id: item.id, label: item.label }))}
        selected={selected("gender")}
        onPick={(id) => setParam("gender", id)}
      />
      <div className="filter-block">
        <h3>Size</h3>
        <select
          className="size-filter"
          aria-label="Filter by size"
          value={selected("sizeId") ?? ""}
          onChange={(event) => setParam("sizeId", event.target.value || null)}
        >
          <option value="">All sizes</option>
          {catalog.sizes.map((size) => (
            <option key={size.id} value={size.id}>
              {size.name}
            </option>
          ))}
        </select>
      </div>
      <div className="filter-block">
        <h3>Color</h3>
        <div className="swatches">
          {colors.map((color) => (
            <button
              key={color.id}
              type="button"
              className={selected("colorId") === color.id ? "swatch on" : "swatch"}
              style={{ background: color.hexCode }}
              aria-label={color.name}
              title={color.name}
              onClick={() => setParam("colorId", selected("colorId") === color.id ? null : color.id)}
            />
          ))}
        </div>
        {selected("colorId") ? <p className="selected-color-name">Selected: {colors.find((color) => color.id === selected("colorId"))?.name}</p> : null}
      </div>
      {fabricsWithProducts.length > 0 ? (
        <FilterList
          title="Fabric"
          options={fabricsWithProducts.map((item) => ({ id: item.id, label: item.name }))}
          selected={selected("fabricId")}
          onPick={(id) => setParam("fabricId", id)}
        />
      ) : null}
      <form className="filter-block" onSubmit={applyPrice}>
        <h3>Price</h3>
        <div className="price-row">
          <input value={minPrice} inputMode="decimal" placeholder="Min" aria-label="Minimum price" onChange={(event) => setMinPrice(event.target.value)} />
          <input value={maxPrice} inputMode="decimal" placeholder="Max" aria-label="Maximum price" onChange={(event) => setMaxPrice(event.target.value)} />
        </div>
        <button className="btn" type="submit" style={{ marginTop: 8 }}>
          Apply
        </button>
      </form>
      <div className="filter-block">
        <label className="check">
          <input
            type="checkbox"
            checked={params.get("inStock") === "true"}
            onChange={(event) => setParam("inStock", event.target.checked ? "true" : null)}
          />
          In stock
        </label>
      </div>
    </div>
  );
}

function FilterList({
  title,
  options,
  selected,
  onPick,
}: {
  title: string;
  options: { id: string; label: string }[];
  selected: string | null;
  onPick: (id: string | null) => void;
}) {
  return (
    <div className="filter-block">
      <h3>{title}</h3>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={selected === option.id ? "choice on" : "choice"}
          onClick={() => onPick(selected === option.id ? null : option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
