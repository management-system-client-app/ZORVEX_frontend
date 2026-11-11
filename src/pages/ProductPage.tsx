import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Clock3, Heart, PackageCheck, Ruler } from "lucide-react";
import { ApiError, api, DATA_REFRESH_INTERVAL } from "../api";
import { ProductCarousel } from "../components/ProductCard";
import { DetailSkeleton, ProductGridSkeleton, RowsSkeleton } from "../components/Skeleton";
import { coverImage, money, productFlags } from "../format";
import { readRecentlyViewedIds, readRecentlyViewedProducts, recordRecentlyViewed } from "../recentlyViewed";
import { useAuth, useCart } from "../state";
import type { ProductCardData, ProductDetail, Review, SizeGuide, Variant } from "../types";

const PRODUCT_CACHE_KEY = "store_product_details";
const PRODUCT_CACHE_LIMIT = 12;
const RECENT_PRODUCTS_BATCH_SIZE = 5;
const GENDER_LABELS: Record<string, string> = {
  MEN: "Male",
  WOMEN: "Female",
  UNISEX: "Unisex",
  KIDS: "Kids",
};
type ProductInfoTab = "description" | "specification" | "return-policy" | "reviews";

function hasProductSize(variant: Variant) {
  return Boolean(variant.size) && !(
    variant.size?.slug === "one-size" &&
    variant.fabric?.slug === "not-applicable"
  );
}

function hasProductFabric(variant: Variant) {
  return Boolean(variant.fabric && variant.fabric.slug !== "not-applicable");
}

function hasGenderSpecification(product: ProductDetail) {
  return ["men", "women"].includes(product.category.slug);
}

function readProductCache(): Record<string, ProductDetail> {
  try {
    const cached: unknown = JSON.parse(localStorage.getItem(PRODUCT_CACHE_KEY) ?? "{}");
    if (typeof cached !== "object" || cached === null || Array.isArray(cached)) return {};
    return Object.fromEntries(
      Object.entries(cached).filter((entry): entry is [string, ProductDetail] => {
        const product = entry[1];
        return (
          typeof product === "object" &&
          product !== null &&
          "id" in product &&
          product.id === entry[0] &&
          "name" in product &&
          typeof product.name === "string" &&
          "variants" in product &&
          Array.isArray(product.variants) &&
          "images" in product &&
          Array.isArray(product.images) &&
          "category" in product &&
          typeof product.category === "object" &&
          product.category !== null &&
          "brand" in product &&
          typeof product.brand === "object" &&
          product.brand !== null
        );
      }),
    );
  } catch (reason) {
    console.warn("Recently viewed product cache could not be read", reason);
    return {};
  }
}

function cacheProduct(product: ProductDetail) {
  try {
    const products = readProductCache();
    const ids = [product.id, ...Object.keys(products).filter((id) => id !== product.id)]
      .slice(0, PRODUCT_CACHE_LIMIT);
    localStorage.setItem(
      PRODUCT_CACHE_KEY,
      JSON.stringify(Object.fromEntries(ids.map((id) => [id, id === product.id ? product : products[id]]))),
    );
  } catch (reason) {
    console.warn("Product details could not be cached", reason);
  }
}

