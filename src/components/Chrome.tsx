import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, ChevronRight, Gift, Heart, House, LayoutGrid, Mail, MapPin, Menu, Minus, PackageSearch, Phone, Plus, Search, ShoppingBag, Trash2, UserRound, X, Zap } from "lucide-react";
import { api } from "../api";
import { RowsSkeleton } from "./Skeleton";
import { coverImage, money } from "../format";
import { categoryImage, useAuth, useCart, useStore } from "../state";
import type { Category, ProductCardData, User } from "../types";

export function UserFace({ user, size = 32, className = "" }: { user: Pick<User, "firstName" | "email" | "avatarUrl">; size?: number; className?: string }) {
  const style = { width: size, height: size, fontSize: Math.max(11, Math.round(size * 0.4)) };
  if (user.avatarUrl) {
    return <img className={`user-face ${className}`} src={user.avatarUrl} alt="" style={style} />;
  }
  return (
    <span className={`user-face user-face-default ${className}`} style={style} role="img" aria-label="Default user avatar">
      <UserRound size={Math.max(13, Math.round(size * 0.58))} strokeWidth={1.7} />
    </span>
  );
}

function navClass(href: string, isActive: boolean, pathname: string, search: string) {
  const url = new URL(href, "http://local");
  const here = new URLSearchParams(search);
  if (url.search) {
    const want = url.searchParams;
    const matched = pathname === url.pathname && [...want.keys()].every((key) => here.get(key) === want.get(key));
    return matched ? "on" : "";
  }
  if (url.pathname === "/shop") return pathname === "/shop" && here.toString() === "" ? "on" : "";
  return isActive ? "on" : "";
}

