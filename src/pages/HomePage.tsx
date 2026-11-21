import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, Headphones, Laptop, ShieldCheck, Smartphone, Sparkles, Truck } from "lucide-react";
import { api, STOREFRONT_REFRESH_INTERVAL, hydrateImages } from "../api";
import { categoryTiles } from "../components/Chrome";
import { ProductCarousel } from "../components/ProductCard";
import { productFlags } from "../format";
import { useStore } from "../state";
import type { HomeBlock, HomePayload, ProductCardData } from "../types";

const DEFAULT_STORE_NOTICE_TITLE = "RESELLKORI UPDATE";
const DEFAULT_STORE_NOTICE_BODY = "নতুন পণ্য, দারুণ অফার আর সারা দেশের পছন্দের কালেকশন—সব এক জায়গায়।";

function HomeBannerSlider({ banners }: { banners: HomeBlock[] }) {
  const slides = banners.filter((banner) => banner.imageUrl);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [slides.length]);

  if (slides.length === 0) return null;

  const index = activeIndex % slides.length;
  const banner = slides[index];
  const href = banner.linkUrl ?? (banner.categoryId ? `/shop?categoryId=${banner.categoryId}` : "/shop");
  const isVideo = /(\.(mp4|webm|mov|m4v|ogv|avi))(\?.*)?$/i.test(banner.imageUrl ?? "");

  return (
    <div className="home-banner-slider" role="region" aria-label="Featured banners" aria-roledescription="carousel">
      <Link className="home-banner-slide" to={href} aria-label={banner.title}>
        {isVideo ? (
          <video src={banner.imageUrl ?? undefined} autoPlay muted loop playsInline preload="metadata" />
        ) : (
          <img src={banner.imageUrl ?? undefined} alt={banner.title} loading="eager" decoding="async" />
        )}
        <span className="home-banner-caption">
          <strong>{banner.title}</strong>
          {banner.subtitle ? <span>{banner.subtitle}</span> : null}
        </span>
      </Link>
    </div>
  );
}

function HomePromoBanner({ banner }: { banner: HomeBlock }) {
  const href = banner.linkUrl ?? (banner.categoryId ? `/shop?categoryId=${banner.categoryId}` : "/shop");
  const isVideo = /(\.(mp4|webm|mov|m4v|ogv|avi))(\?.*)?$/i.test(banner.imageUrl ?? "");

  return (
    <Link className="home-promo-card home-promo-image" to={href} aria-label={banner.title}>
      {isVideo ? (
        <video src={banner.imageUrl ?? undefined} autoPlay muted loop playsInline preload="metadata" />
      ) : (
        <img src={banner.imageUrl ?? undefined} alt={banner.title} loading="lazy" decoding="async" />
      )}
    </Link>
  );
}

