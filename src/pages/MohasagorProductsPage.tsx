import { useEffect, useState } from "react";
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
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api.mohasagorProducts(page, true)
      .then((result) => {
        if (!active) return;
        setProducts(result.items);
        setMeta(result.meta);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Could not load Mohasagor products");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page]);

  const firstVisiblePage = meta
    ? Math.max(1, Math.min(page - 2, Math.max(1, meta.totalPages - 4)))
    : 1;
  const visiblePages = meta
    ? Array.from({ length: Math.min(5, meta.totalPages) }, (_, index) => firstVisiblePage + index)
    : [];
  const productGroups = groupMohasagorProducts(products, catalog.categories);

  return (
    <main className="mohasagor-page">
      <header className="mohasagor-heading">
        <div>
          <span>SUPPLIER COLLECTION</span>
          <h1>Mohasagor Products</h1>
          <p>Browse products from our Mohasagor catalog.</p>
        </div>
        {!loading && !error && meta ? <strong>{meta.total.toLocaleString()} products · Page {meta.page} of {meta.totalPages}</strong> : null}
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
                  const price = product.reselling_price ?? product.price ?? product.sale_price;
                  return (
                    <article className="mohasagor-card" key={product.id}>
                      <div className="mohasagor-card-image">
                        {image ? <img src={image} alt={product.name} loading="lazy" decoding="async" /> : <span>No image</span>}
                      </div>
                      <div className="mohasagor-card-copy">
                        <h2>{product.name}</h2>
                        {description ? <p>{description.slice(0, 150)}{description.length > 150 ? "…" : ""}</p> : null}
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
      {!loading && !error && meta && meta.totalPages > 1 ? (
        <nav className="mohasagor-pagination" aria-label="Mohasagor product pages">
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
          {visiblePages.map((number) => (
            <button
              type="button"
              key={number}
              className={number === page ? "on" : ""}
              aria-current={number === page ? "page" : undefined}
              onClick={() => setPage(number)}
            >
              {number}
            </button>
          ))}
          <button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
        </nav>
      ) : null}
    </main>
  );
}