function CategoryList({
  categories,
  expandedCategory,
  onToggle,
  onHover,
  onNavigate,
}: {
  categories: Category[];
  expandedCategory: string | null;
  onToggle: (id: string) => void;
  onHover: (id: string | null) => void;
  onNavigate: () => void;
}) {
  const roots = categories.filter((category) => !category.parentId);
  return (
    <div className="category-menu-list">
      {roots.map((category) => {
        const children = categories.filter((item) => item.parentId === category.id);
        const expanded = expandedCategory === category.id;
        return (
          <div
            className="category-menu-group"
            key={category.id}
            onMouseEnter={() => {
              if (window.matchMedia("(min-width: 900px)").matches) onHover(children.length > 0 ? category.id : null);
            }}
          >
            <div className={`category-menu-row${expanded ? " is-expanded" : ""}`}>
              <Link className="category-menu-link" to={`/shop?categoryId=${category.id}`} onClick={onNavigate}>
                <strong>{category.name}</strong>
              </Link>
              {children.length > 0 ? (
                <button
                  type="button"
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${category.name}`}
                  aria-expanded={expanded}
                  onClick={() => onToggle(category.id)}
                >
                  <ChevronRight size={16} />
                </button>
              ) : <span className="category-menu-arrow" aria-hidden="true"><ChevronRight size={16} /></span>}
            </div>
            {expanded ? (
              <div className="category-menu-children">
                {children.map((child) => (
                  <Link key={child.id} to={`/shop?categoryId=${child.id}`} onClick={onNavigate}>
                    {child.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function Header() {
  const { catalog } = useStore();
  const { user, ready, logout } = useAuth();
  const { cart, drawer, setDrawer } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [searchError, setSearchError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<ProductCardData[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [wishlistCount, setWishlistCount] = useState(0);

  function closeCategoryMenu() {
    setMenuOpen(false);
    setExpandedCategory(null);
  }

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setWishlistCount(0);
      return;
    }

    let active = true;
    const loadWishlistCount = () => {
      api.wishlist()
        .then((items) => {
          if (active) setWishlistCount(items.length);
        })
        .catch((reason: unknown) => {
          console.error("Could not load wishlist count", reason);
        });
    };
    loadWishlistCount();
    window.addEventListener("wishlist-updated", loadWishlistCount);
    return () => {
      active = false;
      window.removeEventListener("wishlist-updated", loadWishlistCount);
    };
  }, [ready, user, location.pathname]);

  useEffect(() => {
    const desktopLayout = window.matchMedia("(min-width: 900px)");
    function resetCategoryMenu() {
      closeCategoryMenu();
    }
    desktopLayout.addEventListener("change", resetCategoryMenu);
    return () => desktopLayout.removeEventListener("change", resetCategoryMenu);
  }, []);

  useEffect(() => {
    const responsiveSearch = window.matchMedia("(max-width: 699px)");
    if (!searchOpen || !responsiveSearch.matches) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    searchInputRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSearchOpen(false);
    }
    function onResize() {
      if (!responsiveSearch.matches) setSearchOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onResize);
    };
  }, [searchOpen]);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setSuggestions([]);
      setSuggestionsLoading(false);
      setActiveSuggestion(-1);
      return;
    }

    let active = true;
    setSuggestions([]);
    setSuggestionsLoading(true);
    setActiveSuggestion(-1);
    const timer = window.setTimeout(() => {
      api.products({ search: term, status: "ACTIVE", limit: 6, page: 1 })
        .then(({ items }) => {
          if (active) setSuggestions(items);
        })
        .catch(() => {
          if (active) setSuggestions([]);
        })
        .finally(() => {
          if (active) setSuggestionsLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  function onSearch(event: FormEvent) {
    event.preventDefault();
    if (suggestionsOpen && activeSuggestion >= 0) {
      const selected = suggestions[activeSuggestion];
      if (selected) {
        navigate(`/product/${selected.id}`);
        setSearchOpen(false);
        setSuggestionsOpen(false);
        return;
      }
    }
    const term = query.trim();
    if (!term) {
      setSearchError("Enter a search term");
      setSuggestionsOpen(false);
      searchInputRef.current?.focus();
      return;
    }
    setSearchError("");
    navigate(`/shop?search=${encodeURIComponent(term)}`);
    setSearchOpen(false);
    setSuggestionsOpen(false);
  }

  function selectSuggestion(product: ProductCardData) {
    navigate(`/product/${product.id}`);
    setSearchOpen(false);
    setSuggestionsOpen(false);
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestionsOpen || suggestions.length === 0) {
      if (event.key === "Escape") setSuggestionsOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestion((current) => (current + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestion((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      setSuggestionsOpen(false);
      setActiveSuggestion(-1);
    }
  }

  const topLevelCategories = catalog.categories
    .filter((category) => !category.parentId && category.isActive !== false)
    .sort((first, second) => (first.sortOrder ?? 0) - (second.sortOrder ?? 0) || first.name.localeCompare(second.name));
  const navLinks = [
    { label: "All Products", href: "/shop" },
    ...topLevelCategories.map((category) => ({
      label: category.name,
      href: `/shop?categoryId=${category.id}`,
    })),
  ];
  const bottomNavOverlayOpen = menuOpen || accountMenuOpen || drawer;

  return (
    <>
      <header className={location.pathname === "/" ? "header home-header" : "header"}>
        <div className="header-container">
        <div className="topbar">
          <div className="header-brands">
            <Link to="/" className="logo sara-logo" aria-label="ResellKori home">
              <span className="sara-logo-main">Resell<span className="resell-logo-accent">Kori</span></span>
              <span className="sara-logo-sub">SMART SHOPPING · BETTER VALUE</span>
            </Link>
          </div>
          <form onSubmit={onSearch} className={`header-search${searchOpen ? " is-open" : ""}`}>
            <button type="button" className="mobile-search-back" onClick={() => setSearchOpen(false)}><ArrowLeft size={17} />Back</button>
            <input
              ref={searchInputRef}
              id="header-search-input"
              value={query}
              onChange={(event) => { setQuery(event.target.value); setSearchError(""); setSuggestionsOpen(true); }}
              onKeyDown={onSearchKeyDown}
              placeholder="I'm shopping for ..."
              aria-label="Search products"
              aria-invalid={Boolean(searchError)}
              aria-describedby={searchError ? "header-search-error" : undefined}
              aria-autocomplete="list"
              aria-expanded={suggestionsOpen && Boolean(query.trim())}
              aria-controls="header-search-suggestions"
              aria-activedescendant={activeSuggestion >= 0 ? `header-search-option-${activeSuggestion}` : undefined}
            />
            {searchError ? <p className="header-search-error" id="header-search-error" role="alert">{searchError}</p> : null}
            {suggestionsOpen && query.trim() ? (
              <div className="search-suggestions" id="header-search-suggestions" role="listbox" aria-label="Product suggestions">
                {suggestionsLoading ? <p className="search-suggestions-state">Searching products...</p> : suggestions.length > 0 ? suggestions.map((product, index) => {
                  const image = coverImage(product);
                  return (
                    <button
                      type="button"
                      className={`search-suggestion${activeSuggestion === index ? " is-active" : ""}`}
                      id={`header-search-option-${index}`}
                      role="option"
                      aria-selected={activeSuggestion === index}
                      key={product.id}
                      onMouseEnter={() => setActiveSuggestion(index)}
                      onClick={() => selectSuggestion(product)}
                    >
                      {image ? <img src={image} alt="" /> : <span className="search-suggestion-fallback"><ShoppingBag size={17} /></span>}
                      <span className="search-suggestion-copy">
                        <strong>{product.name}</strong>
                        {product.brand?.name ? <small>{product.brand.name}</small> : null}
                      </span>
                      <span className="search-suggestion-price">{money(product.basePrice)}</span>
                    </button>
                  );
                }) : <p className="search-suggestions-state">No matching products</p>}
              </div>
            ) : null}
            <button type="submit" aria-label="Search"><Search size={20} strokeWidth={1.7} /></button>
          </form>
          <nav className="header-promo-links" aria-label="Store offers">
            <Link to="/#daily-deals"><Gift size={19} /><span><strong>Offers</strong><small>Latest offers</small></span></Link>
            <Link to="/shop?sort=price_asc"><Zap size={19} /><span><strong>Budget finds</strong><small>Special deals</small></span></Link>
          </nav>
          <div className="header-tools">
            <button
              type="button"
              className="icon-btn mobile-search-toggle"
              aria-label={searchOpen ? "Close search" : "Open search"}
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((open) => !open)}
            >
              <Search size={20} strokeWidth={1.7} />
            </button>
            <Link to="/wishlist" className="icon-btn header-wishlist" aria-label={wishlistCount > 0 ? `Wishlist, ${wishlistCount} items` : "Wishlist"} title="Wishlist">
              <Heart size={20} strokeWidth={1.7} />
              {wishlistCount > 0 ? <span className="badge">{wishlistCount}</span> : null}
            </Link>
            <button type="button" className="icon-btn header-cart" aria-label="Cart" onClick={() => setDrawer(true)}>
              <ShoppingBag size={20} strokeWidth={1.7} />
              {cart.summary.itemCount > 0 ? <span className="badge">{cart.summary.itemCount}</span> : null}
            </button>
            {user ? (
              <div className="header-account-wrap">
                <div className="account-chip header-account-profile" tabIndex={0} role="group" aria-label="Account options">
                  <UserFace user={user} size={40} />
                  <span className="header-account-profile-copy">
                    <strong>{`${user.firstName} ${user.lastName}`.trim()}</strong>
                    <small>{user.phone || user.email}</small>
                  </span>
                </div>
                <nav className="header-account-dropdown" aria-label="Account menu">
                  <Link to={user.accountType === "ADMIN" ? "/admin" : "/account"}>Dashboard</Link>
                  <Link to={user.accountType === "ADMIN" ? "/admin/orders" : "/account/orders"}>My Orders</Link>
                  <Link to={user.accountType === "ADMIN" ? "/admin/settings" : "/account/profile"}>My Account</Link>
                  <Link to="/track">Order Tracking</Link>
                  <button type="button" onClick={() => { logout().then(() => navigate("/")); }}>Logout</button>
                </nav>
              </div>
            ) : !ready ? (
              <span className="header-account-pending" aria-label="Checking account status"><UserRound size={18} strokeWidth={1.7} /></span>
            ) : (
              <span className="header-account-guest">
                <span className="header-account-avatar" aria-hidden="true"><UserRound size={18} strokeWidth={1.7} /></span>
                <span className="account-chip account-actions">
                <Link to="/login">Login</Link>
                <Link to="/register">Register</Link>
                </span>
              </span>
            )}
          </div>
        </div>
        <nav className="category-nav" aria-label="Product categories">
          <div
            className="category-menu-anchor"
            onMouseLeave={() => {
              if (window.matchMedia("(min-width: 900px)").matches) closeCategoryMenu();
            }}
          >
            <button
              type="button"
              className="cat-btn"
              aria-expanded={menuOpen}
              aria-controls="category-menu-panel"
              onMouseEnter={() => {
                if (window.matchMedia("(min-width: 900px)").matches) setMenuOpen(true);
              }}
              onClick={() => {
                if (window.matchMedia("(min-width: 900px)").matches) setMenuOpen(true);
                else setMenuOpen((open) => !open);
              }}
            >
              <Menu size={20} strokeWidth={2.8} />
              <span>Shop By Category</span>
            </button>
            {menuOpen ? (
              <>
                <button className="sheet-back category-menu-backdrop" aria-label="Close category menu" onClick={closeCategoryMenu} />
                <aside id="category-menu-panel" className="category-menu-panel" role="dialog" aria-label="All Categories">
                  <header className="category-menu-heading">
                    <div className="category-menu-heading-copy">
                      <span className="category-menu-heading-mark"><LayoutGrid size={19} strokeWidth={1.7} /></span>
                      <span><strong>Shop by category</strong></span>
                    </div>
                    <button type="button" aria-label="Close category menu" onClick={closeCategoryMenu}><X size={19} /></button>
                  </header>
                  <div className="category-menu-body">
                    <div className="category-menu-section-head">
                      <span>Departments</span>
                      <span className="category-menu-count">{catalog.categories.filter((category) => !category.parentId).length}</span>
                    </div>
                    <CategoryList
                      categories={catalog.categories}
                      expandedCategory={expandedCategory}
                      onToggle={(categoryId) =>
                        setExpandedCategory((current) => (current === categoryId ? null : categoryId))
                      }
                      onHover={setExpandedCategory}
                      onNavigate={closeCategoryMenu}
                    />
                  </div>
                </aside>
              </>
            ) : null}
          </div>
          <nav className="top-nav" aria-label="Shop">
            {navLinks.map((item) => {
              const active = item.label === "Home"
                ? location.pathname === "/"
                : navClass(item.href, false, location.pathname, location.search);
              const compactHidden = item.label === "Budget Deals" || item.label === "Best Deals";
              return <Link key={item.label} to={item.href} className={`${item.label === "Home" ? "home-link " : ""}${compactHidden ? "compact-hidden " : ""}${active ? "on" : ""}`} aria-current={active ? "page" : undefined}>{item.label}</Link>;
            })}
          </nav>
          <div className="category-nav-tools">
            <Link to="/track"><PackageSearch size={16} strokeWidth={1.7} />Order Tracking</Link>
          </div>
        </nav>
        </div>
      </header>
      <nav className="bottom-nav" aria-label="Mobile">
        <NavLink to="/" end className={({ isActive }) => (isActive && !bottomNavOverlayOpen ? "on" : "")} onClick={() => { setMenuOpen(false); setAccountMenuOpen(false); setDrawer(false); }}>
          <House size={18} strokeWidth={1.7} />
          Home
        </NavLink>
        <button
          type="button"
          className={`bottom-nav-category${menuOpen && !accountMenuOpen && !drawer ? " on" : ""}`}
          aria-expanded={menuOpen}
          onClick={() => { setAccountMenuOpen(false); setDrawer(false); setMenuOpen((open) => !open); }}
        >
          <LayoutGrid size={18} strokeWidth={1.7} />
          Category
        </button>
        <NavLink to="/wishlist" className={({ isActive }) => (isActive && !bottomNavOverlayOpen ? "on" : "")} onClick={() => { setMenuOpen(false); setAccountMenuOpen(false); setDrawer(false); }}>
          <Heart size={18} strokeWidth={1.7} />
          Wishlist
        </NavLink>
        <button
          type="button"
          className={!menuOpen && !accountMenuOpen && (drawer || location.pathname === "/cart") ? "on" : ""}
          aria-haspopup="dialog"
          onClick={() => { setMenuOpen(false); setAccountMenuOpen(false); setDrawer(true); }}
        >
          <ShoppingBag size={18} strokeWidth={1.7} />
          Cart
        </button>
        <button
          type="button"
          className={accountMenuOpen || (!menuOpen && !drawer && (location.pathname.startsWith("/account") || location.pathname === "/login" || location.pathname === "/register")) ? "on" : ""}
          aria-expanded={accountMenuOpen}
          aria-controls="account-menu-panel"
          onClick={() => { setMenuOpen(false); setDrawer(false); setAccountMenuOpen((open) => !open); }}
        >
          {user ? <UserFace user={user} size={18} /> : <UserRound size={18} strokeWidth={1.7} />}
          Account
        </button>
      </nav>
      {accountMenuOpen ? (
        <>
          <button className="sheet-back account-menu-backdrop" aria-label="Close account menu" onClick={() => setAccountMenuOpen(false)} />
          <aside id="account-menu-panel" className="account-menu-panel" role="dialog" aria-modal="true" aria-label="My Account">
            <header className="category-menu-heading account-menu-heading">
              <div className="category-menu-heading-copy">
                <span className="category-menu-heading-mark"><UserRound size={19} strokeWidth={1.7} /></span>
                <span><strong>My Account</strong></span>
              </div>
              <button type="button" aria-label="Close account menu" onClick={() => setAccountMenuOpen(false)}><X size={19} /></button>
            </header>
            <div className="account-menu-profile">
              {user ? <UserFace user={user} size={48} /> : <span className="account-menu-avatar"><UserRound size={24} strokeWidth={1.5} /></span>}
              <span className="account-menu-profile-copy">
                <strong>{user ? user.firstName : "User Account"}</strong>
                <small>{user ? user.email : "Sign in or create an account"}</small>
              </span>
            </div>
            <nav className="account-menu-links" aria-label="Account links">
              {user ? (
                user.accountType === "ADMIN" ? (
                  <Link to="/admin" onClick={() => setAccountMenuOpen(false)}><span className="account-menu-link-icon"><LayoutGrid size={17} /></span><span>Dashboard</span><ArrowRight size={16} /></Link>
                ) : (
                  <>
                    <Link to="/account/profile" onClick={() => setAccountMenuOpen(false)}><span className="account-menu-link-icon"><UserRound size={17} /></span><span>Profile</span><ArrowRight size={16} /></Link>
                    <Link to="/account/orders" onClick={() => setAccountMenuOpen(false)}><span className="account-menu-link-icon"><PackageSearch size={17} /></span><span>Orders</span><ArrowRight size={16} /></Link>
                    <Link to="/account/wishlist" onClick={() => setAccountMenuOpen(false)}><span className="account-menu-link-icon"><Heart size={17} /></span><span>Wishlist</span><ArrowRight size={16} /></Link>
                  </>
                )
              ) : (
                <>
                  <Link to="/login" onClick={() => setAccountMenuOpen(false)}><span className="account-menu-link-icon"><UserRound size={17} /></span><span>Login</span><ArrowRight size={16} /></Link>
                  <Link to="/register" onClick={() => setAccountMenuOpen(false)}><span className="account-menu-link-icon"><Mail size={17} /></span><span>Register</span><ArrowRight size={16} /></Link>
                </>
              )}
              <Link to="/track" onClick={() => setAccountMenuOpen(false)}><span className="account-menu-link-icon"><PackageSearch size={17} /></span><span>Order Tracking</span><ArrowRight size={16} /></Link>
            </nav>
          </aside>
        </>
      ) : null}
      <CartDrawer />
    </>
  );
}

function CartDrawer() {
  const { cart, drawer, setDrawer, remove, setQuantity, busy, loading } = useCart();
  if (!drawer) return null;
  return (
    <>
      <button className="drawer-back cart-drawer-back" aria-label="Close cart" onClick={() => setDrawer(false)} />
      <aside className="drawer cart-drawer" role="dialog" aria-modal="true" aria-label="Shopping cart">
        <header className="category-menu-heading cart-drawer-header">
          <div className="category-menu-heading-copy cart-drawer-title">
            <span className="category-menu-heading-mark cart-drawer-mark"><ShoppingBag size={21} strokeWidth={1.8} /></span>
            <span><strong>Your Cart</strong><small>{cart.summary.itemCount} {cart.summary.itemCount === 1 ? "item" : "items"}</small></span>
          </div>
          <button type="button" className="cart-drawer-close" aria-label="Close cart" onClick={() => setDrawer(false)}>
            <X size={20} />
          </button>
        </header>
        <div className="drawer-body cart-drawer-body">
          {loading ? <RowsSkeleton rows={3} /> : null}
          {!loading && cart.items.length === 0 ? (
            <div className="cart-empty-state">
              <span><ShoppingBag size={30} strokeWidth={1.5} /></span>
              <strong>Your cart is waiting</strong>
              <p>Find something you love and it will appear here.</p>
              <Link to="/shop" onClick={() => setDrawer(false)}>Explore the store <ArrowRight size={15} /></Link>
            </div>
          ) : null}
          {!loading && cart.items.map((line) => (
            <article className="cart-line" key={line.id}>
              <div className="cart-line-image">
                {line.imageUrl ? <img src={line.imageUrl} alt="" /> : <ShoppingBag size={24} strokeWidth={1.5} />}
              </div>
              <div className="cart-line-details">
                <div className="cart-line-heading">
                  <h3>{line.variant.product.name}</h3>
                  <button type="button" className="cart-remove" disabled={busy} onClick={() => remove(line.id)} aria-label={`Remove ${line.variant.product.name}`} title="Remove item">
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="cart-line-meta">
                  {line.variant.optionLabel ? <span>{line.variant.optionLabel}</span> : null}
                  {line.variant.size ? <span>{line.variant.size.name}</span> : null}
                  {line.variant.color ? <span>{line.variant.color.name}</span> : null}
                  {line.variant.fabric ? <span>{line.variant.fabric.name}</span> : null}
                </div>
                <div className="cart-line-bottom">
                  <div className="cart-quantity-controls">
                  <button type="button" disabled={busy} onClick={() => setQuantity(line, line.quantity - 1)} aria-label="Decrease">
                    <Minus size={14} />
                  </button>
                  <span>{line.quantity}</span>
                  <button type="button" disabled={busy} onClick={() => setQuantity(line, line.quantity + 1)} aria-label="Increase">
                    <Plus size={14} />
                  </button>
                  </div>
                  <strong className="cart-line-price">{money(line.lineTotal)}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
        {cart.items.length > 0 ? <footer className="cart-drawer-footer">
          <div className="cart-subtotal">
            <span>Subtotal</span>
            <strong>{money(cart.summary.subtotal)}</strong>
          </div>
          <Link to="/checkout" className="cart-checkout" onClick={() => setDrawer(false)}>
            Checkout <ArrowRight size={17} />
          </Link>
          <Link to="/cart" className="cart-view-link" onClick={() => setDrawer(false)}>
            View full cart
          </Link>
        </footer> : null}
      </aside>
    </>
  );
}

export function Footer() {
  const { settings, settingsReady } = useStore();
  const { user } = useAuth();
  const contactAddress = settings.address || "Avenue #02A, Road #13, House No #1339, Mirpur DOHS, Dhaka-1216, Bangladesh.";
  const contactPhone = settings.supportPhone || "+88-01885-998899";
  const contactEmail = settings.supportEmail || "support@resellkori.com";
  const creationSocials = [
    { name: "Facebook", mark: "f", className: "footer-facebook", href: settings.facebookUrl },
    { name: "YouTube", mark: "▶", className: "footer-youtube" },
    { name: "Instagram", mark: "◎", className: "footer-instagram", href: settings.instagramUrl },
    { name: "TikTok", mark: "♪", className: "footer-tiktok" },
  ];

  return (
    <footer className="footer">
      <div className="footer-grid">
        <section className="footer-column footer-contact">
          <h3>Contact Us</h3>
          {!settingsReady ? <RowsSkeleton rows={3} /> : (
            <div className="footer-contact-list">
              <p className="footer-contact-item">
                <span className="footer-contact-icon" aria-hidden="true"><MapPin size={12} strokeWidth={1.7} /></span>
                <span>{contactAddress}</span>
              </p>
              <a className="footer-contact-item" href={`tel:${contactPhone}`}>
                <span className="footer-contact-icon" aria-hidden="true"><Phone size={12} strokeWidth={1.7} /></span>
                <span>{contactPhone}</span>
              </a>
              <a className="footer-contact-item" href={`mailto:${contactEmail}`}>
                <span className="footer-contact-icon" aria-hidden="true"><Mail size={12} strokeWidth={1.7} /></span>
                <span>{contactEmail}</span>
              </a>
            </div>
          )}
        </section>
        <nav className="footer-column" aria-label="Company">
          <h3>Company</h3>
          <Link to="/pages/blogs">Blogs</Link>
          <Link to="/outlets">Outlets</Link>
          <Link to="/pages/about">About Us</Link>
          <Link to="/pages/contact">Contact Us</Link>
        </nav>
        <nav className="footer-column" aria-label="Customer">
          <h3>Customer</h3>
          {user ? (
            <>
              <Link to={user.accountType === "ADMIN" ? "/admin" : "/account"}>Dashboard</Link>
              <Link to="/wishlist">Wishlist</Link>
            </>
          ) : (
            <>
              <Link to="/login">Login</Link>
              <Link to="/register">Register</Link>
            </>
          )}
          <Link to="/cart">Cart</Link>
          <Link to="/shop?sort=price_asc">Budget Deals</Link>
          <Link to="/#daily-deals">Best Deals</Link>
        </nav>
        <nav className="footer-column" aria-label="Help">
          <h3>Help</h3>
          <Link to="/pages/faqs">FAQs</Link>
          <Link to="/pages/privacy-policy">Privacy Policy</Link>
          <Link to="/pages/cookies-policy">Cookies Policy</Link>
          <Link to="/pages/replacement-policy">Replacement Policy</Link>
          <Link to="/pages/terms-and-conditions">Terms &amp; Conditions</Link>
        </nav>
        <section className="footer-column footer-social-column">
          <h3>Follow ResellKori</h3>
          <div className="footer-socials" aria-label="ResellKori social media">
            {creationSocials.map((social) => {
              const className = `footer-social-icon ${social.className}`;
              return social.href
                ? <div key={social.name} className="footer-social-item"><a className={className} href={social.href} target="_blank" rel="noreferrer" aria-label={social.name}>{social.mark}</a><span className="footer-social-name">{social.name}</span></div>
                : <div key={social.name} className="footer-social-item"><span className={className} aria-hidden="true">{social.mark}</span><span className="footer-social-name">{social.name}</span></div>;
            })}
          </div>
        </section>
      </div>
      <div className="footer-bottom">
        © {new Date().getFullYear()} ResellKori. All Rights Reserved
      </div>
    </footer>
  );
}

export function categoryTiles(categories: Category[], images: Map<string, string | null>) {
  const roots = categories.filter((category) => !category.parentId);
  const source = roots.length > 0 ? roots : categories;
  return source.map((category) => ({
    category,
    image: categoryImage(images, category),
  }));
}
