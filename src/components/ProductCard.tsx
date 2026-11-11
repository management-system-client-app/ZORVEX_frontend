import { useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { coverImage, money, productFlags } from "../format";
import { recordRecentlyViewed } from "../recentlyViewed";
import type { ProductCardData } from "../types";

export function ProductCard({
  product,
  showAvailableStock = false,
  dealCard = false,
  shopCard = false,
}: {
  product: ProductCardData;
  showAvailableStock?: boolean;
  dealCard?: boolean;
  shopCard?: boolean;
}) {
  const image = coverImage(product);
  const flags = productFlags(product);
  const discount = flags.compare != null ? Math.round(((flags.compare - flags.price) / flags.compare) * 100) : null;
  const savings = flags.compare != null ? flags.compare - flags.price : 0;
  const availableStock =
    product.variants?.reduce((total, variant) => total + Math.max(variant.stock - (variant.reserved ?? 0), 0), 0) ?? 0;
  const soldOut = Boolean(product.variants?.length) && availableStock === 0;
  return (
    <article className={`card${dealCard ? " deal-card" : ""}${shopCard ? " shop-product-card" : ""}`}>
      <Link to={`/product/${product.id}`} onClick={() => recordRecentlyViewed(product.id, product)}>
        <div className={`card-photo${shopCard ? " shop-card-media" : ""}`}>
          {image ? (
            <img className="product-image" src={image} alt={product.name} loading="lazy" decoding="async" />
          ) : <div className="photo-fallback" />}
          {dealCard ? (
            savings > 0 || flags.isNew || soldOut ? (
              <div className="deal-card-badges">
                {savings > 0 ? <span className="deal-savings">Save {money(savings)} ↓</span> : null}
                {flags.isNew || soldOut ? (
                  <div className="flags">
                    {soldOut ? <span className="flag sold-out-flag">Sold out</span> : null}
                    {flags.isNew ? <span className="flag">New</span> : null}
                  </div>
                ) : null}
              </div>
            ) : null
          ) : flags.isNew || flags.onSale || soldOut ? (
            <div className="flags">
              {soldOut ? <span className="flag sold-out-flag">Sold out</span> : null}
              {flags.isNew ? <span className="flag">New</span> : null}
              {flags.onSale ? <span className="flag sale-flag">{discount ? `-${discount}%` : "Sale"}</span> : null}
            </div>
          ) : null}
        </div>
        <div className={`card-copy${shopCard ? " shop-card-info" : ""}`}>
          {shopCard && product.category?.name ? <span className="shop-card-category">{product.category.name}</span> : null}
          {product.brand?.name ? <span className="card-brand">{product.brand.name}</span> : null}
          <h3>{product.name}</h3>
        {shopCard ? (
          <div className="shop-card-price-row">
            <p className="price">
              {money(flags.price)}
              {flags.compare != null ? <s>{money(flags.compare)}</s> : null}
            </p>
            <span className="shop-card-open" aria-hidden="true"><ArrowUpRight size={15} /></span>
          </div>
        ) : (
          <p className="price">
            {money(flags.price)}
            {flags.compare != null ? <s>{money(flags.compare)}</s> : null}
          </p>
        )}
        {showAvailableStock ? <p className="stock-count">Available: {availableStock}</p> : null}
        </div>
      </Link>
    </article>
  );
}

export function ProductCarousel({
  products,
  showAvailableStock = false,
  dealCards = false,
}: {
  products: ProductCardData[];
  showAvailableStock?: boolean;
  dealCards?: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  return (
    <div className="product-carousel">
      <div className="product-row" ref={rowRef}>
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            showAvailableStock={showAvailableStock}
            dealCard={dealCards}
            shopCard
          />
        ))}
      </div>
      {products.length > 1 ? (
        <>
          <button
            type="button"
            className="carousel-arrow prev"
            aria-label="Show previous products"
            onClick={() => rowRef.current?.scrollBy({ left: -rowRef.current.clientWidth, behavior: "smooth" })}
          >
            ‹
          </button>
          <button
            type="button"
            className="carousel-arrow next"
            aria-label="Show more products"
            onClick={() => rowRef.current?.scrollBy({ left: rowRef.current.clientWidth, behavior: "smooth" })}
          >
            ›
          </button>
        </>
      ) : null}
    </div>
  );
}

export function ProductGrid({ products, shopCards = true }: { products: ProductCardData[]; shopCards?: boolean }) {
  return (
    <div className="product-grid">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} shopCard={shopCards} />
      ))}
    </div>
  );
}
