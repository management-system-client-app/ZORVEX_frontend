import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { money } from "../format";
import type { MohasagorProduct, PageMeta } from "../types";
import { groupMohasagorProducts } from "../utils/mohasagorCategories";
import { useStore } from "../state";

function imageUrl(path?: string | null): string | null {
  if (!path) return null;
  try {
    return new URL(path, "https://mohasagor.com.bd/").toString();
  } catch {
    return null;
  }
}

function plainText(html?: string | null): string {
  return (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function MohasagorProductsPage() {
  const { catalog } = useStore();
  const [products, setProducts] = useState<MohasagorProduct[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState("");
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);
  const lastRequestAtRef = useRef(0);

  useEffect(() => {
    let active = true;
    if (page === 1) {
      setLoading(true);
      setError("");
    } else {
      setLoadingMore(true);
    }
    const loadPage = async () => {
      if (page > 1) {
        const wait = Math.max(0, 13_000 - (Date.now() - lastRequestAtRef.current));
        if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
      }
      try {
        const result = await api.mohasagorProducts(page, true);
        if (!active) return;
        setProducts((current) => page === 1
          ? result.items
          : [...new Map([...current, ...result.items].map((product) => [product.id, product])).values()]);
        setMeta(result.meta);
        setHasMore(result.meta.page < result.meta.totalPages);
        lastRequestAtRef.current = Date.now();
      } catch (reason: unknown) {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load Mohasagor products");
      } finally {
        if (active) {
          setLoading(false);
          setLoadingMore(false);
          loadingMoreRef.current = false;
        }
      }
    };
    void loadPage();
    return () => { active = false; };
  }, [page]);

  const productGroups = groupMohasagorProducts(products, catalog.categories);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMore || loading || loadingMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !loadingMoreRef.current) {
        loadingMoreRef.current = true;
        setPage((current) => current + 1);
      }
    }, { rootMargin: "700px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loading, loadingMore, page]);

  return (
    <main className="mohasagor-page">
      <header className="mohasagor-heading">
        <div>
          <span>SUPPLIER COLLECTION</span>
          <h1>Mohasagor Products</h1>
          <p>Browse products from our Mohasagor catalog.</p>
        </div>
        {!loading && !error && meta ? <strong>{meta.total.toLocaleString()} products</strong> : null}
      </header>

      {error ? <p className="mohasagor-message error">{error}</p> : null}
      {loading ? <p className="mohasagor-message">Loading products…</p> : null}
      {!loading && !error && products.length === 0 ? <p className="mohasagor-message">No products are available right now.</p> : null}
      {!loading && !error && products.length > 0 ? (
        <div className="mohasagor-categories">
          {productGroups.map((group) => (
            <section className="mohasagor-category-section" key={group.category}>
              <header><h2>{group.category}</h2><span>{group.products.length} products</span></header>
              <div className="mohasagor-grid">
                {group.products.map((product) => {
                  const image = imageUrl(product.product_image?.find((item) => item.product_image)?.product_image ?? product.thumbnail_img);
                  const description = plainText(product.details);
                  const price = product.price;
                  const sizes = [...new Set((product.product_variants ?? [])
                    .filter((option) => /^(size|age)$/i.test(option.attribute?.trim() ?? ""))
                    .map((option) => option.variant?.trim() ?? "")
                    .filter(Boolean))];
                  return (
                    <article className="mohasagor-card" key={product.id}>
                      <div className="mohasagor-card-image">
                        {image ? <img src={image} alt={product.name} loading="lazy" decoding="async" /> : <span>No image</span>}
                      </div>
                      <div className="mohasagor-card-copy">
                        <h2>{product.name}</h2>
                        {description ? <p>{description.slice(0, 150)}{description.length > 150 ? "…" : ""}</p> : null}
                        {sizes.length > 0 ? (
                          <div className="card-sizes" aria-label={`Sizes: ${sizes.join(", ")}`}>
                            <span className="card-sizes-label">Sizes</span>
                            <div className="card-size-list">
                              {sizes.slice(0, 5).map((size) => <span className="card-size-chip" key={size}>{size}</span>)}
                              {sizes.length > 5 ? <span className="card-size-more">+{sizes.length - 5}</span> : null}
                            </div>
                          </div>
                        ) : null}
                        {price != null ? <strong>{money(price)}</strong> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : null}
      {!loading && !error && hasMore ? (
        <div ref={loadMoreRef} className="mohasagor-load-more" aria-live="polite">
          {loadingMore ? "Loading more products…" : "Scroll to load more products"}
        </div>
      ) : null}
    </main>
  );
}
