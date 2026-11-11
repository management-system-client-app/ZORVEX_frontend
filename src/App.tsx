import { useEffect, useLayoutEffect, useState } from "react";
import { Outlet, Route, Routes, useLocation } from "react-router-dom";
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
import { CheckoutPage } from "./pages/CheckoutPage";
import { HomePage } from "./pages/HomePage";
import { ProductPage } from "./pages/ProductPage";
import { ShopPage } from "./pages/ShopPage";
import { ToastViewport } from "./components/ToastViewport";

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
    </div>
  );
}

function RouteScrollReset() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
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