function HomeSkeleton() {
  return (
    <div className="home-skeleton" aria-hidden="true">
      <div className="skeleton-hero" />
      <section className="skeleton-section">
        <div className="skeleton-heading" />
        <div className="skeleton-categories">
          {Array.from({ length: 6 }, (_, index) => <div className="skeleton-category" key={index} />)}
        </div>
      </section>
      {Array.from({ length: 3 }, (_, row) => (
        <section className="skeleton-section" key={row}>
          <div className="skeleton-heading" />
          <div className="skeleton-products">
            {Array.from({ length: 5 }, (_, index) => <div className="skeleton-product" key={index} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

export function HomePage() {
  const { catalog, categoryImages } = useStore();
  const [storeNotice, setStoreNotice] = useState({ title: DEFAULT_STORE_NOTICE_TITLE, body: DEFAULT_STORE_NOTICE_BODY });
  const [banners, setBanners] = useState<HomeBlock[]>([]);
  const [campaigns, setCampaigns] = useState<HomeBlock[]>([]);
  const [gadgetBanners, setGadgetBanners] = useState<HomeBlock[]>([]);
  const [dailyDeals, setDailyDeals] = useState<ProductCardData[]>([]);
  const [arrivals, setArrivals] = useState<ProductCardData[]>([]);
  const [arrivalHref, setArrivalHref] = useState("/shop?sort=latest");
  const [selectedTrending, setSelectedTrending] = useState<ProductCardData[]>([]);
  const [trendingCategoryId, setTrendingCategoryId] = useState("all");
  const [latestProducts, setLatestProducts] = useState<ProductCardData[]>([]);
  const homePayloadVersion = useRef(0);
  const [best, setBest] = useState<ProductCardData[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const skeletonRef = useRef<HTMLDivElement>(null);
  const [reservedHeight, setReservedHeight] = useState(0);
  const isLoading = loading;

  useEffect(() => {
    let active = true;
    api.page("home-store-notice")
      .then((page) => {
        if (active) setStoreNotice({ title: page.title || DEFAULT_STORE_NOTICE_TITLE, body: page.body ?? DEFAULT_STORE_NOTICE_BODY });
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  function updateDailyDeals(products: ProductCardData[]) {
    const discounted = products.filter((product) => productFlags(product).onSale);
    setDailyDeals(discounted);
  }

  function applyHomePayload(home: HomePayload, isActive: () => boolean = () => true) {
    const version = ++homePayloadVersion.current;
    setBanners(home.banners.filter((banner) => banner.imageUrl));
    setCampaigns(home.campaigns.filter((campaign) => campaign.imageUrl).slice(0, 2));
    setGadgetBanners(home.gadgetBanners?.filter((banner) => banner.imageUrl).slice(0, 3) ?? []);
    const arrivalBlock = home.newArrivals[0];
    setArrivals(arrivalBlock?.products ?? []);
    setArrivalHref(arrivalBlock?.categoryId ? `/shop?categoryId=${arrivalBlock.categoryId}` : "/shop?sort=latest");
    setSelectedTrending(home.trendingProducts);
    updateDailyDeals(home.trendingProducts);
    void hydrateImages(home.trendingProducts).then(
      (products) => {
        if (isActive() && version === homePayloadVersion.current) {
          setSelectedTrending(products);
        }
      },
      (reason: unknown) => {
        if (isActive()) setError(reason instanceof Error ? reason.message : "Product images could not be loaded");
      },
    );
  }

  useLayoutEffect(() => {
    if (!isLoading || !skeletonRef.current) return;
    const skeleton = skeletonRef.current;
    const measure = () => setReservedHeight(skeleton.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(skeleton);
    return () => observer.disconnect();
  }, [isLoading]);

  useEffect(() => {
    let active = true;
    api.home()
      .then((home) => {
        if (!active) return;
        applyHomePayload(home, () => active);
        setLoading(false);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "Home could not be loaded");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    api.products({ status: "ACTIVE", limit: 20, page: 1, sort: "latest" })
      .then(async (result) => {
        if (!active) return;
        setLatestProducts(result.items);
        updateDailyDeals(result.items);
        setLoading(false);
        const products = await hydrateImages(result.items);
        if (active) {
          setLatestProducts(products);
          updateDailyDeals(products);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError((current) =>
            [current, reason instanceof Error ? reason.message : "Products could not be loaded"].filter(Boolean).join(" · "),
          );
        }
      });

    api.bestSellers()
      .then((products) => {
        if (active) {
          setBest(products);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError((current) =>
            [current, reason instanceof Error ? reason.message : "Best sellers could not be loaded"].filter(Boolean).join(" · "),
          );
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    let refreshing = false;
    let refreshingProducts = false;
    const refreshHome = () => {
      if (!active || document.visibilityState !== "visible") return;
      if (!refreshing) {
        refreshing = true;
        api.home(true)
          .then((home) => {
            if (!active) return;
            applyHomePayload(home, () => active);
            setError("");
          })
          .catch((reason: unknown) => {
            if (active) setError(reason instanceof Error ? reason.message : "Home could not be refreshed");
          })
          .finally(() => {
            refreshing = false;
          });
      }

      if (!refreshingProducts) {
        refreshingProducts = true;
        Promise.all([
          api.products({ status: "ACTIVE", limit: 20, page: 1, sort: "latest" }, true),
          api.bestSellers(true),
        ])
          .then(async ([result, bestSellers]) => {
            if (!active) return;
            setLatestProducts(result.items);
            setBest(bestSellers);
            updateDailyDeals(result.items);
            const products = await hydrateImages(result.items);
            if (active) {
              setLatestProducts(products);
              updateDailyDeals(products);
            }
          })
          .catch((reason: unknown) => {
            if (active) {
              setError(reason instanceof Error ? reason.message : "Products could not be refreshed");
            }
          })
          .finally(() => {
            refreshingProducts = false;
          });
      }
    };
    const timer = window.setInterval(refreshHome, STOREFRONT_REFRESH_INTERVAL);
    window.addEventListener("focus", refreshHome);
    document.addEventListener("visibilitychange", refreshHome);
    window.addEventListener("app:products-changed", refreshHome);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshHome);
      document.removeEventListener("visibilitychange", refreshHome);
      window.removeEventListener("app:products-changed", refreshHome);
    };
  }, []);

  const tiles = categoryTiles(catalog.categories, categoryImages);
  const genderTiles = [
    { label: "MAN", gender: "MEN", pattern: /(^|[^a-z])(men|man)([^a-z]|$)|mens|punjabi|shoes/ },
    { label: "WOMEN", gender: "WOMEN", pattern: /women|woman|fashion/ },
  ].map((item) => ({
    ...item,
    image: tiles.find(({ category }) => item.pattern.test(`${category.slug} ${category.name}`.toLowerCase()))?.image ?? null,
  }));
  const deals = dailyDeals;
  const collection = [...new Map([...latestProducts, ...arrivals].map((product) => [product.id, product])).values()]
    .slice(0, 12);
  const collectionHref = latestProducts.length > 0 ? "/shop?sort=latest" : arrivalHref;
  const trendingProducts = selectedTrending.length > 0
    ? selectedTrending
    : best.length > 0
      ? best
      : latestProducts;
  const trendingCategories = [...new Map(
    trendingProducts.flatMap((product) => {
      if (!product.category) return [];
      const category = catalog.categories.find((item) => item.id === product.category?.id) ?? product.category;
      return [[category.id, category] as const];
    }),
  ).values()];
  const visibleTrending = trendingCategoryId === "all"
    ? trendingProducts
    : trendingProducts.filter((product) => product.category?.id === trendingCategoryId);
  const hasHomeContent = Boolean(
    banners.length || campaigns.length || gadgetBanners.length || tiles.length || deals.length || collection.length || best.length || selectedTrending.length,
  );

  return (
    <div className="home" style={!isLoading && !error && hasHomeContent && reservedHeight ? { minHeight: reservedHeight } : undefined}>
      {isLoading ? <div className="home-skeleton-measure" ref={skeletonRef}><HomeSkeleton /></div> : (
        <>
      {error ? <p className="error">{error}</p> : null}
      <section
        className={`home-hero${campaigns.length ? " has-offer-banners" : ""}`}
        aria-labelledby={banners.length ? undefined : "home-hero-title"}
        aria-label={banners.length ? "Featured banners and offers" : undefined}
      >
        <div className={`home-hero-main${banners.length ? " has-banner-slider" : ""}`}>
          {banners.length ? <HomeBannerSlider banners={banners} /> : null}
          {!banners.length ? (
            <>
              <div className="home-hero-copy">
                <span className="home-hero-kicker"><Sparkles size={14} /> SMART PICKS FOR EVERYDAY</span>
                <h1 id="home-hero-title">Tech that fits<br /><em>your everyday.</em></h1>
                <p>Discover gadgets, electronics and essentials from brands you love—at prices that feel right.</p>
                <div className="home-hero-actions">
                  <Link to="/shop">Explore products <ArrowRight size={16} /></Link>
                  <Link to="/shop?sort=price_asc">Shop best value <ArrowUpRight size={15} /></Link>
                </div>
                <div className="home-hero-trust">
                  <span><ShieldCheck size={15} /> Trusted picks</span>
                  <span><Truck size={15} /> Nationwide delivery</span>
                </div>
              </div>
              <div className="home-hero-art" aria-hidden="true">
                <div className="home-hero-glow" />
                <div className="home-device home-device-laptop"><Laptop size={112} strokeWidth={1.15} /></div>
                <div className="home-device home-device-phone"><Smartphone size={71} strokeWidth={1.25} /></div>
                <div className="home-device home-device-audio"><Headphones size={60} strokeWidth={1.25} /></div>
                <span className="home-art-caption">EVERYDAY TECH</span>
                <span className="home-art-orbit home-art-orbit-one" />
                <span className="home-art-orbit home-art-orbit-two" />
              </div>
            </>
          ) : null}
        </div>
        {campaigns.length ? (
          <div className="home-hero-promos">
            {campaigns.slice(0, 2).map((campaign) => <HomePromoBanner key={campaign.id} banner={campaign} />)}
          </div>
        ) : null}
      </section>

      <div className="home-store-notice">
        <span>{storeNotice.title}</span>
        <p><span className="home-store-notice-ticker">{storeNotice.body}</span></p>
        <Link to="/shop">এখনই দেখুন <ArrowUpRight size={14} aria-hidden="true" /></Link>
      </div>

      {tiles.length > 0 ? (
        <section className="section home-category-section">
          <div className="section-head">
            <div className="home-section-heading">
              <span className="home-section-kicker">FIND YOUR NEXT FAVORITE</span>
              <h2>Explore categories</h2>
              <p>Everyday essentials, electronics and more—all in one place.</p>
            </div>
            <Link className="see-more" to="/shop">All categories</Link>
          </div>
          <div className="cat-row home-category-all-row" aria-label="Explore categories">
            {genderTiles.map(({ label, gender, image }) => (
              <Link key={gender} to={`/shop?gender=${gender}`} className="cat-tile" aria-label={label}>
                <div className="cat-photo">
                  {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <div className="photo-fallback" />}
                </div>
                <span>{label}</span>
              </Link>
            ))}
            {tiles.slice(0, 8).map(({ category, image }) => (
              <Link key={category.id} to={`/shop?categoryId=${category.id}`} className="cat-tile">
                <div className="cat-photo">
                  {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <span>{category.name.slice(0, 1)}</span>}
                </div>
                <span>{category.name}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {deals.length > 0 ? (
        <section className="section deals home-deal-section" id="daily-deals">
          <div className="section-head">
            <div className="deal-header-wrap">
              <div className="home-section-heading">
                <span className="home-section-kicker">SPECIAL OFFERS</span>
                <h2>Discounted Products</h2>
              </div>
            </div>
            <Link className="see-more" to="/shop?sort=price_asc">
              See More
            </Link>
          </div>
          <ProductCarousel products={deals} showAvailableStock dealCards autoSlide />
        </section>
      ) : null}

      {collection.length > 0 ? (
        <section className="section home-product-section new-collection">
          <div className="section-head">
            <div className="home-section-heading">
              <span className="home-section-kicker">JUST LANDED</span>
              <h2>New arrivals</h2>
              <p>Fresh finds added to the BazarGrid collection.</p>
            </div>
            <Link className="see-more" to={collectionHref}>
              See More
            </Link>
          </div>
          <ProductCarousel products={collection} autoSlide />
        </section>
      ) : null}

      {best.length > 0 ? (
        <section className="section home-product-section">
          <div className="section-head">
            <div className="home-section-heading">
              <span className="home-section-kicker">CUSTOMER FAVORITES</span>
              <h2>Best sellers</h2>
              <p>Popular picks our shoppers keep coming back for.</p>
            </div>
            <Link className="see-more" to="/shop">
              See More
            </Link>
          </div>
          <ProductCarousel products={best} autoSlide />
        </section>
      ) : null}

      {gadgetBanners.length > 0 ? (
        <section className="home-gadget-showcase" aria-labelledby="home-gadget-showcase-title">
          <div className="home-gadget-showcase-heading">
            <h2 id="home-gadget-showcase-title">Gadget Festive</h2>
          </div>
          <div className="home-gadget-showcase-grid">
            {gadgetBanners.map((banner) => (
              <HomePromoBanner key={banner.id} banner={banner} />
            ))}
          </div>
        </section>
      ) : null}

      {trendingProducts.length > 0 ? (
        <section className="section home-product-section home-trending-section">
          <div className="trending-section-head">
            <div className="trending-title-and-filters">
              <h2>Trending Now</h2>
              <div className="trending-category-filters" aria-label="Filter trending products by category">
                <button
                  type="button"
                  className={trendingCategoryId === "all" ? "is-active" : ""}
                  aria-pressed={trendingCategoryId === "all"}
                  onClick={() => setTrendingCategoryId("all")}
                >
                  All
                </button>
                {trendingCategories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={trendingCategoryId === category.id ? "is-active" : ""}
                    aria-pressed={trendingCategoryId === category.id}
                    onClick={() => setTrendingCategoryId(category.id)}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>
            <Link className="see-more" to="/shop">
              See More
            </Link>
          </div>
          <ProductCarousel key={trendingCategoryId} products={visibleTrending} autoSlide />
        </section>
      ) : null}

        </>
      )}
    </div>
  );
}
