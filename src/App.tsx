import { lazy, Suspense, useEffect, useLayoutEffect, useState, type ComponentType } from "react";
import { Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { MessageCircle, Phone, X } from "lucide-react";
import { Footer, Header } from "./components/Chrome";
import { ToastViewport } from "./components/ToastViewport";
import { useStore } from "./state";
import { saveStaffReferralId } from "./staffReferral";
function lazyNamed<T extends Record<string, ComponentType<any>>>(loader: () => Promise<T>, name: keyof T) {
  return lazy(() => loader().then((module) => ({ default: module[name] })));
}

const AccountDashboard = lazyNamed(() => import("./pages/AccountPages"), "AccountDashboard");
const AccountLayout = lazyNamed(() => import("./pages/AccountPages"), "AccountLayout");
const AccountNotifications = lazyNamed(() => import("./pages/AccountPages"), "AccountNotifications");
const AccountOrders = lazyNamed(() => import("./pages/AccountPages"), "AccountOrders");
const AccountProfile = lazyNamed(() => import("./pages/AccountPages"), "AccountProfile");
const AccountReturns = lazyNamed(() => import("./pages/AccountPages"), "AccountReturns");
const AccountReviews = lazyNamed(() => import("./pages/AccountPages"), "AccountReviews");
const AuthCallbackPage = lazyNamed(() => import("./pages/AccountPages"), "AuthCallbackPage");
const ChangePasswordPage = lazyNamed(() => import("./pages/AccountPages"), "ChangePasswordPage");
const CmsPageView = lazyNamed(() => import("./pages/AccountPages"), "CmsPageView");
const DeliveryAddressPage = lazyNamed(() => import("./pages/AccountPages"), "DeliveryAddressPage");
const ForgotPage = lazyNamed(() => import("./pages/AccountPages"), "ForgotPage");
const LoginPage = lazyNamed(() => import("./pages/AccountPages"), "LoginPage");
const OutletsPage = lazyNamed(() => import("./pages/AccountPages"), "OutletsPage");
const RegisterPage = lazyNamed(() => import("./pages/AccountPages"), "RegisterPage");
const ResetPage = lazyNamed(() => import("./pages/AccountPages"), "ResetPage");
const TrackPage = lazyNamed(() => import("./pages/AccountPages"), "TrackPage");
const WishlistPage = lazyNamed(() => import("./pages/AccountPages"), "WishlistPage");
const AdminLayout = lazyNamed(() => import("./pages/AdminDashboard"), "AdminLayout");
const AdminOrderDetail = lazyNamed(() => import("./pages/AdminDashboard"), "AdminOrderDetail");
const AdminOrders = lazyNamed(() => import("./pages/AdminDashboard"), "AdminOrders");
const AdminOverview = lazyNamed(() => import("./pages/AdminDashboard"), "AdminOverview");
const AdminProducts = lazyNamed(() => import("./pages/AdminDashboard"), "AdminProducts");
const AdminBanners = lazyNamed(() => import("./pages/AdminCatalog"), "AdminBanners");
const AdminCategories = lazyNamed(() => import("./pages/AdminCatalog"), "AdminCategories");
const AdminCatalogExtras = lazyNamed(() => import("./pages/AdminResources"), "AdminCatalogExtras");
const AdminColors = lazyNamed(() => import("./pages/AdminResources"), "AdminColors");
const AdminCoupons = lazyNamed(() => import("./pages/AdminResources"), "AdminCoupons");
const AdminDelivery = lazyNamed(() => import("./pages/AdminResources"), "AdminDelivery");
const AdminNewsletter = lazyNamed(() => import("./pages/AdminResources"), "AdminNewsletter");
const AdminOutlets = lazyNamed(() => import("./pages/AdminResources"), "AdminOutlets");
const AdminPages = lazyNamed(() => import("./pages/AdminResources"), "AdminPages");
const AdminPayments = lazyNamed(() => import("./pages/AdminResources"), "AdminPayments");
const AdminPromotions = lazyNamed(() => import("./pages/AdminResources"), "AdminPromotions");
const AdminReturns = lazyNamed(() => import("./pages/AdminResources"), "AdminReturns");
const AdminSettings = lazyNamed(() => import("./pages/AdminResources"), "AdminSettings");
const AdminSizeGuides = lazyNamed(() => import("./pages/AdminResources"), "AdminSizeGuides");
const AdminVariants = lazyNamed(() => import("./pages/AdminResources"), "AdminVariants");
const AdminProductForm = lazyNamed(() => import("./pages/AdminProductForm"), "AdminProductForm");
const AdminStaff = lazyNamed(() => import("./pages/AdminStaff"), "AdminStaff");
const CheckoutPage = lazyNamed(() => import("./pages/CheckoutPage"), "CheckoutPage");
const HomePage = lazyNamed(() => import("./pages/HomePage"), "HomePage");
const ProductPage = lazyNamed(() => import("./pages/ProductPage"), "ProductPage");
const MohasagorProductsPage = lazyNamed(() => import("./pages/MohasagorProductsPage"), "MohasagorProductsPage");
const ShopPage = lazyNamed(() => import("./pages/ShopPage"), "ShopPage");



function SupportChat() {
  const { settings } = useStore();
  const [open, setOpen] = useState(false);
  const phone = settings.supportPhone || "+88-01885-998899";
  const phoneDigits = phone.replace(/\D/g, "");
  const whatsappNumber = phoneDigits.startsWith("880")
    ? phoneDigits.replace(/^8800/, "880")
    : phoneDigits.startsWith("0")
      ? `88${phoneDigits}`
      : phoneDigits;
  const whatsappHref = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent("Hello, I need help with my order.")}`;

  return (
    <div className="support-chat">
      {open ? (
        <section className="support-chat-panel" aria-labelledby="support-chat-title">
          <div className="support-chat-heading">
            <span className="support-chat-heading-icon" aria-hidden="true"><MessageCircle size={18} /></span>
            <div>
              <h2 id="support-chat-title">Need a hand?</h2>
              <p>Our support team is here to help.</p>
            </div>
            <button type="button" className="support-chat-close" aria-label="Close support options" onClick={() => setOpen(false)}>
              <X size={18} />
            </button>
          </div>
          <a className="support-chat-link" href={`tel:${phone}`}>
            <Phone size={16} aria-hidden="true" />
            <span><strong>Call us</strong><small>{phone}</small></span>
          </a>
          <a className="support-chat-link" href={whatsappHref} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={16} aria-hidden="true" />
            <span><strong>Chat on WhatsApp</strong><small>Message our support team</small></span>
          </a>
          <Link className="support-chat-contact" to="/pages/contact" onClick={() => setOpen(false)}>
            Visit contact page
          </Link>
        </section>
      ) : null}
      <button
        type="button"
        className={`support-chat-toggle${open ? " is-open" : ""}`}
        aria-label={open ? "Close support options" : "Open support options"}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
        {!open ? <span>Support</span> : null}
      </button>
    </div>
  );
}

function StoreShell() {
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = (event: MediaQueryListEvent) => setTheme(event.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", updateTheme);
    return () => mediaQuery.removeEventListener("change", updateTheme);
  }, []);

  return (
    <div className={`store-shell theme-light${theme === "dark" ? " theme-dark" : ""}`}>
      <Header />
      <main className="page">
        <div className="page-container">
          <Outlet />
        </div>
      </main>
      <Footer />
      <SupportChat />
    </div>
  );
}

function RouteScrollReset() {
  const { pathname, hash } = useLocation();

  useLayoutEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }

    const targetId = hash.slice(1);
    let frame = 0;
    const scrollToTarget = () => {
      const target = document.getElementById(targetId);
      if (!target) return false;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      return true;
    };
    const observer = new MutationObserver(scrollToTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    frame = window.requestAnimationFrame(scrollToTarget);
    const timeout = window.setTimeout(() => observer.disconnect(), 10000);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      observer.disconnect();
    };
  }, [pathname, hash]);

  return null;
}

function StaffReferralCapture() {
  const { search } = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(search);
    if (params.has("ref")) {
      saveStaffReferralId(params.get("ref") ?? "");
    }
  }, [search]);

  return null;
}

function RouteDocumentTitle() {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = "Bazergrid Trends";

    const handlePageTitle = (event: Event) => {
      const title = (event as CustomEvent<string>).detail;
      if (title) document.title = `${title} | Bazergrid Trends`;
    };
    window.addEventListener("app:page-title", handlePageTitle);
    return () => window.removeEventListener("app:page-title", handlePageTitle);
  }, [pathname]);

  return null;
}

function ReloadIndicator() {
  const [visible, setVisible] = useState(
    () => performance.getEntriesByType("navigation").some(
      (entry) => entry instanceof PerformanceNavigationTiming && entry.type === "reload",
    ),
  );

  useEffect(() => {
    if (!visible) return;
    const timer = window.setTimeout(() => setVisible(false), 1100);
    return () => window.clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;
  return (
    <div className="reload-indicator" role="progressbar" aria-label="Loading page">
      <span />
    </div>
  );
}

export function App() {
  return (
    <>
      <RouteScrollReset />
      <StaffReferralCapture />
      <RouteDocumentTitle />
      <ReloadIndicator />
      <ToastViewport />
      <Suspense fallback={<div className="route-loading" role="status">Loading…</div>}>
        <Routes>
        <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminOverview />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:id" element={<AdminOrderDetail />} />
        <Route path="categories" element={<AdminCategories />} />
        <Route path="banners" element={<AdminBanners />} />
        <Route path="products/new" element={<AdminProductForm />} />
        <Route path="products/:id/edit" element={<AdminProductForm />} />
        <Route path="products" element={<AdminProducts />} />
        <Route path="coupons" element={<AdminCoupons />} />
        <Route path="promotions" element={<AdminPromotions />} />
        <Route path="catalog" element={<AdminCatalogExtras />} />
        <Route path="outlets" element={<AdminOutlets />} />
        <Route path="pages" element={<AdminPages />} />
        <Route path="delivery" element={<AdminDelivery />} />
        <Route path="newsletter" element={<AdminNewsletter />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="staff" element={<AdminStaff />} />
        <Route path="returns" element={<AdminReturns />} />
        <Route path="payments" element={<AdminPayments />} />
        <Route path="size-guides" element={<AdminSizeGuides />} />
        <Route path="variants" element={<AdminVariants />} />
        <Route path="colors" element={<AdminColors />} />
        </Route>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPage />} />
        <Route path="/reset-password" element={<ResetPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route element={<StoreShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/shop" element={<ShopPage />} />
        <Route path="/mohasagor" element={<MohasagorProductsPage />} />
        <Route path="/women" element={<ShopPage />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/cart" element={<Navigate to="/checkout" replace />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/track" element={<TrackPage />} />
        <Route path="/outlets" element={<OutletsPage />} />
        <Route path="/account" element={<AccountLayout />}>
          <Route index element={<AccountDashboard />} />
          <Route path="profile" element={<AccountProfile />} />
          <Route path="address" element={<DeliveryAddressPage />} />
          <Route path="password" element={<ChangePasswordPage />} />
          <Route path="orders" element={<AccountOrders />} />
          <Route path="returns" element={<AccountReturns />} />
          <Route path="wishlist" element={<WishlistPage />} />
          <Route path="coupons" element={<Navigate to="/account" replace />} />
          <Route path="reviews" element={<AccountReviews />} />
          <Route path="notifications" element={<AccountNotifications />} />
        </Route>
        <Route path="/pages/:slug" element={<CmsPageView />} />
        <Route path="*" element={<p className="empty">Sorry! No result.</p>} />
        </Route>
        </Routes>
      </Suspense>
    </>
  );
}