export function ProductPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { add, busy, setDrawer } = useCart();
  const [product, setProduct] = useState<ProductDetail | null>(() => readProductCache()[id] ?? null);
  const [related, setRelated] = useState<ProductCardData[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [infoTab, setInfoTab] = useState<ProductInfoTab>("description");
  const [guides, setGuides] = useState<SizeGuide[]>([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [image, setImage] = useState(0);
  const [sizeId, setSizeId] = useState<string | null>(null);
  const [colorId, setColorId] = useState<string | null>(null);
  const [fabricId, setFabricId] = useState<string | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [relatedLoading, setRelatedLoading] = useState(true);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: "", comment: "" });
  const [reviewMessage, setReviewMessage] = useState("");
  const [recentProducts, setRecentProducts] = useState<ProductCardData[]>(() => {
    const cachedProducts = readProductCache();
    const recentIds = [id, ...readRecentlyViewedIds(id)];
    const recentSnapshots = readRecentlyViewedProducts();
    return recentIds.flatMap((productId) => cachedProducts[productId] ?? recentSnapshots[productId] ?? []);
  });
  const [recentIndex, setRecentIndex] = useState(0);
  const [recentLoading, setRecentLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const cachedProducts = readProductCache();
    const cachedProduct = cachedProducts[id] ?? null;
    setProduct(cachedProduct);
    setError("");
    setRecentIndex(0);
    recordRecentlyViewed(id, cachedProduct ?? undefined);
    const previousIds = readRecentlyViewedIds(id);
    const recentIds = [id, ...previousIds];
    const recentSnapshots = readRecentlyViewedProducts();
    const cachedRecent = recentIds.flatMap(
      (productId) => cachedProducts[productId] ?? recentSnapshots[productId] ?? [],
    );
    setRecentProducts(cachedRecent);
    setRecentLoading(recentIds.length > 0 && cachedRecent.length === 0);

    const applyProduct = (next: ProductDetail) => {
      setProduct(next);
      cacheProduct(next);
      recordRecentlyViewed(id, next);
      setRecentProducts((current) =>
        [next, ...current.filter((item) => item.id !== next.id)],
      );
      const activeVariants = next.variants.filter((variant) => variant.isActive !== false);
      const first =
        activeVariants.find((variant) => Math.max(variant.stock - (variant.reserved ?? 0), 0) > 0) ??
        activeVariants[0];
      setSizeId(first && hasProductSize(first) ? first.size?.id ?? null : null);
      setColorId(first?.color?.id ?? null);
      setFabricId(first && hasProductFabric(first) ? first.fabric?.id ?? null : null);
      setSelectedVariantId(first?.id ?? null);
      setImage(0);
      api.related(id).then((items) => active && setRelated(items)).catch(() => undefined).finally(() => active && setRelatedLoading(false));
      api.reviews(id).then((result) => {
        if (!active) return;
        setReviews(result.items);
        setAverage(result.summary.averageRating);
      }).catch(() => undefined).finally(() => active && setReviewsLoading(false));
      api.sizeGuides(next.category.id).then((items) => active && setGuides(items)).catch(() => undefined);
    };

    api.product(id, Boolean(cachedProduct))
      .then((next) => {
        if (active) applyProduct(next);
      })
      .catch((reason: unknown) => {
        if (active && !cachedProduct) setError(reason instanceof Error ? reason.message : "Product not found");
      });

    if (recentIds.length > 0) {
      const loadRecentProducts = async () => {
        const items: (ProductDetail | null)[] = [];
        for (let index = 0; index < recentIds.length; index += RECENT_PRODUCTS_BATCH_SIZE) {
          const batch = await Promise.all(
            recentIds
              .slice(index, index + RECENT_PRODUCTS_BATCH_SIZE)
              .map((productId) =>
                api.product(productId).catch((reason: unknown) => {
                  console.warn("Recently viewed product could not be refreshed", productId, reason);
                  return null;
                }),
              ),
          );
          items.push(...batch);
          if (!active) return;
        }
        const products = items.map((item, index) => {
          if (item) {
            cacheProduct(item);
            recordRecentlyViewed(item.id, item);
            return item;
          }
          return cachedProducts[recentIds[index]] ?? recentSnapshots[recentIds[index]] ?? null;
        }).filter((item): item is ProductDetail => item !== null);
        setRecentProducts(products);
        setRecentLoading(false);
      };
      loadRecentProducts().catch((reason: unknown) => {
        if (active) {
          console.warn("Recently viewed products could not be refreshed", reason);
          setRecentLoading(false);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;
    let refreshing = false;
    const refreshProduct = () => {
      if (!active || refreshing || document.visibilityState !== "visible") return;
      refreshing = true;
      api.product(id, true)
        .then((next) => {
          if (active) {
            setProduct(next);
            cacheProduct(next);
          }
        })
        .catch((reason: unknown) => {
          if (active) console.warn("Product details could not be refreshed", reason);
        })
        .finally(() => {
          refreshing = false;
        });
    };
    const timer = window.setInterval(refreshProduct, DATA_REFRESH_INTERVAL);
    window.addEventListener("focus", refreshProduct);
    document.addEventListener("visibilitychange", refreshProduct);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshProduct);
      document.removeEventListener("visibilitychange", refreshProduct);
    };
  }, [id]);

  useEffect(() => {
    setRelatedLoading(true);
    setReviewsLoading(true);
  }, [id]);

  useEffect(() => {
    if (recentProducts.length < 2) return;
    const timer = window.setInterval(() => {
      setRecentIndex((index) => (index + 1) % recentProducts.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [recentProducts.length]);

  useEffect(() => {
    if (recentProducts.length === 0) {
      setRecentIndex(0);
      return;
    }
    setRecentIndex((current) => current % recentProducts.length);
  }, [recentProducts.length]);

  const variants = useMemo(
    () => (product?.variants ?? []).filter((variant) => variant.isActive !== false),
    [product],
  );
  const sizes = useMemo(() => {
    const map = new Map(variants.flatMap((variant) => hasProductSize(variant) && variant.size ? [[variant.size.id, variant.size] as const] : []));
    return [...map.values()];
  }, [variants]);
  const generalOptions = useMemo(
    () => variants.filter((variant) => !hasProductSize(variant) && !hasProductFabric(variant) && !variant.color),
    [variants],
  );
  const isAvailable = (variant: (typeof variants)[number]) =>
    Math.max(variant.stock - (variant.reserved ?? 0), 0) > 0;
  const hasAvailableVariant = (matches: (typeof variants)[number][]) => matches.some(isAvailable);
  const colors = useMemo(() => {
    if (variants.length > 0 && variants.every((variant) => !hasProductSize(variant) && !hasProductFabric(variant) && !variant.color)) return [];
    const pool = variants.filter((variant) => !sizeId ? !hasProductSize(variant) : variant.size?.id === sizeId);
    const map = new Map(pool.flatMap((variant) => (variant.color ? [[variant.color.id, variant.color] as const] : [])));
    return [...map.values()];
  }, [variants, sizeId]);
  const fabrics = useMemo(() => {
    const pool = variants.filter(
      (variant) =>
        (!sizeId ? !hasProductSize(variant) : variant.size?.id === sizeId) &&
        (!colorId || variant.color?.id === colorId),
    );
    const map = new Map(pool.flatMap((variant) => hasProductFabric(variant) && variant.fabric ? [[variant.fabric.id, variant.fabric] as const] : []));
    return [...map.values()];
  }, [variants, sizeId, colorId]);
  const selected = generalOptions.length > 0
    ? generalOptions.find((variant) => variant.id === selectedVariantId)
    : variants.find(
        (variant) =>
          (!sizeId ? !hasProductSize(variant) : variant.size?.id === sizeId) &&
          (variant.color?.id ?? null) === colorId &&
          (fabricId ? variant.fabric?.id === fabricId : !hasProductFabric(variant)),
      );
  const gallery = useMemo(() => {
    if (!product) return [];
    const selectedColorImages = product.images.filter((item) => item.colorId === colorId);
    return selectedColorImages.length > 0
      ? selectedColorImages
      : product.images.filter((item) => !item.colorId);
  }, [product, colorId]);

  if (error) return <p className="error">{error}</p>;
  if (!product) return <DetailSkeleton />;

  const flags = productFlags(product);
  const unit = selected?.price != null ? Number(selected.price) : flags.price;
  const available = selected ? Math.max(selected.stock - (selected.reserved ?? 0), 0) : 0;
  const photo = gallery[image] ?? gallery[0];

  function chooseSize(nextSizeId: string) {
    setSizeId(nextSizeId);
    const matches = variants.filter((variant) => variant.size?.id === nextSizeId);
    const availableMatches = matches.filter(isAvailable);
    const candidates = availableMatches.length > 0 ? availableMatches : matches;
    const preferred =
      candidates.find((variant) => variant.color?.id === colorId && variant.fabric?.id === fabricId) ??
      candidates.find((variant) => variant.color?.id === colorId) ??
      candidates[0];
    if (preferred) {
      setColorId(preferred.color?.id ?? null);
      setFabricId(preferred.fabric?.id ?? null);
    }
  }

  function chooseColor(nextColorId: string) {
    setColorId(nextColorId);
    setImage(0);
    const matches = variants.filter(
      (variant) => variant.size?.id === sizeId && variant.color?.id === nextColorId,
    );
    const availableMatches = matches.filter(isAvailable);
    const candidates = availableMatches.length > 0 ? availableMatches : matches;
    const preferred = candidates.find((variant) => variant.fabric?.id === fabricId) ?? candidates[0];
    if (preferred) setFabricId(preferred.fabric?.id ?? null);
  }

  async function onAdd() {
    if (!selected) {
      setError(generalOptions.length > 0 ? "Choose an option" : "Choose a size");
      return;
    }
    setError("");
    try {
      await add(selected.id, quantity);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add to cart");
    }
  }

  async function onBuyNow() {
    if (!selected) {
      setError(generalOptions.length > 0 ? "Choose an option" : "Choose a size");
      return;
    }
    setError("");
    try {
      await add(selected.id, quantity);
      setDrawer(false);
      navigate("/checkout");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add to cart");
    }
  }

  async function toggleWish() {
    if (!user) {
      window.location.assign("/login");
      return;
    }
    try {
      if (saved) {
        await api.removeWishlist(product!.id);
        setSaved(false);
      } else {
        await api.saveWishlist(product!.id);
        setSaved(true);
      }
      window.dispatchEvent(new Event("wishlist-updated"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Wishlist failed");
    }
  }

  async function onReview(event: FormEvent) {
    event.preventDefault();
    setReviewMessage("");
    try {
      const created = await api.createReview({
        productId: product!.id,
        rating: reviewForm.rating,
        title: reviewForm.title || undefined,
        comment: reviewForm.comment,
      });
      setReviews((current) => [created, ...current]);
      setAverage((current) => (current * reviews.length + created.rating) / (reviews.length + 1));
      setReviewForm({ rating: 5, title: "", comment: "" });
      setReviewMessage("Review posted.");
    } catch (reason) {
      setReviewMessage(reason instanceof ApiError ? reason.message : "Could not post review");
    }
  }

  return (
    <div>
      <p className="crumb">
        <Link to="/">Home</Link> / <Link to={`/shop?categoryId=${product.category.id}`}>{product.category.name}</Link> /{" "}
        {product.name}
      </p>
      <div className="pdp product-detail-page">
        <div className="pdp-main product-detail-main">
        <div className="product-gallery-column">
          <div className="gallery-main">
            {photo ? (
              <img
                src={photo.url}
                alt={photo.alt || product.name}
                onMouseMove={(event) => {
                  const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
                  if (!bounds) return;
                  const x = ((event.clientX - bounds.left) / bounds.width) * 100;
                  const y = ((event.clientY - bounds.top) / bounds.height) * 100;
                  event.currentTarget.style.setProperty("--zoom-x", `${x}%`);
                  event.currentTarget.style.setProperty("--zoom-y", `${y}%`);
                }}
              />
            ) : (
              <div className="photo-fallback">Photo</div>
            )}
          </div>
          <div className="thumbs">
            {gallery.map((item, index) => (
              <button key={item.id ?? item.url} type="button" className={index === image ? "on" : ""} onClick={() => setImage(index)}>
                <img src={item.url} alt="" />
              </button>
            ))}
          </div>
        </div>
        <div className="product-summary">
          <div className="product-summary-heading">
            <div>
              <p className="product-brand-line">Brand: <strong>{product.brand.name}</strong></p>
              <h1>{product.name}</h1>
              <p className="product-rating">
                <span aria-label={`${average.toFixed(1)} out of 5 stars`}>{"★".repeat(Math.round(average))}{"☆".repeat(5 - Math.round(average))}</span>
                <small>{reviewsLoading ? "Loading rating" : average > 0 ? `${average.toFixed(1)} (${reviews.length} ratings)` : "No ratings yet"}</small>
              </p>
            </div>
            <button type="button" className={`product-wishlist${saved ? " is-saved" : ""}`} onClick={toggleWish} aria-label={saved ? "Remove from wishlist" : "Add to wishlist"} aria-pressed={saved}>
              <Heart size={20} fill={saved ? "currentColor" : "none"} />
            </button>
          </div>
          <p className="product-price">
            <strong>{money(unit)}</strong>
            {flags.compare != null ? <s>{money(flags.compare)}</s> : null}
          </p>
          <div className="flags" style={{ position: "static", flexDirection: "row", marginBottom: 8 }}>
            {flags.isNew ? <span className="flag">New</span> : null}
            {flags.onSale ? <span className="flag">Sale</span> : null}
          </div>
          <div className="product-meta">
            <span>SKU / Style: <strong>{selected?.sku ?? "—"}</strong></span>
            <span>Sold by: <strong>{product.brand.name}</strong></span>
            <span>Category: <Link to={`/shop?categoryId=${product.category.id}`}>{product.category.name}</Link></span>
          </div>
          {generalOptions.length > 1 || generalOptions.some((variant) => variant.optionLabel?.trim()) ? (
            <>
              <p className="option-label">Choose an option</p>
              <div className="sizes">
                {generalOptions.map((variant) => {
                  const availableOption = isAvailable(variant);
                  return (
                    <button
                      key={variant.id}
                      type="button"
                      className={selectedVariantId === variant.id ? "size-btn on" : "size-btn"}
                      disabled={!availableOption}
                      onClick={() => setSelectedVariantId(variant.id)}
                    >
                      {variant.optionLabel || variant.color?.name}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
          {sizes.length > 0 ? (
            <>
              <p className="option-label">Size</p>
              <div className="sizes">
                {sizes.map((size) => (
              <button
                key={size.id}
                type="button"
                className={sizeId === size.id ? "size-btn on" : "size-btn"}
                disabled={!hasAvailableVariant(variants.filter((variant) => variant.size?.id === size.id))}
                onClick={() => chooseSize(size.id)}
              >
                {size.name}
              </button>
            ))}
              </div>
            </>
          ) : null}
          {sizes.length > 0 && guides.length > 0 ? (
            <button className="see-more product-size-guide" type="button" onClick={() => setGuideOpen(true)}>
              <Ruler size={15} aria-hidden="true" /> Size Measurement Details
            </button>
          ) : null}
          {colors.length > 0 ? (
            <>
              <p className="option-label">
                Color{colors.find((color) => color.id === colorId) ? `: ${colors.find((color) => color.id === colorId)?.name}` : ""}
              </p>
              <div className="swatches">
                {colors.map((color) => {
                  const colorImage = product.images.find((item) => item.colorId === color.id);
                  return (
                    <button
                      key={color.id}
                      type="button"
                      className={colorId === color.id ? "swatch on" : "swatch"}
                      aria-label={color.name}
                      title={color.name}
                      disabled={!hasAvailableVariant(
                        variants.filter(
                          (variant) =>
                            variant.size?.id === sizeId && variant.color?.id === color.id,
                        ),
                      )}
                      onClick={() => chooseColor(color.id)}
                    >
                      {colorImage ? (
                        <img src={colorImage.url} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <span style={{ backgroundColor: color.hexCode }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}
          {fabrics.length > 0 ? (
            <>
              <p className="option-label">Fabric</p>
              {fabrics.length > 1 ? (
                <div className="sizes">
                  {fabrics.map((fabric) => (
                    <button
                      key={fabric.id}
                      type="button"
                      className={fabricId === fabric.id ? "size-btn on" : "size-btn"}
                      disabled={!hasAvailableVariant(
                        variants.filter(
                          (variant) =>
                            variant.size?.id === sizeId &&
                            (variant.color?.id ?? null) === colorId &&
                            variant.fabric?.id === fabric.id,
                        ),
                      )}
                      onClick={() => setFabricId(fabric.id)}
                    >
                      {fabric.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="product-fabric-value">{selected?.fabric?.name ?? fabrics[0]?.name}</p>
              )}
              {selected?.fabric?.composition ? <p className="note">{selected.fabric.composition}</p> : null}
            </>
          ) : null}
          <p className="stock">{available > 0 ? `In Stock: ${available}` : "Out of stock"}</p>
          <div className="product-purchase-row">
            <span className="option-label">Quantity</span>
            <div className="qty">
              <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Decrease">
                −
              </button>
              <span>{quantity}</span>
              <button type="button" onClick={() => setQuantity((value) => Math.min(available || 99, value + 1))} aria-label="Increase">
                +
              </button>
            </div>
          </div>
          {error ? <p className="error">{error}</p> : null}
          <div className="product-actions">
            <button className="btn wide" type="button" disabled={busy || available < 1} onClick={onAdd}>
              Add to cart
            </button>
            <button className="btn-line wide product-buy-now" type="button" disabled={busy || available < 1} onClick={onBuyNow}>
              Buy now <ArrowRight size={16} />
            </button>
          </div>
        </div>
        <section className="section product-info-section">
          <div className="product-info-tabs" role="tablist" aria-label="Product information">
            {([
              ["description", "Description"],
              ["specification", "Specification"],
              ["return-policy", "Return Policy"],
              ["reviews", `Reviews (${reviews.length})`],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                id={`product-tab-${tab}`}
                type="button"
                role="tab"
                aria-selected={infoTab === tab}
                aria-controls="product-info-panel"
                className={infoTab === tab ? "active" : ""}
                onClick={() => setInfoTab(tab)}
              >
                {label}
              </button>
            ))}
          </div>
          <div id="product-info-panel" className="product-info-panel" role="tabpanel" aria-labelledby={`product-tab-${infoTab}`}>
            {infoTab === "description" ? (
              <div className="product-description">
                <div className="product-content-heading"><span>PRODUCT STORY</span><h2>About this product</h2></div>
                <p className="product-description-copy">{product.description || "No description found for this product."}</p>
                {product.careInstructions ? (
                  <div className="product-care-note"><strong>Care instructions</strong><p>{product.careInstructions}</p></div>
                ) : null}
              </div>
            ) : null}
            {infoTab === "specification" ? (
              <div className="product-specs-wrap">
                <div className="product-content-heading"><span>PRODUCT DETAILS</span><h2>Specifications</h2></div>
                <div className="product-specs" aria-label="Product details">
                  <p><span>Brand</span><strong>{product.brand.name}</strong></p>
                  <p><span>Option</span><strong>{selected?.optionLabel ?? "—"}</strong></p>
                  {selected && hasProductFabric(selected) ? <p><span>Fabric</span><strong>{selected.fabric?.name}</strong></p> : null}
                  {hasGenderSpecification(product) ? (
                    <p><span>Gender</span><strong>{GENDER_LABELS[product.gender] ?? product.gender}</strong></p>
                  ) : null}
                  <p><span>Color</span><strong>{selected?.color?.name ?? "—"}</strong></p>
                  {selected && hasProductSize(selected) ? <p><span>Size</span><strong>{selected.size?.name}</strong></p> : null}
                  <p className="product-specs-note">
                    <span>Color note</span><strong>The color is the same as the picture. However, it may slightly differ due to lighting.</strong>
                  </p>
                </div>
              </div>
            ) : null}
            {infoTab === "return-policy" ? (
              <div className="product-policy">
                <div className="product-content-heading"><span>SHOP WITH CONFIDENCE</span><h2>Replacement & support</h2></div>
                <article className="product-policy-card">
                  <span><Clock3 size={20} /></span>
                  <div><strong>Product support</strong><p>Check the product policy for applicable replacement and support details.</p></div>
                </article>
                <article className="product-policy-card">
                  <span><PackageCheck size={20} /></span>
                  <div><strong>Need a replacement?</strong><p>Please contact customer support to request a replacement.</p></div>
                </article>
              </div>
            ) : null}
            {infoTab === "reviews" ? (
              <div className="product-reviews">
                <section className="product-review-summary" aria-label="Customer rating summary">
                  <div className="product-review-score">
                    <strong>{average > 0 ? average.toFixed(1) : "—"}</strong>
                    <span>out of 5</span>
                  </div>
                  <div className="product-review-summary-copy">
                    <span className="product-review-stars" aria-label={average > 0 ? `${average.toFixed(1)} out of 5 stars` : "No ratings yet"}>
                      {"★".repeat(Math.round(average))}{"☆".repeat(5 - Math.round(average))}
                    </span>
                    <strong>{average > 0 ? "Customer rating" : "Be the first to rate this product"}</strong>
                    <small>{reviews.length} {reviews.length === 1 ? "review" : "reviews"}</small>
                  </div>
                </section>
                {reviewsLoading ? <RowsSkeleton rows={3} /> : null}
                {!reviewsLoading && reviews.length === 0 ? (
                  <div className="product-review-empty">
                    <span className="product-review-empty-stars" aria-hidden="true">☆☆☆</span>
                    <strong>No reviews yet</strong>
                    <p>Share your experience with this product.</p>
                  </div>
                ) : null}
                {reviews.length > 0 ? (
                  <div className="product-review-list">
                    {reviews.map((review) => (
                      <article key={review.id} className="product-review">
                        <div className="product-review-author">
                          <span className="product-review-avatar" aria-hidden="true">{review.user.firstName.charAt(0).toUpperCase()}</span>
                          <div><strong>{review.user.firstName} {review.user.lastName}</strong><small>Customer review</small></div>
                          <span className="product-review-stars" aria-label={`${review.rating} out of 5 stars`}>
                            {"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}
                          </span>
                        </div>
                        {review.title ? <h3>{review.title}</h3> : null}
                        <p>{review.comment}</p>
                      </article>
                    ))}
                  </div>
                ) : null}
                {user ? (
                  <form className="product-review-form" onSubmit={onReview}>
                    <div className="product-review-form-heading">
                      <span>YOUR FEEDBACK</span>
                      <h3>Write a review</h3>
                      <p>Tell other shoppers what you think.</p>
                    </div>
                    <label className="field">
                      <span>Your rating</span>
                      <div className="rating-input" role="radiogroup" aria-label="Rating">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <button
                            key={rating}
                            type="button"
                            role="radio"
                            aria-checked={reviewForm.rating === rating}
                            aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
                            className={rating <= reviewForm.rating ? "selected" : ""}
                            onClick={() => setReviewForm({ ...reviewForm, rating })}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </label>
                    <label className="field">
                      <span>Review title <small>(optional)</small></span>
                      <input placeholder="Sum up your experience" value={reviewForm.title} onChange={(event) => setReviewForm({ ...reviewForm, title: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Your review</span>
                      <textarea required minLength={2} placeholder="What did you like or dislike?" value={reviewForm.comment} onChange={(event) => setReviewForm({ ...reviewForm, comment: event.target.value })} />
                    </label>
                    {reviewMessage ? <p className="product-review-message" role="status">{reviewMessage}</p> : null}
                    <button className="btn product-review-submit" type="submit">Post review <ArrowRight size={16} /></button>
                  </form>
                ) : (
                  <p className="product-review-login"><Link to="/login">Log in</Link> to share your review.</p>
                )}
              </div>
            ) : null}
          </div>
        </section>
        </div>
        <aside className="recent-viewed" aria-label="Delivery benefits and recently viewed products">
          <section className="delivery-benefits" aria-label="Delivery and shopping benefits">
            <ul>
              <li>
                <span aria-hidden="true">🚚</span>
                <p>Delivery charges and available shipping options are shown at checkout.</p>
              </li>
              <li>
                <span aria-hidden="true">🇧🇩</span>
                <p>Home delivery all over Bangladesh</p>
              </li>
              <li>
                <span aria-hidden="true">💳</span>
                <p>Various payment methods</p>
              </li>
              <li>
                <span aria-hidden="true">📦</span>
                <p>Replacement eligibility follows the policy listed for each product.</p>
              </li>
              <li>
                <span aria-hidden="true">🎧</span>
                <p>Dedicated Customer Support</p>
              </li>
              <li>
                <span aria-hidden="true">🌐</span>
                <p>Verified and Trusted Sellers</p>
              </li>
            </ul>
          </section>
          <section className="recent-viewed-products" aria-label="Recently viewed products">
            <div className="recent-viewed-heading">
              <h2>Recently Viewed</h2>
            </div>
            {recentLoading && recentProducts.length === 0 ? <ProductGridSkeleton count={1} /> : null}
            {!recentLoading && recentProducts.length > 0 ? (() => {
              return (
                <>
                <div className="recent-viewed-slider">
                  {recentProducts.map((recent, index) => {
                    const active = index === recentIndex;
                    const recentImage = coverImage(recent);
                    return (
                      <Link
                        key={recent.id}
                        className={`recent-viewed-card${active ? " is-active" : ""}`}
                        to={`/product/${recent.id}`}
                        aria-hidden={!active}
                        inert={!active}
                      >
                        <div className="recent-viewed-photo">
                          {recentImage ? <img src={recentImage} alt={recent.name} /> : <div className="photo-fallback" />}
                          {productFlags(recent).isNew ? <span className="flag">New</span> : null}
                        </div>
                        <strong>{recent.name}</strong>
                        <span className="price">{money(recent.basePrice)}</span>
                      </Link>
                    );
                  })}
                </div>
                {recentProducts.length > 1 ? (
                  <div className="recent-viewed-dots" aria-label={`Product ${recentIndex + 1} of ${recentProducts.length}`}>
                    {recentProducts.map((item, index) => (
                      <button key={item.id} type="button" className={index === recentIndex ? "on" : ""} aria-label={`Show product ${index + 1}`} onClick={() => setRecentIndex(index)} />
                    ))}
                  </div>
                ) : null}
                </>
              );
            })() : null}
          </section>
        </aside>
      </div>

      {relatedLoading ? <ProductGridSkeleton count={4} /> : null}
      {!relatedLoading && related.length > 0 ? (
        <section className="section related-products-section">
          <div className="section-head">
            <div className="related-products-heading">
              <span>CURATED FOR YOU</span>
              <h2>You may also like</h2>
              <p>Discover more styles selected to complement your choice.</p>
            </div>
            <Link to={`/shop?categoryId=${product.category.id}`}>See more <ArrowRight size={16} /></Link>
          </div>
          <ProductCarousel products={related} />
        </section>
      ) : null}

      {guideOpen ? (
        <div className="modal size-guide-modal" role="dialog" aria-label="Size guide">
          <div className="modal-card size-guide-card">
            <header>
              Size guide
              <button type="button" onClick={() => setGuideOpen(false)}>
                Close
              </button>
            </header>
            <div style={{ padding: 16 }}>
              {guides.map((guide) => (
                <div key={guide.id}>
                  <h2 className="label" style={{ marginBottom: 8 }}>
                    {guide.title}
                  </h2>
                  <table>
                    <thead>
                      <tr>
                        {guide.columns.map((column) => (
                          <th key={column}>{column}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {guide.rows.map((row, index) => (
                        <tr key={index}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
