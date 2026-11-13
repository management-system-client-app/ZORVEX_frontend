import { useEffect, useLayoutEffect, useState } from "react";
import { Link, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { MessageCircle, Phone, X } from "lucide-react";
import { Footer, Header } from "./components/Chrome";
import { AccountCoupons, AccountDashboard, AccountLayout, AccountNotifications, AccountOrders, AccountProfile, AccountReturns, AccountReviews, AuthCallbackPage, CartPage, ChangePasswordPage, CmsPageView, DeliveryAddressPage, ForgotPage, LoginPage, OutletsPage, RegisterPage, ResetPage, TrackPage, WishlistPage } from "./pages/AccountPages";
import { AdminLayout, AdminOrderDetail, AdminOrders, AdminOverview, AdminProducts } from "./pages/AdminDashboard";
import { AdminBanners, AdminCategories } from "./pages/AdminCatalog";
import {
  AdminCatalogExtras,
  AdminColors,
  AdminCoupons,
  AdminDelivery,
  AdminNewsletter,
  AdminOutlets,
  AdminPages,
  AdminPayments,
  AdminPromotions,
  AdminReturns,
  AdminSettings,
  AdminSizeGuides,
  AdminVariants,
} from "./pages/AdminResources";
import { AdminProductForm } from "./pages/AdminProductForm";
import { AdminStaff } from "./pages/AdminStaff";
import { CheckoutPage } from "./pages/CheckoutPage";
import { HomePage } from "./pages/HomePage";
import { ProductPage } from "./pages/ProductPage";
import { ShopPage } from "./pages/ShopPage";
import { ToastViewport } from "./components/ToastViewport";
import { useStore } from "./state";
import { saveStaffReferralId } from "./staffReferral";

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
  return (
    <div className="store-shell theme-light">
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
    const route = pathname === "/" ? "Home" : pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment).replace(/[-_]/g, " "))
      .map((segment) => segment.replace(/\b\w/g, (letter) => letter.toUpperCase()))
      .join(" / ");
    document.title = `${route} | Bazergrid`;
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
        <Route path="/women" element={<ShopPage />} />
        <Route path="/product/:id" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
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
          <Route path="coupons" element={<AccountCoupons />} />
          <Route path="reviews" element={<AccountReviews />} />
          <Route path="notifications" element={<AccountNotifications />} />
        </Route>
        <Route path="/pages/:slug" element={<CmsPageView />} />
        <Route path="*" element={<p className="empty">Sorry! No result.</p>} />
        </Route>
      </Routes>
    </>
  );
}
