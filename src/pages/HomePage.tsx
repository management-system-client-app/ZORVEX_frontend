import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, BadgePercent, Headphones, LayoutGrid, Laptop, PackageSearch, ShieldCheck, Smartphone, Sparkles, Truck } from "lucide-react";
import { api, DATA_REFRESH_INTERVAL, hydrateImages } from "../api";
import { categoryTiles } from "../components/Chrome";
import { ProductCarousel } from "../components/ProductCard";
import { productFlags } from "../format";
import { useStore } from "../state";
import type { HomeBlock, HomePayload, ProductCardData } from "../types";

const getCountdownParts = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
};

const getTimeUntilDailyReset = (now: number) => {
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  return tomorrow.getTime() - now;
};

const HOME_CACHE_KEY = "store_home_payload_v2";
const LATEST_PRODUCTS_CACHE_KEY = "store_latest_products";
const DAILY_DEALS_CACHE_KEY = "store_daily_deals";
const BEST_SELLERS_CACHE_KEY = "store_best_sellers";

function isProductList(value: unknown): value is ProductCardData[] {
  return (
    Array.isArray(value) &&
    value.every(
      (product) =>
        typeof product === "object" &&
        product !== null &&
        "id" in product &&
        typeof product.id === "string" &&
        "name" in product &&
        typeof product.name === "string" &&
        "basePrice" in product,
    )
  );
}

function readCachedProducts(key: string): ProductCardData[] {
  try {
    const cached: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return isProductList(cached) ? cached : [];
  } catch (reason) {
    console.warn("Cached products could not be read", reason);
    return [];
  }
}

function cacheProducts(key: string, products: ProductCardData[]) {
  try {
    localStorage.setItem(key, JSON.stringify(products));
  } catch (reason) {
    console.warn("Products could not be cached", reason);
  }
}

function readCachedDailyDeals(): ProductCardData[] {
  return readCachedProducts(DAILY_DEALS_CACHE_KEY);
}

function cacheDailyDeals(products: ProductCardData[]) {
  cacheProducts(DAILY_DEALS_CACHE_KEY, products);
}

function readCachedHome(): HomePayload | null {
  try {
    const cached: unknown = JSON.parse(localStorage.getItem(HOME_CACHE_KEY) ?? "null");
    if (
      typeof cached === "object" &&
      cached !== null &&
      "banners" in cached &&
      Array.isArray(cached.banners) &&
      "campaigns" in cached &&
      Array.isArray(cached.campaigns) &&
      "newArrivals" in cached &&
      Array.isArray(cached.newArrivals) &&
      "trendingProducts" in cached &&
      Array.isArray(cached.trendingProducts)
    ) {
      return cached as HomePayload;
    }
  } catch (reason) {
    console.warn("Cached home content could not be read", reason);
  }
  return null;
}

function cacheHome(home: HomePayload) {
  try {
    localStorage.setItem(HOME_CACHE_KEY, JSON.stringify(home));
  } catch (reason) {
    console.warn("Home content could not be cached", reason);
  }
}

