import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { money, productFlags, productThumbnailUrl } from "../format";
import { recordRecentlyViewed } from "../recentlyViewed";
import type { ProductCardData } from "../types";

export function ProductCard({
  product,
  showAvailableStock = false,
  dealCard = false,
  shopCard = false,
  prioritizeImage = false,
  eagerImage = false,
}: {
  product: ProductCardData;
  showAvailableStock?: boolean;
  dealCard?: boolean;
  shopCard?: boolean;
  prioritizeImage?: boolean;
  eagerImage?: boolean;
}) {
  const imageCandidates = useMemo(() => {
    const images = product.images ?? [];
    return [...new Set([
      product.imageUrl,
      images.find((item) => item.isPrimary)?.url,
      ...images.map((item) => item.url),
    ].map((url) => productThumbnailUrl(url, 400)).filter((url): url is string => Boolean(url)))];
  }, [product.imageUrl, product.images]);
  const [imageIndex, setImageIndex] = useState(0);
  useEffect(() => setImageIndex(0), [imageCandidates]);
  const image = imageCandidates[imageIndex] ?? null;
  const flags = productFlags(product);
  const discount = flags.compare != null ? Math.round(((flags.compare - flags.price) / flags.compare) * 100) : null;
  const savings = flags.compare != null ? flags.compare - flags.price : 0;
  const availableStock = product.variants?.reduce(
    (total, variant) =>
      total + (variant.isActive === false ? 0 : Math.max(variant.stock - (variant.reserved ?? 0), 0)),
    0,
  ) ?? 0;
  const soldOut = Array.isArray(product.variants) && availableStock === 0;
  return (
    <article className={`card${dealCard ? " deal-card" : ""}${shopCard ? " shop-product-card" : ""}${soldOut ? " sold-out" : ""}`}>
      <Link to={`/product/${product.id}`} onClick={() => recordRecentlyViewed(product.id, product)}>
        <div className={`card-photo${shopCard ? " shop-card-media" : ""}`}>
          {image ? (
            <img
              className="product-image"
              src={image}
              alt={product.name}
              loading={prioritizeImage || eagerImage ? "eager" : "lazy"}
              fetchPriority={prioritizeImage ? "high" : "low"}
              decoding="async"
              onError={() => setImageIndex((current) => current + 1)}
            />
          ) : <div className="photo-fallback" />}
          {dealCard ? (
            savings > 0 || flags.isNew || soldOut ? (
              <div className="deal-card-badges">
              {savings > 0 ? <span className="deal-savings">{discount ? `${discount}% OFF · ` : ""}Save {money(savings)}</span> : null}
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
              {flags.onSale ? <span className="flag sale-flag">{discount ? `${discount}% OFF` : "Sale"}</span> : null}
            </div>
          ) : null}
        </div>
        <div className={`card-copy${shopCard ? " shop-card-info" : ""}`}>
          {shopCard && product.category?.name ? <span className="shop-card-category">{product.category.name}</span> : null}
          {product.brand?.name && product.brand.name.trim().toLowerCase() !== "none" ? (
            <span className="card-brand">{product.brand.name}</span>
          ) : null}
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
  autoSlide = true,
}: {
  products: ProductCardData[];
  showAvailableStock?: boolean;
  dealCards?: boolean;
  autoSlide?: boolean;
}) {
  const rowRef = useRef<HTMLDivElement>(null);

  const scrollByCard = useCallback((direction: -1 | 1) => {
    const row = rowRef.current;
    if (!row) return;

    const cards = Array.from(row.children).filter((card): card is HTMLElement => card instanceof HTMLElement);
    if (cards.length < 2) return;

    const maxScroll = Math.max(row.scrollWidth - row.clientWidth, 0);
    if (maxScroll <= 1) return;

    if (direction > 0 && row.scrollLeft >= maxScroll - 2) {
      row.scrollTo({ left: 0, behavior: "smooth" });
      return;
    }
    if (direction < 0 && row.scrollLeft <= 2) {
      row.scrollTo({ left: maxScroll, behavior: "smooth" });
      return;
    }

    const positions = cards.map((card) => card.offsetLeft);
    const currentIndex = positions.reduce(
      (current, position, index) => (position <= row.scrollLeft + 2 ? index : current),
      0,
    );
    const targetIndex = currentIndex + direction;
    const targetPosition = Math.min(positions[targetIndex] ?? maxScroll, maxScroll);

    row.scrollTo({ left: targetPosition, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!autoSlide || products.length < 2) return;

    const row = rowRef.current;
    if (!row || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let inView = !("IntersectionObserver" in window);
    let timer: number | undefined;
    const syncTimer = () => {
      if (inView && document.visibilityState === "visible" && timer === undefined) {
        timer = window.setInterval(() => scrollByCard(1), 4500);
      } else if ((!inView || document.visibilityState !== "visible") && timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };
    const observer = "IntersectionObserver" in window
      ? new IntersectionObserver(([entry]) => {
          inView = entry.isIntersecting;
          syncTimer();
        }, { rootMargin: "40px" })
      : null;
    observer?.observe(row);
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleVisibilityChange = () => syncTimer();
    const handleMotionChange = () => {
      if (motionPreference.matches && timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      } else {
        syncTimer();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    motionPreference.addEventListener("change", handleMotionChange);
    syncTimer();

    return () => {
      if (timer !== undefined) window.clearInterval(timer);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      motionPreference.removeEventListener("change", handleMotionChange);
    };
  }, [autoSlide, products.length, scrollByCard]);

  return (
    <div className="product-carousel">
      <div className="product-row" ref={rowRef}>
        {products.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            showAvailableStock={showAvailableStock}
            dealCard={dealCards}
            shopCard
            prioritizeImage={index === 0}
          />
        ))}
      </div>
      {products.length > 1 ? (
        <>
          <button
            type="button"
            className="carousel-arrow prev"
            aria-label="Show previous products"
            onClick={() => scrollByCard(-1)}
          >
            ‹
          </button>
          <button
            type="button"
            className="carousel-arrow next"
            aria-label="Show more products"
            onClick={() => scrollByCard(1)}
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
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          shopCard={shopCards}
          prioritizeImage={index === 0}
          eagerImage={index > 0 && index < 4}
        />
      ))}
    </div>
  );
}