function HomeBannerSlider({ banners }: { banners: HomeBlock[] }) {
  const slides = banners.filter((banner) => banner.imageUrl);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (slides.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
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
      <span className="home-promo-image-caption">
        <strong>{banner.title}</strong>
        {banner.subtitle ? <span>{banner.subtitle}</span> : null}
      </span>
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
  const [initialHome] = useState(readCachedHome);
  const [banners, setBanners] = useState<HomeBlock[]>(() => initialHome?.banners.filter((banner) => banner.imageUrl) ?? []);
  const [campaigns, setCampaigns] = useState<HomeBlock[]>(() =>
    initialHome?.campaigns.filter((campaign) => campaign.imageUrl).slice(0, 2) ?? [],
  );
  const [dailyDeals, setDailyDeals] = useState<ProductCardData[]>(() => {
    const cachedDeals = readCachedDailyDeals();
    if (cachedDeals.length > 0) return cachedDeals;
    return (initialHome?.trendingProducts ?? []).filter((product) => productFlags(product).onSale);
  });
  const dailyDealsRef = useRef(dailyDeals);
  const initialArrival = initialHome?.newArrivals[0];
  const [arrivals, setArrivals] = useState<ProductCardData[]>(initialArrival?.products ?? []);
  const [arrivalHref, setArrivalHref] = useState(
    initialArrival?.categoryId ? `/shop?categoryId=${initialArrival.categoryId}` : "/shop?sort=latest",
  );
  const [selectedTrending, setSelectedTrending] = useState<ProductCardData[]>(initialHome?.trendingProducts ?? []);
  const [latestProducts, setLatestProducts] = useState<ProductCardData[]>(() =>
    readCachedProducts(LATEST_PRODUCTS_CACHE_KEY),
  );
  const homePayloadVersion = useRef(0);
  const [best, setBest] = useState<ProductCardData[]>(() => readCachedProducts(BEST_SELLERS_CACHE_KEY));
  const [timeLeft, setTimeLeft] = useState(() => getTimeUntilDailyReset(Date.now()));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(initialHome === null);
  const skeletonRef = useRef<HTMLDivElement>(null);
  const [reservedHeight, setReservedHeight] = useState(0);
  const isLoading = loading;

  function updateDailyDeals(products: ProductCardData[]) {
    if (products.length === 0) return;
    const discounted = products.filter((product) => productFlags(product).onSale);
    const nextDeals = discounted.length > 0 ? discounted : dailyDealsRef.current.length === 0 ? products : [];
    if (nextDeals.length === 0) return;
    dailyDealsRef.current = nextDeals;
    setDailyDeals(nextDeals);
    cacheDailyDeals(nextDeals);
  }

  function applyHomePayload(home: HomePayload, isActive: () => boolean = () => true) {
    const version = ++homePayloadVersion.current;
    cacheHome(home);
    setBanners(home.banners.filter((banner) => banner.imageUrl));
    setCampaigns(home.campaigns.filter((campaign) => campaign.imageUrl).slice(0, 2));
    const arrivalBlock = home.newArrivals[0];
    setArrivals(arrivalBlock?.products ?? []);
    setArrivalHref(arrivalBlock?.categoryId ? `/shop?categoryId=${arrivalBlock.categoryId}` : "/shop?sort=latest");
    setSelectedTrending(home.trendingProducts);
    updateDailyDeals(home.trendingProducts);
    void hydrateImages(home.trendingProducts).then(
      (products) => {
        if (isActive() && version === homePayloadVersion.current) {
          setSelectedTrending(products);
          cacheHome({ ...home, trendingProducts: products });
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
        cacheProducts(LATEST_PRODUCTS_CACHE_KEY, result.items);
        updateDailyDeals(result.items);
        setLoading(false);
        const products = await hydrateImages(result.items);
        if (active) {
          setLatestProducts(products);
          cacheProducts(LATEST_PRODUCTS_CACHE_KEY, products);
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
          cacheProducts(BEST_SELLERS_CACHE_KEY, products);
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
          cacheProducts(LATEST_PRODUCTS_CACHE_KEY, result.items);
            setBest(bestSellers);
            cacheProducts(BEST_SELLERS_CACHE_KEY, bestSellers);
            updateDailyDeals(result.items);
            const products = await hydrateImages(result.items);
            if (active) {
            setLatestProducts(products);
            cacheProducts(LATEST_PRODUCTS_CACHE_KEY, products);
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
    const timer = window.setInterval(refreshHome, DATA_REFRESH_INTERVAL);
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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTimeLeft(getTimeUntilDailyReset(Date.now()));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const tiles = categoryTiles(catalog.categories, categoryImages);
  const deals = dailyDeals;
  const collection = [...new Map([...latestProducts, ...arrivals].map((product) => [product.id, product])).values()]
    .slice(0, 12);
  const collectionHref = latestProducts.length > 0 ? "/shop?sort=latest" : arrivalHref;
  const countdown = getCountdownParts(timeLeft);
  const hasHomeContent = Boolean(
    banners.length || campaigns.length || tiles.length || deals.length || collection.length || best.length || selectedTrending.length,
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
            {campaigns.map((campaign) => <HomePromoBanner key={campaign.id} banner={campaign} />)}
          </div>
        ) : null}
      </section>

      <div className="home-store-notice">
        <span>RESELLKORI UPDATE</span>
        <p>নতুন পণ্য, দারুণ অফার আর সারা দেশের পছন্দের কালেকশন—সব এক জায়গায়।</p>
        <Link to="/shop">এখনই দেখুন <ArrowUpRight size={14} aria-hidden="true" /></Link>
      </div>

      <nav className="home-marketplace-strip" aria-label="Quick shopping links">
        <Link to="/shop">
          <span className="marketplace-strip-icon"><LayoutGrid size={18} /></span>
          <span><strong>Shop all categories</strong><small>Explore the full marketplace</small></span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        <Link to="/shop?sort=latest">
          <span className="marketplace-strip-icon"><Sparkles size={18} /></span>
          <span><strong>Just added</strong><small>See the latest products</small></span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        <Link to="/shop?sort=price_asc">
          <span className="marketplace-strip-icon"><BadgePercent size={18} /></span>
          <span><strong>Budget finds</strong><small>Browse by lowest price</small></span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
        <Link to="/track">
          <span className="marketplace-strip-icon"><PackageSearch size={18} /></span>
          <span><strong>Track an order</strong><small>Check your delivery status</small></span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </nav>

      {tiles.length > 0 ? (
        <section className="section home-category-section">
          <div className="section-head">
            <div className="home-section-heading">
              <span className="home-section-kicker">FIND YOUR NEXT FAVORITE</span>
              <h2>Explore categories</h2>
              <p>Everyday essentials, electronics and more—all in one place.</p>
            </div>
            <Link className="see-more" to="/shop">All categories <ArrowRight size={14} /></Link>
          </div>
          <div className="cat-row">
            {tiles.map(({ category, image }) => (
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
                <span className="home-section-kicker">HANDPICKED FOR YOU</span>
                <h2>Today’s best deals</h2>
              </div>
              <div className="countdown-box" aria-live="polite">
                <span>Ends in</span>
                <div className="countdown-stack">
                  <strong>{String(countdown.hours).padStart(2, "0")}</strong>
                  <small>H</small>
                </div>
                <div className="countdown-stack">
                  <strong>{String(countdown.minutes).padStart(2, "0")}</strong>
                  <small>M</small>
                </div>
                <div className="countdown-stack">
                  <strong>{String(countdown.seconds).padStart(2, "0")}</strong>
                  <small>S</small>
                </div>
              </div>
            </div>
            <Link className="see-more" to="/shop?sort=price_asc">
              See More
            </Link>
          </div>
          <ProductCarousel products={deals} showAvailableStock dealCards />
        </section>
      ) : null}

      {collection.length > 0 ? (
        <section className="section home-product-section new-collection">
          <div className="section-head">
            <div className="home-section-heading">
              <span className="home-section-kicker">JUST LANDED</span>
              <h2>New arrivals</h2>
              <p>Fresh finds added to the ResellKori collection.</p>
            </div>
            <Link className="see-more" to={collectionHref}>
              See More
            </Link>
          </div>
          <ProductCarousel products={collection} />
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
          <ProductCarousel products={best} />
        </section>
      ) : null}

      {selectedTrending.length > 0 ? (
        <section className="section home-product-section">
          <div className="section-head">
            <div className="home-section-heading">
              <span className="home-section-kicker">TRENDING NOW</span>
              <h2>Popular picks</h2>
              <p>See what’s catching everyone’s eye right now.</p>
            </div>
            <Link className="see-more" to="/shop">
              See More
            </Link>
          </div>
          <ProductCarousel products={selectedTrending} />
        </section>
      ) : null}

        </>
      )}
    </div>
  );
}
