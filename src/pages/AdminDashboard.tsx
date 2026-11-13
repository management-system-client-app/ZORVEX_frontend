import { createContext, FormEvent, useContext, useEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Bell } from "lucide-react";
import { ApiError, api } from "../api";
import { UserFace } from "../components/Chrome";
import { DetailSkeleton, RowsSkeleton, SkeletonBlock } from "../components/Skeleton";
import { coverImage, money, titleCaseStatus } from "../format";
import { useAuth, useStore } from "../state";
import type { AdminOrder, DashboardOverview, PageMeta, ProductCardData, ProductDetail, StoreReturn, User } from "../types";

const STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "RETURN_REQUESTED",
  "PARTIALLY_RETURNED",
  "RETURNED",
] as const;

const NEXT_STATUS: Record<string, string[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["RETURN_REQUESTED"],
  RETURN_REQUESTED: ["PARTIALLY_RETURNED", "RETURNED"],
  PARTIALLY_RETURNED: ["RETURNED"],
  RETURNED: [],
  CANCELLED: [],
};

const STATUS_TONE: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-900 ring-amber-300",
  CONFIRMED: "bg-emerald-100 text-emerald-900 ring-emerald-300",
  PROCESSING: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  SHIPPED: "bg-violet-50 text-violet-800 ring-violet-200",
  DELIVERED: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  CANCELLED: "bg-rose-50 text-rose-700 ring-rose-200",
  RETURN_REQUESTED: "bg-orange-50 text-orange-800 ring-orange-200",
  PARTIALLY_RETURNED: "bg-orange-50 text-orange-800 ring-orange-200",
  RETURNED: "bg-stone-100 text-stone-700 ring-stone-200",
  ACTIVE: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  DRAFT: "bg-amber-50 text-amber-800 ring-amber-200",
  ARCHIVED: "bg-stone-100 text-stone-700 ring-stone-200",
};

function when(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function buyer(order: AdminOrder) {
  if (order.user) return `${order.user.firstName} ${order.user.lastName}`;
  return order.shippingFullName;
}

function buyerEmail(order: AdminOrder) {
  return order.user?.email ?? order.guestEmail ?? "Guest checkout";
}

type AdminNotification = {
  id: string;
  kind: "NEW_ORDER" | "ORDER_CANCELLED";
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  createdAt: string;
  read: boolean;
};

type AdminNotificationContextValue = {
  notifications: AdminNotification[];
  unreadCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  refreshError: string;
};

const ADMIN_NOTIFICATIONS_KEY = "store_admin_order_notifications";
const ADMIN_ORDER_SNAPSHOT_KEY = "store_admin_order_snapshot";
const NOTIFICATION_POLL_INTERVAL = 30_000;
const AdminNotificationContext = createContext<AdminNotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  markAllRead: () => undefined,
  markRead: () => undefined,
  refreshError: "",
});

function readAdminNotifications(): AdminNotification[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(ADMIN_NOTIFICATIONS_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((item): item is AdminNotification =>
      typeof item === "object" &&
      item !== null &&
      "id" in item &&
      typeof item.id === "string" &&
      "kind" in item &&
      (item.kind === "NEW_ORDER" || item.kind === "ORDER_CANCELLED") &&
      "orderId" in item &&
      typeof item.orderId === "string" &&
      "orderNumber" in item &&
      typeof item.orderNumber === "string" &&
      "customerName" in item &&
      typeof item.customerName === "string" &&
      "customerEmail" in item &&
      typeof item.customerEmail === "string" &&
      "createdAt" in item &&
      typeof item.createdAt === "string" &&
      "read" in item &&
      typeof item.read === "boolean",
    ).slice(0, 30);
  } catch (reason) {
    console.warn("Admin notifications could not be read", reason);
    return [];
  }
}

function readAdminOrderSnapshot(): Record<string, string> | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(ADMIN_ORDER_SNAPSHOT_KEY) ?? "null");
    if (typeof stored !== "object" || stored === null || Array.isArray(stored)) return null;
    return Object.fromEntries(
      Object.entries(stored).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
    );
  } catch (reason) {
    console.warn("Admin order notification history could not be read", reason);
    return null;
  }
}

function saveAdminNotifications(notifications: AdminNotification[]) {
  try {
    localStorage.setItem(ADMIN_NOTIFICATIONS_KEY, JSON.stringify(notifications));
  } catch (reason) {
    console.warn("Admin notifications could not be saved", reason);
  }
}

function saveAdminOrderSnapshot(snapshot: Record<string, string>) {
  try {
    localStorage.setItem(ADMIN_ORDER_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch (reason) {
    console.warn("Admin order notification history could not be saved", reason);
  }
}

function AdminNotificationFeed({ limit = 5 }: { limit?: number }) {
  const { notifications, markRead } = useContext(AdminNotificationContext);

  if (notifications.length === 0) {
    return <p className="px-4 py-5 text-center text-sm text-slate-400">New orders and cancellations will appear here.</p>;
  }

  return (
    <ul className="divide-y divide-slate-700">
      {notifications.slice(0, limit).map((notification) => (
        <li key={notification.id}>
          <Link
            to={`/admin/orders/${notification.orderId}`}
            onClick={() => markRead(notification.id)}
            className={`block px-4 py-3 transition-colors hover:bg-white/5 ${notification.read ? "" : "bg-teal-950/20"}`}
          >
            <span className="flex items-start gap-2">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.read ? "bg-transparent" : "bg-teal-300"}`} aria-hidden="true" />
              <span className="min-w-0">
                <strong className="block text-sm font-medium text-slate-100">
                  {notification.kind === "NEW_ORDER" ? "New order" : "Order cancelled"} · #{notification.orderNumber}
                </strong>
                <span className="mt-1 block truncate text-xs text-slate-300">{notification.customerName} · {notification.customerEmail}</span>
                <time className="mt-1 block text-[10px] text-slate-500" dateTime={notification.createdAt}>
                  {new Date(notification.createdAt).toLocaleString()}
                </time>
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_TONE[status] ?? "bg-slate-100 text-slate-700 ring-slate-200"}`}>
      {titleCaseStatus(status)}
    </span>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d={d} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const NAV = [
  { section: "Overview", to: "/admin", label: "Dashboard", end: true, icon: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" },
  { section: "Catalog", to: "/admin/products", label: "Products", end: false, icon: "M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8" },
  { section: "Catalog", to: "/admin/categories", label: "Categories", end: false, icon: "M4 5h7v7H4V5zm9 0h7v7h-7V5zM4 14h7v5H4v-5zm9 0h7v5h-7v-5z" },
  { section: "Catalog", to: "/admin/variants", label: "Variants", end: false, icon: "M4 7h16M4 12h16M4 17h10" },
  { section: "Catalog", to: "/admin/colors", label: "Colors", end: false, icon: "M12 3a9 9 0 1 0 9 9h-4a2 2 0 0 1-2-2V8a5 5 0 0 0-3-5zM7 12h.01M10 7h.01M15 7h.01" },
  { section: "Catalog", to: "/admin/catalog", label: "Brands & sizes", end: false, icon: "M4 6h16v12H4z" },
  { section: "Sales", to: "/admin/orders", label: "Orders", end: false, icon: "M6 6h15l-1.5 9h-12L6 6zM6 6 5 3H2" },
  { section: "Sales", to: "/admin/coupons", label: "Coupons", end: false, icon: "M4 8h16v8H4z" },
  { section: "Sales", to: "/admin/promotions", label: "Promotions", end: false, icon: "M12 3l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" },
  { section: "Sales", to: "/admin/returns", label: "Returns", end: false, icon: "M4 12h10M10 8l4 4-4 4" },
  { section: "Sales", to: "/admin/payments", label: "Payments", end: false, icon: "M3 7h18v10H3z" },
  { section: "Operations", to: "/admin/delivery", label: "Delivery", end: false, icon: "M3 7h11v8H3zM14 10h4l3 3v2h-7z" },
  { section: "Operations", to: "/admin/outlets", label: "Outlets", end: false, icon: "M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11z" },
  { section: "Storefront", to: "/admin/banners", label: "Banners", end: false, icon: "M4 6h16v12H4V6zm2 2v8l5-3 5 3V8H6z" },
  { section: "Storefront", to: "/admin/pages", label: "Pages", end: false, icon: "M6 3h9l5 5v13H6z" },
  { section: "Storefront", to: "/admin/size-guides", label: "Size guides", end: false, icon: "M4 6h16M4 12h16M4 18h10" },
  { section: "Storefront", to: "/admin/newsletter", label: "Newsletter", end: false, icon: "M4 6h16v12H4zM4 7l8 6 8-6" },
  { section: "Preferences", to: "/admin/settings", label: "Settings", end: false, icon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" },
  { section: "Preferences", to: "/admin/staff", label: "Staff", end: false, icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m8-10a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7-3h6m-3-3v6" },
];

export function AdminLayout() {
  const { user, ready, logout } = useAuth();
  const { settings } = useStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  );
  const visibleNav = NAV.filter((link) => link.to !== "/admin/staff" || user?.adminRole === "SUPER_ADMIN");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState(readAdminNotifications);
  const [refreshError, setRefreshError] = useState("");
  const previousOrders = useRef<Record<string, string> | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const updateTheme = (event: MediaQueryListEvent) => setTheme(event.matches ? "dark" : "light");
    mediaQuery.addEventListener("change", updateTheme);
    return () => mediaQuery.removeEventListener("change", updateTheme);
  }, []);

  useEffect(() => {
    if (!user || user.accountType !== "ADMIN") return;

    let active = true;
    let refreshing = false;
    let hasBaseline = false;
    const snapshot = readAdminOrderSnapshot();
    previousOrders.current = snapshot;
    hasBaseline = snapshot !== null;
    setNotifications(readAdminNotifications());

    const checkForOrderUpdates = async () => {
      if (!active || refreshing || document.visibilityState !== "visible") return;
      refreshing = true;
      try {
        const { items } = await api.adminOrders({ page: 1, limit: 100 }, { fresh: true });
        if (!active) return;

        const prior = previousOrders.current ?? {};
        const nextSnapshot: Record<string, string> = {};
        const detected: AdminNotification[] = [];
        for (const order of items) {
          nextSnapshot[order.id] = order.status;
          const previousStatus = prior[order.id];
          const addNotification = (kind: AdminNotification["kind"]) => {
            detected.push({
              id: `${kind}:${order.id}`,
              kind,
              orderId: order.id,
              orderNumber: order.orderNumber,
              customerName: buyer(order).trim() || "Customer",
              customerEmail: buyerEmail(order),
              createdAt: new Date().toISOString(),
              read: false,
            });
          };
          if (hasBaseline && previousStatus === undefined) addNotification("NEW_ORDER");
          if (hasBaseline && previousStatus !== "CANCELLED" && order.status === "CANCELLED") {
            addNotification("ORDER_CANCELLED");
          }
        }

        previousOrders.current = nextSnapshot;
        saveAdminOrderSnapshot(nextSnapshot);
        hasBaseline = true;
        setRefreshError("");

        if (detected.length > 0) {
          setNotifications((current) => {
            const existingIds = new Set(current.map((item) => item.id));
            const added = detected.filter((item) => !existingIds.has(item.id));
            if (added.length === 0) return current;
            const updated = [...added, ...current].slice(0, 30);
            saveAdminNotifications(updated);
            return updated;
          });
          for (const item of detected.slice(0, 3)) {
            window.dispatchEvent(new CustomEvent("app:toast", {
              detail: {
                type: "success",
                message: item.kind === "NEW_ORDER"
                  ? `New order #${item.orderNumber} from ${item.customerName}`
                  : `Order #${item.orderNumber} cancelled · Customer: ${item.customerName}`,
              },
            }));
          }
        }
      } catch (reason) {
        if (active) {
          setRefreshError(reason instanceof ApiError ? reason.message : "Could not check for new orders");
          console.error("Admin order notifications could not be refreshed", reason);
        }
      } finally {
        refreshing = false;
      }
    };

    void checkForOrderUpdates();
    const timer = window.setInterval(() => void checkForOrderUpdates(), NOTIFICATION_POLL_INTERVAL);
    const refreshOnFocus = () => void checkForOrderUpdates();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void checkForOrderUpdates();
    };
    const syncNotifications = (event: StorageEvent) => {
      if (event.key === ADMIN_NOTIFICATIONS_KEY) setNotifications(readAdminNotifications());
    };
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("storage", syncNotifications);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("storage", syncNotifications);
    };
  }, [user?.accountType, user?.id]);

  useEffect(() => {
    setNotificationOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!notificationOpen) return;

    function dismissOnOutsidePointer(event: PointerEvent) {
      if (event.target instanceof Node && !notificationRef.current?.contains(event.target)) {
        setNotificationOpen(false);
      }
    }

    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setNotificationOpen(false);
    }

    document.addEventListener("pointerdown", dismissOnOutsidePointer);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOnOutsidePointer);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [notificationOpen]);

  function markAllNotificationsRead() {
    setNotifications((current) => {
      if (!current.some((item) => !item.read)) return current;
      const updated = current.map((item) => ({ ...item, read: true }));
      saveAdminNotifications(updated);
      return updated;
    });
  }

  function markNotificationRead(id: string) {
    setNotifications((current) => {
      const updated = current.map((item) => item.id === id ? { ...item, read: true } : item);
      saveAdminNotifications(updated);
      return updated;
    });
  }

  if (!ready) {
    return <div className={`admin-theme-root admin-theme-light${theme === "dark" ? " admin-theme-dark" : ""} grid min-h-screen place-items-center p-6`}><div className="w-full max-w-xl"><RowsSkeleton rows={7} columns={2} /></div></div>;
  }
  if (!user) return <Navigate to="/login" replace />;
  if (user.accountType !== "ADMIN") return <Navigate to="/" replace />;

  const title = visibleNav.find((link) => (link.end ? location.pathname === link.to : location.pathname.startsWith(link.to)))?.label ?? "Overview";
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  const unreadCount = notifications.filter((item) => !item.read).length;
  const notificationContextValue: AdminNotificationContextValue = {
    notifications,
    unreadCount,
    markAllRead: markAllNotificationsRead,
    markRead: markNotificationRead,
    refreshError,
  };

  return (
    <AdminNotificationContext.Provider value={notificationContextValue}>
    <div className={`admin-theme-root admin-theme-light${theme === "dark" ? " admin-theme-dark" : ""} min-h-screen p-2 antialiased sm:p-4`}>
      <div className="admin-theme-panel relative flex min-h-[calc(100vh-1rem)] overflow-hidden rounded-[28px] shadow-[0_20px_50px_rgba(16,24,40,0.08)] sm:min-h-[calc(100vh-2rem)]">
        <aside className={`admin-theme-sidebar absolute inset-y-0 left-0 z-40 flex w-[232px] flex-col transition-transform lg:static lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
          <div className="admin-sidebar-brand flex items-center gap-3 px-5 pt-6 pb-5">
            <span className="admin-sidebar-mark grid h-10 w-10 shrink-0 place-items-center rounded-xl text-lg font-semibold text-white">
              {settings.storeName.slice(0, 1)}
            </span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold text-slate-800">{settings.storeName}</span>
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Store control</span>
            </span>
          </div>
          <nav aria-label="Admin sections" className="flex flex-1 flex-col overflow-y-auto px-3 pb-3">
            {visibleNav.map((link, index) => (
              <div key={link.to}>
                {index === 0 || link.section !== visibleNav[index - 1].section ? <p className="admin-sidebar-section px-3 pt-4 pb-1.5">{link.section}</p> : null}
                <NavLink
                  to={link.to}
                  end={link.end}
                  onClick={() => setOpen(false)}
                  className={({ isActive }) => `admin-sidebar-link ${isActive ? "admin-sidebar-link-active" : ""}`}
                >
                  {({ isActive }) => (
                    <>
                      <span className="admin-sidebar-icon grid h-8 w-8 shrink-0 place-items-center rounded-lg"><Icon d={link.icon} /></span>
                      <span className="min-w-0 flex-1 truncate">{link.label}</span>
                      {isActive ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#f0c0cf]" aria-hidden="true" /> : null}
                    </>
                  )}
                </NavLink>
              </div>
            ))}
          </nav>
          <Link to="/" className="admin-sidebar-store-link mx-3 mb-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm">
            <span className="admin-sidebar-icon grid h-8 w-8 shrink-0 place-items-center rounded-lg"><Icon d="M10 6 4 12l6 6M4 12h16" /></span>
            View store
          </Link>
        </aside>
        {open ? <button type="button" className="absolute inset-0 z-30 bg-slate-900/30 lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)} /> : null}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="admin-theme-topbar relative flex min-h-[68px] flex-wrap items-center gap-3 px-4 py-2.5 sm:px-6">
            <button type="button" className="admin-topbar-icon-button grid h-9 w-9 place-items-center rounded-xl lg:hidden" aria-label="Menu" onClick={() => setOpen(true)}>
              <Icon d="M4 7h16M4 12h16M4 17h16" />
            </button>
            <div className="admin-topbar-heading min-w-36">
              <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Admin workspace</p>
              <h1 className="mt-0.5 text-lg font-semibold leading-tight text-white">{title}</h1>
            </div>
            <form
              className="admin-topbar-search relative order-last mx-auto block w-full max-w-[390px] xl:absolute xl:left-1/2 xl:top-1/2 xl:order-none xl:-translate-x-1/2 xl:-translate-y-1/2 xl:mx-0"
              onSubmit={(event) => {
                event.preventDefault();
                const term = query.trim();
                navigate(term ? `/admin/products?search=${encodeURIComponent(term)}` : "/admin/products");
              }}
            >
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                aria-label="Search products"
                className="h-9 w-full rounded-xl border border-[#363d46] bg-[#242a32] pr-10 pl-3.5 text-xs text-slate-100 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-white/5"
              />
              <button type="submit" aria-label="Search" className="absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400 transition-colors hover:text-white">
                <Icon d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16zM21 21l-4.3-4.3" />
              </button>
            </form>
            <div className="admin-topbar-actions ml-auto flex items-center gap-1.5 sm:gap-2">
              <div className="relative" ref={notificationRef}>
                <button
                  type="button"
                  aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
                  aria-expanded={notificationOpen}
                  aria-haspopup="dialog"
                  title="Notifications"
                  className="admin-topbar-icon-button relative grid h-9 w-9 place-items-center rounded-xl"
                  onClick={() => setNotificationOpen((current) => !current)}
                >
                  <Bell size={17} aria-hidden="true" />
                  {unreadCount > 0 ? <span className="absolute -top-1 -right-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
                </button>
                {notificationOpen ? (
                  <section role="dialog" aria-label="Order notifications" className="absolute top-full right-0 z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-700 bg-[#202630] shadow-2xl">
                    <header className="flex items-center justify-between gap-3 border-b border-slate-700 px-4 py-3">
                      <div>
                        <h2 className="text-sm font-semibold text-slate-100">Order notifications</h2>
                        <p className="mt-0.5 text-[10px] text-slate-400">{unreadCount} unread</p>
                      </div>
                      {unreadCount > 0 ? <button type="button" className="text-[11px] font-medium text-teal-300 hover:text-teal-200" onClick={markAllNotificationsRead}>Mark all read</button> : null}
                    </header>
                    {refreshError ? <p className="border-b border-rose-900/60 bg-rose-950/30 px-4 py-2 text-xs text-rose-200" role="alert">{refreshError}</p> : null}
                    <div className="max-h-[min(65vh,420px)] overflow-y-auto"><AdminNotificationFeed limit={8} /></div>
                  </section>
                ) : null}
              </div>
              <span className="admin-topbar-divider mx-0.5 hidden h-6 w-px sm:block" aria-hidden="true" />
              <span className="admin-topbar-user inline-flex h-9 items-center gap-2 rounded-xl px-2.5 text-xs">
                <UserFace user={user} size={24} />
                <span className="hidden min-w-0 leading-tight sm:block"><span className="block truncate font-medium">{user.firstName}</span><span className="mt-0.5 block text-[9px] text-slate-500">Administrator</span></span>
              </span>
              <span className="admin-topbar-date hidden h-9 items-center gap-2 rounded-xl px-2.5 text-xs sm:inline-flex">
                <Icon d="M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1z" />
                {today}
              </span>
              <button
                type="button"
                aria-label="Log out"
                title="Log out"
                className="admin-topbar-icon-button grid h-9 w-9 place-items-center rounded-xl"
                onClick={() => {
                  logout().then(() => navigate("/login"));
                }}
              >
                <Icon d="M15 12H3M12 8l4 4-4 4M9 5h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9" />
              </button>
            </div>
          </header>
          <main className="px-4 pt-3 pb-6 sm:px-6">
            <div className="mx-auto w-full max-w-[1600px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </div>
    </AdminNotificationContext.Provider>
  );
}

type Offer = {
  id: string;
  name: string;
  description: string | null;
  type?: string;
  value?: string | number;
  startsAt?: string;
  endsAt?: string;
};

type AdminOverviewData = {
  overview: DashboardOverview;
  orders: AdminOrder[];
  offers: Offer[];
  returns: StoreReturn[];
};

let cachedAdminOverview: AdminOverviewData | null = null;
let adminOverviewRequest: Promise<DashboardOverview> | null = null;
let adminOverviewDetailsRequest: Promise<Omit<AdminOverviewData, "overview">> | null = null;

function loadAdminOverviewData() {
  if (!adminOverviewRequest) {
    adminOverviewRequest = api.dashboard()
      .then((overview) => {
        cachedAdminOverview = {
          overview,
          orders: cachedAdminOverview?.orders ?? [],
          offers: cachedAdminOverview?.offers ?? [],
          returns: cachedAdminOverview?.returns ?? [],
        };
        return overview;
      })
      .finally(() => {
        adminOverviewRequest = null;
      });
  }
  return adminOverviewRequest;
}

function loadAdminOverviewDetails() {
  if (!adminOverviewDetailsRequest) {
    adminOverviewDetailsRequest = Promise.all([
      api.adminOrders({ page: 1, limit: 100 }).then((result) => result.items),
      api.promotions().then((items) => items as Offer[]),
      api.returns(),
    ])
      .then(([orders, offers, returns]) => {
        if (cachedAdminOverview) {
          cachedAdminOverview = { ...cachedAdminOverview, orders, offers, returns };
        }
        return { orders, offers, returns };
      })
      .finally(() => {
        adminOverviewDetailsRequest = null;
      });
  }
  return adminOverviewDetailsRequest;
}

function dayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function recentDays(count: number) {
  const days: Date[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  for (let index = count - 1; index >= 0; index -= 1) {
    const day = new Date(start);
    day.setDate(start.getDate() - index);
    days.push(day);
  }
  return days;
}

function AreaChart({ points, labels }: { points: number[]; labels: string[] }) {
  const width = 560;
  const height = 150;
  const max = Math.max(...points, 1);
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points.map((point, index) => {
    const x = index * step;
    const y = height - 12 - (point / max) * (height - 28);
    return [x, y] as const;
  });
  const line = coords.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const fill = `${line} L${width},${height} L0,${height} Z`;
  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-40 w-full" role="img" aria-label="Revenue over the last 8 days">
        <defs>
          <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d97706" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#d97706" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={fill} fill="url(#sales-fill)" />
        <path d={line} fill="none" stroke="#d97706" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-slate-400">
        {labels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  );
}

function StatusRing({ delivered, open }: { delivered: number; open: number }) {
  const total = delivered + open;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const outer = total === 0 ? 0 : delivered / total;
  const innerRadius = 36;
  const innerCirc = 2 * Math.PI * innerRadius;
  const inner = total === 0 ? 0 : open / total;
  return (
    <svg viewBox="0 0 160 160" className="h-44 w-44" role="img" aria-label="Delivered and open orders">
      <circle cx="80" cy="80" r={radius} fill="none" stroke="#3b424f" strokeWidth="14" />
      <circle
        cx="80"
        cy="80"
        r={radius}
        fill="none"
        stroke="#047857"
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={`${circumference * outer} ${circumference}`}
        transform="rotate(-90 80 80)"
      />
      <circle cx="80" cy="80" r={innerRadius} fill="none" stroke="#303744" strokeWidth="10" />
      <circle
        cx="80"
        cy="80"
        r={innerRadius}
        fill="none"
        stroke="#9aa3b2"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${innerCirc * inner} ${innerCirc}`}
        transform="rotate(-90 80 80)"
      />
    </svg>
  );
}

export function AdminOverview() {
  const { unreadCount, markAllRead, refreshError } = useContext(AdminNotificationContext);
  const [overview, setOverview] = useState<DashboardOverview | null>(() => cachedAdminOverview?.overview ?? null);
  const [orders, setOrders] = useState<AdminOrder[]>(() => cachedAdminOverview?.orders ?? []);
  const [offers, setOffers] = useState<Offer[]>(() => cachedAdminOverview?.offers ?? []);
  const [returns, setReturns] = useState<StoreReturn[]>(() => cachedAdminOverview?.returns ?? []);
  const [returnNote, setReturnNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(() => cachedAdminOverview === null);

  function load(showLoading = false) {
    if (showLoading && cachedAdminOverview === null) setLoading(true);
    loadAdminOverviewData()
      .then((data) => {
        setOverview(data);
        setError("");
        setLoading(false);
        loadAdminOverviewDetails().then((details) => {
          setOrders(details.orders);
          setOffers(details.offers);
          setReturns(details.returns);
        }).catch((reason: unknown) => {
          setError(reason instanceof ApiError ? reason.message : "Could not load dashboard details");
        });
      })
      .catch((reason: unknown) => {
        setError(reason instanceof ApiError ? reason.message : "Could not load the dashboard");
        setLoading(false);
      });
  }

  useEffect(() => {
    load(cachedAdminOverview === null);
    function onShow() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onShow);
    return () => document.removeEventListener("visibilitychange", onShow);
  }, []);

  const days = recentDays(8);
  const revenueByDay = days.map((day) => {
    const key = dayKey(day);
    return orders.reduce((sum, order) => {
      if (order.status === "CANCELLED") return sum;
      return dayKey(new Date(order.placedAt)) === key ? sum + Number(order.total) : sum;
    }, 0);
  });
  const windowRevenue = revenueByDay.reduce((sum, value) => sum + value, 0);
  const windowOrders = orders.filter((order) => order.status !== "CANCELLED" && days.some((day) => dayKey(day) === dayKey(new Date(order.placedAt)))).length;
  const average = windowOrders > 0 ? windowRevenue / windowOrders : 0;
  const delivered = overview?.ordersByStatus.DELIVERED ?? 0;
  const pendingDelivery = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPED"].reduce(
    (sum, status) => sum + (overview?.ordersByStatus[status] ?? 0),
    0,
  );
  const sold = new Map<string, number>();
  for (const order of orders) {
    if (order.status === "CANCELLED") continue;
    for (const item of order.items) {
      sold.set(item.productName, (sold.get(item.productName) ?? 0) + item.quantity);
    }
  }
  const top = [...sold.entries()].sort((left, right) => right[1] - left[1]).slice(0, 4);
  const swatches = ["bg-[#35242b] text-[#f0c0cf]", "bg-[#263434] text-[#a4d7ca]", "bg-[#353025] text-[#e4cd9d]", "bg-[#28313d] text-[#b8cbe5]"];
  const overviewDate = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  if (loading) return <RowsSkeleton rows={8} columns={2} />;

  return (
    <div className="space-y-5">
      {error ? <p className="rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-teal-400 bg-[#171c24] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-teal-800/60 bg-teal-950/30 text-teal-200">
            <Icon d="M3 3v18h18M7 14l4-4 4 3 6-7" />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-teal-300">Store pulse</p>
            <h2 className="mt-0.5 text-base font-semibold text-slate-100">Sales, orders and customer activity</h2>
            <p className="mt-0.5 text-xs text-slate-400">A quick snapshot of how your store is performing</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-2 rounded-lg border border-teal-800/40 bg-teal-950/20 px-3 py-1.5 text-xs font-medium text-teal-200"><Icon d="M7 3v4m10-4v4M4 9h16M5 5h14v16H5z" />Overview · {overviewDate}</span>
      </header>
      <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-teal-500 bg-[#202630] shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-teal-800/50 bg-teal-950/25 text-teal-200"><Bell size={17} aria-hidden="true" /></span>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Order notifications</h2>
              <p className="mt-0.5 text-xs text-slate-400">New orders and cancelled orders · {unreadCount} unread</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 ? <button type="button" className="rounded-lg border border-slate-600 bg-[#171c24] px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-teal-700 hover:text-teal-200" onClick={markAllRead}>Mark all read</button> : null}
            <Link to="/admin/orders" className="rounded-lg border border-teal-700/50 bg-teal-950/25 px-3 py-1.5 text-xs font-semibold text-teal-200 transition-colors hover:border-teal-500">All orders</Link>
          </div>
        </header>
        {refreshError ? <p className="border-b border-rose-900/60 bg-rose-950/30 px-5 py-2 text-xs text-rose-200" role="alert">{refreshError}</p> : null}
        <AdminNotificationFeed />
      </section>
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-emerald-500 bg-[#171c24] p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Product management</h2>
          <p className="mt-1 text-xs text-slate-400">Add products or manage stock, edit details, and remove listings.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/admin/products" className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-[#202630] px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-emerald-700 hover:text-emerald-200">
            <Icon d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8" />
            Manage products
          </Link>
          <Link to="/admin/products/new" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
            <Icon d="M12 5v14m-7-7h14" />
            Add product
          </Link>
        </div>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric accent="border-t-amber-500/70" icon="M12 8c-2.2 0-4 .9-4 2.5S9.8 13 12 13s4 .9 4 2.5S14.2 18 12 18m0-14v2m0 12v2" tone="bg-amber-500/10 text-amber-300" label="Total Revenue" value={overview ? money(overview.totalRevenue) : "—"} hint="Paid orders" />
        <Metric accent="border-t-teal-500/70" icon="M4 7h16v11H4zM8 7V5h8v2" tone="bg-teal-500/10 text-teal-300" label="Total Order" value={overview ? String(overview.totalOrders) : "—"} hint="All statuses" />
        <Metric accent="border-t-emerald-500/70" icon="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 8v6M16 11h6" tone="bg-emerald-500/10 text-emerald-300" label="Total Customer" value={overview ? String(overview.activeUsers) : "—"} hint="Active accounts" />
        <Metric accent="border-t-orange-500/70" icon="M3 7h11v8H3zM14 10h4l3 3v2h-7zM7 18a1.5 1.5 0 1 0 0.01 0M17 18a1.5 1.5 0 1 0 0.01 0" tone="bg-orange-500/10 text-orange-300" label="Pending Delivery" value={overview ? String(pendingDelivery) : "—"} hint="Not delivered yet" />
      </section>
      <section className="overflow-hidden rounded-2xl border border-slate-700 border-t border-t-orange-600 bg-[#202630] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-orange-700/40 bg-orange-950/30 text-orange-200"><Icon d="M4 7h16v11H4zM8 7V5h8v2" /></span>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Return requests</h2>
              <p className="mt-0.5 text-xs text-slate-400">Review and decide on recent requests</p>
            </div>
          </div>
          <Link to="/admin/returns" className="rounded-lg border border-orange-700/50 bg-orange-950/25 px-3 py-1.5 text-xs font-semibold text-orange-200 transition-colors duration-200 hover:border-orange-500 hover:bg-orange-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400">All returns</Link>
        </div>
        <div className="p-5">
        <label className="block text-xs font-medium text-slate-400">
          Decision note
          <input className="mt-1.5 h-11 w-full rounded-xl border-2 border-slate-600 bg-[#171c24] px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-orange-400" placeholder="Optional note for the next decision" value={returnNote} onChange={(event) => setReturnNote(event.target.value)} />
        </label>
        {returns.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-slate-700 bg-[#171c24] px-4 py-6 text-center text-sm text-slate-400">No return requests yet.</p> : null}
        <ul className="mt-4 space-y-2">
          {returns.slice(0, 6).map((item) => (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-[#171c24] px-3.5 py-3 transition-colors duration-200 hover:border-orange-800/50 hover:bg-orange-950/15">
              <div>
                <p className="text-sm font-semibold text-slate-100">{item.order?.orderNumber ?? item.returnNumber ?? "Return"} · {titleCaseStatus(item.reason)}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {item.user ? `${item.user.firstName} ${item.user.lastName}` : "Customer"} · {titleCaseStatus(item.status)}
                  {item.items?.length ? ` · ${item.items.map((line) => line.orderItem?.productName).filter(Boolean).join(", ")}` : ""}
                </p>
              </div>
              {item.status === "REQUESTED" ? (
                <div className="flex gap-2">
                  <button type="button" className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" onClick={() => api.reviewReturn(item.id, { decision: "APPROVED", ...(returnNote ? { adminNote: returnNote } : {}) }).then(() => load())}>Approve</button>
                  <button type="button" className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition-colors duration-200 hover:border-rose-700 hover:bg-rose-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400" onClick={() => api.reviewReturn(item.id, { decision: "REJECTED", ...(returnNote ? { adminNote: returnNote } : {}) }).then(() => load())}>Reject</button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        </div>
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.7fr_0.8fr]">
        <article className="rounded-2xl border border-slate-700 border-t border-t-amber-600 bg-[#202630] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-700/40 bg-amber-950/25 text-amber-200"><Icon d="M3 3v18h18M7 14l4-4 4 3 6-7" /></span>
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Sales analytics</h2>
                <p className="mt-0.5 text-xs text-slate-400">Revenue performance</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-[#171c24] px-2.5 py-1 text-xs text-slate-300"><Icon d="M7 3v4m10-4v4M4 9h16M5 5h14v16H5z" />Last 8 days</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-y border-slate-700 py-4 text-sm">
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Revenue</p>
              <p className="mt-1 truncate text-lg font-semibold text-slate-100">{money(windowRevenue)}</p>
            </div>
            <div className="border-x border-slate-700 px-3">
              <p className="text-xs text-slate-400">Orders</p>
              <p className="mt-1 text-lg font-semibold text-slate-100">{windowOrders}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400">Average</p>
              <p className="mt-1 truncate text-lg font-semibold text-slate-100">{money(average)}</p>
            </div>
          </div>
          <div className="mt-4">
            <AreaChart
              points={revenueByDay}
              labels={days.map((day) => day.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }))}
            />
          </div>
        </article>
        <article className="rounded-2xl border border-slate-700 border-t border-t-emerald-700 bg-[#202630] p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-700/40 bg-emerald-950/25 text-emerald-200"><Icon d="M3 7h11v8H3zM14 10h4l3 3v2h-7zM7 18a1.5 1.5 0 1 0 0.01 0M17 18a1.5 1.5 0 1 0 0.01 0" /></span>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Order fulfillment</h2>
              <p className="mt-0.5 text-xs text-slate-400">Open versus delivered</p>
            </div>
          </div>
          <div className="mt-4 flex justify-center">
            <StatusRing delivered={delivered} open={pendingDelivery} />
          </div>
          <div className="mt-2 space-y-2 text-sm">
            <p className="flex items-center justify-between text-slate-500">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#c5c9d1]" /> Open orders</span>
              <span className="font-semibold text-slate-100">{pendingDelivery}</span>
            </p>
            <p className="flex items-center justify-between text-slate-500">
              <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-700" /> Delivered</span>
              <span className="font-semibold text-slate-100">{delivered}</span>
            </p>
          </div>
        </article>
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.7fr_0.8fr]">
        <article className="rounded-2xl border border-slate-700 border-t border-t-emerald-600 bg-[#202630] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-700/50 bg-emerald-950/25 text-emerald-200"><Icon d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8" /></span>
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Top selling products</h2>
                <p className="mt-0.5 text-xs text-slate-400">Most purchased in recent orders</p>
              </div>
            </div>
            <Link to="/admin/products" className="grid h-9 w-9 place-items-center rounded-lg border border-slate-600 bg-[#171c24] text-slate-300 transition-colors duration-200 hover:border-emerald-600 hover:bg-emerald-950/30 hover:text-emerald-200" aria-label="All products" title="All products">›</Link>
          </div>
          {top.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-slate-700 bg-[#171c24] px-4 py-6 text-center text-sm text-slate-400">No sold products yet.</p> : null}
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {top.map(([name, quantity], index) => (
              <div key={name} className="rounded-xl border border-slate-700 bg-[#171c24] p-3 transition-colors duration-200 hover:border-slate-500">
                <div className={`relative grid h-24 place-items-center rounded-lg border border-white/5 text-lg font-semibold ${swatches[index % swatches.length]}`}>
                  <span className="absolute top-2 left-2 rounded-md bg-black/20 px-1.5 py-0.5 text-[10px]">#{index + 1}</span>
                  {name.slice(0, 1)}
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-medium text-slate-100">{name}</p>
                <p className="mt-1 text-xs text-slate-400">{quantity} pcs sold</p>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-2xl border border-slate-700 border-t border-t-amber-500/60 bg-[#202630] p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-amber-700/40 bg-amber-950/25 text-amber-200"><Icon d="M12 3l2 6h6l-5 4 2 6-5-4-5 4 2-6-5-4h6z" /></span>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Current offers</h2>
              <p className="mt-0.5 text-xs text-slate-400">Promotion activity</p>
            </div>
          </div>
          {offers.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-slate-700 bg-[#171c24] px-4 py-6 text-center text-sm text-slate-400">No active offers.</p> : null}
          <ul className="mt-4 space-y-4">
            {offers.slice(0, 4).map((offer) => {
              const start = offer.startsAt ? new Date(offer.startsAt).getTime() : Date.now();
              const end = offer.endsAt ? new Date(offer.endsAt).getTime() : start;
              const span = Math.max(end - start, 1);
              const progress = Math.min(100, Math.max(8, ((Date.now() - start) / span) * 100));
              const label = offer.type === "PERCENTAGE" ? `${Number(offer.value)}% off` : offer.value != null ? money(offer.value) : offer.description;
              return (
                <li key={offer.id}>
                  <div className="flex items-start justify-between gap-3 text-sm">
                    <p className="font-medium text-slate-100">{offer.name}</p>
                    <p className="shrink-0 rounded-md border border-slate-700 bg-[#171c24] px-2 py-0.5 text-[10px] text-slate-400">{offer.endsAt ? `Ends ${when(offer.endsAt)}` : "Active"}</p>
                  </div>
                  <p className="mt-1 text-xs text-amber-200">{label}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-700">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-300" style={{ width: `${progress}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </article>
      </section>
    </div>
  );
}

function Metric({ accent, icon, tone, label, value, hint }: { accent: string; icon: string; tone: string; label: string; value: string; hint: string }) {
  return (
    <article className={`flex items-start justify-between rounded-2xl border border-slate-700 border-t ${accent} bg-[#202630] p-4 shadow-sm`}>
      <div>
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="mt-2 text-[26px] leading-none font-semibold tracking-tight text-slate-100">{value}</p>
        <p className="mt-2 text-xs text-slate-500">{hint}</p>
      </div>
      <span className={`grid h-10 w-10 place-items-center rounded-xl border border-white/5 ${tone}`}>
        <Icon d={icon} />
      </span>
    </article>
  );
}

function OrderTable({ orders }: { orders: AdminOrder[] }) {
  if (orders.length === 0) {
    return <p className="px-5 py-8 text-sm text-slate-400">No orders yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead className="bg-[#171c24] text-[11px] tracking-[0.1em] text-slate-400 uppercase">
          <tr>
            <th className="px-5 py-3 font-medium"><span className="inline-flex items-center gap-1.5"><Icon d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3zM9 8h6M9 12h6" />Order</span></th>
            <th className="px-5 py-3 font-medium"><span className="inline-flex items-center gap-1.5"><Icon d="M20 21a8 8 0 0 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />Customer</span></th>
            <th className="px-5 py-3 font-medium"><span className="inline-flex items-center gap-1.5"><Icon d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0zM12 10h.01" />City</span></th>
            <th className="px-5 py-3 font-medium">Referred by</th>
            <th className="px-5 py-3 font-medium">Commission</th>
            <th className="px-5 py-3 font-medium"><span className="inline-flex items-center gap-1.5"><Icon d="M12 2v20m5-16H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />Total</span></th>
            <th className="px-5 py-3 font-medium"><span className="inline-flex items-center gap-1.5"><Icon d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11zM9 12l2 2 4-4" />Status</span></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id} className="border-t border-slate-700 transition-colors duration-200 hover:bg-slate-700/20">
              <td className="px-5 py-3.5">
                <Link to={`/admin/orders/${order.id}`} className="inline-flex items-center gap-1.5 rounded-md font-semibold text-white transition-colors duration-200 hover:text-sky-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />{order.orderNumber}
                </Link>
                <p className="mt-1 text-xs text-slate-400">{when(order.placedAt)}</p>
              </td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-sky-700/50 bg-sky-950/40 text-[10px] font-semibold text-sky-200">
                    {buyer(order).split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-100">{buyer(order)}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{buyerEmail(order)}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3.5 text-slate-300">{order.shippingCity || "—"}</td>
              <td className="px-5 py-3.5">
                {order.referredByStaff ? (
                  <span className="rounded-full border border-orange-700/40 bg-orange-950/20 px-2.5 py-1 text-xs text-orange-200">
                    {order.referredByStaff.firstName} {order.referredByStaff.lastName}
                  </span>
                ) : <span className="text-xs text-slate-500">Direct</span>}
              </td>
              <td className="px-5 py-3.5">
                {order.referredByStaff ? (
                  <>
                    <span className="font-medium text-emerald-200">
                      {money(order.items.reduce(
                        (total, item) => total + Number(item.commissionPerUnit) * item.quantity,
                        0,
                      ))}
                    </span>
                    <span className="mt-1 block text-[10px] text-slate-400">
                      {order.staffCommissionPaidAt ? "Paid" : order.status === "DELIVERED" ? "Due" : "After delivery"}
                    </span>
                  </>
                ) : <span className="text-xs text-slate-500">—</span>}
              </td>
              <td className="px-5 py-3.5 font-semibold text-sky-200">{money(order.total)}</td>
              <td className="px-5 py-3.5"><StatusBadge status={order.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminOrders() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .adminOrders({ page, limit: 12, status: status || undefined })
      .then((result) => {
        setOrders(result.items);
        setMeta(result.meta);
        setError("");
      })
      .catch((reason) => setError(reason instanceof ApiError ? reason.message : "Could not load orders"))
      .finally(() => setLoading(false));
  }, [page, status]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-sky-500 bg-[#171c24] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-sky-800/60 bg-sky-950/30 text-sky-200"><Icon d="M6 6h15l-1.5 9h-12L6 6zM6 6 5 3H2m5 15a1 1 0 1 0 0 .01M18 18a1 1 0 1 0 0 .01" /></span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-300">Order management</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Orders</h1>
            <p className="mt-0.5 text-xs text-slate-400">Review purchases and keep fulfillment moving</p>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <span className="mb-0.5 rounded-lg border border-sky-800/50 bg-sky-950/25 px-3 py-2 text-sm font-semibold text-sky-200">
            {meta ? `${meta.total} total orders` : loading ? <SkeletonBlock className="h-4 w-24" /> : "0 total orders"}
          </span>
          <label className="text-sm text-slate-300">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Filter by status</span>
          <span className="relative block">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sky-300">
              <Icon d="M4 5h16l-6.5 7.5V19l-3 1v-7.5L4 5z" />
            </span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              className="block min-w-44 appearance-none rounded-xl border border-slate-600 bg-[#171c24] py-2.5 pr-10 pl-10 text-sm font-medium text-white outline-none transition-colors duration-200 hover:border-sky-600 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
            >
              <option value="">All statuses</option>
              {STATUSES.map((item) => (
                <option key={item} value={item}>{titleCaseStatus(item)}</option>
              ))}
            </select>
            <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-slate-400">
              <Icon d="m6 9 6 6 6-6" />
            </span>
          </span>
          </label>
        </div>
      </header>
      {error ? <p className="rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-sky-700 bg-[#202630] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-sky-800/50 bg-sky-950/25 text-sky-200"><Icon d="M4 4h16v16H4zM8 8h8M8 12h8M8 16h5" /></span>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Order register</h2>
              <p className="mt-0.5 text-xs text-slate-400">{status ? `${titleCaseStatus(status)} orders` : "Latest customer orders"}</p>
            </div>
          </div>
          <span className="rounded-lg border border-slate-600 bg-[#171c24] px-2.5 py-1 text-xs text-slate-300">{loading ? "Loading…" : `${orders.length} shown`}</span>
        </div>
        {loading ? <RowsSkeleton rows={6} columns={5} /> : <OrderTable orders={orders} />}
      </section>
      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-600 bg-[#202630] px-3 py-1.5 text-sm text-slate-300 transition-colors hover:border-[#9b6075] hover:text-white disabled:opacity-40">Previous</button>
          <span className="rounded-lg border border-slate-700 bg-[#171c24] px-3 py-1.5 text-xs text-slate-300">Page {page} of {meta.totalPages}</span>
          <button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-600 bg-[#202630] px-3 py-1.5 text-sm text-slate-300 transition-colors hover:border-[#9b6075] hover:text-white disabled:opacity-40">Next</button>
        </div>
      ) : null}
    </div>
  );
}

export function AdminOrderDetail() {
  const { id = "" } = useParams();
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [error, setError] = useState("");
  const [next, setNext] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [customerProfile, setCustomerProfile] = useState<Pick<User, "firstName" | "lastName" | "email" | "phone"> | null>(null);

  useEffect(() => {
    api.order(id).then((item) => {
      setOrder(item);
      setNext("");
      setReason("");
    }).catch((reasonError) => setError(reasonError instanceof ApiError ? reasonError.message : "Order not found"));
  }, [id]);

  const options = order ? NEXT_STATUS[order.status] ?? [] : [];
  const commissionTotal = order
    ? order.items.reduce(
        (total, item) => total + Number(item.commissionPerUnit) * item.quantity,
        0,
      )
    : 0;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!order || !next) return;
    if (next === "CANCELLED" && reason.trim().length === 0) {
      setError("A cancel reason is required");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const updated = await api.updateOrderStatus(order.id, {
        status: next,
        ...(next === "CANCELLED" ? { cancelReason: reason.trim() } : {}),
      });
      setOrder(updated);
      setNext("");
      setReason("");
    } catch (reasonError) {
      setError(reasonError instanceof ApiError ? reasonError.message : "Could not update the order");
    } finally {
      setBusy(false);
    }
  }

  async function recordCommissionPayout() {
    if (!order) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api.recordStaffCommissionPayout(order.id);
      setOrder(updated);
      setNote("Staff commission payout recorded as paid.");
    } catch (reasonError) {
      setError(reasonError instanceof ApiError ? reasonError.message : "Could not record the staff commission payout");
    } finally {
      setBusy(false);
    }
  }

  if (error && !order) return <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>;
  if (!order) return <DetailSkeleton />;

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-slate-700 border-t-2 border-t-sky-600 bg-[#202630] p-5 shadow-sm">
        <Link to="/admin/orders" className="group inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#171c24] px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors duration-200 hover:border-sky-600 hover:bg-[#242a35] hover:text-sky-200">
          <span className="transition-transform duration-200 group-hover:-translate-x-0.5"><Icon d="M10 6 4 12l6 6M4 12h16" /></span>
          Back to orders
        </Link>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl border border-sky-800/60 bg-sky-950/30 text-sky-200">
                <Icon d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3zM9 8h6M9 12h6M9 16h3" />
              </span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">Order number</p>
                <h1 className="text-xl font-semibold tracking-tight text-slate-100">{order.orderNumber}</h1>
              </div>
              <span className="translate-y-1.5"><StatusBadge status={order.status} /></span>
            </div>
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-[#171c24] px-2.5 py-1.5 text-xs text-slate-400">
              <Icon d="M7 3v3m10-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13H4V6a1 1 0 0 1 1-1z" />
              Placed {when(order.placedAt)}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Referred by: <span className="font-medium text-orange-200">
                {order.referredByStaff
                  ? `${order.referredByStaff.firstName} ${order.referredByStaff.lastName}`
                  : "Direct order"}
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
          {order.paymentMethod === "COD" ? (
            <button
              type="button"
              className="rounded-xl bg-sky-700 px-3.5 py-2.5 text-sm font-semibold text-white transition duration-200 hover:bg-sky-600 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#202630]"
              onClick={() => {
                api.collectCash(order.id).then(() => setNote("Cash collected")).catch((reasonError) => setError(reasonError instanceof ApiError ? reasonError.message : "Could not collect cash"));
              }}
            >
              Collect cash
            </button>
          ) : null}
          {order.user ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-600 bg-[#171c24] px-3.5 py-2.5 text-sm font-medium text-slate-200 transition-colors duration-200 hover:border-sky-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              onClick={() => {
                api.user(order.user!.id).then((person) => setCustomerProfile(person)).catch((reasonError) => setError(reasonError instanceof ApiError ? reasonError.message : "Could not load the customer"));
              }}
            >
              <Icon d="M20 21a8 8 0 0 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
              View customer
            </button>
          ) : null}
          </div>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-[#171c24] px-3.5 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-sky-800/50 bg-sky-950/25 text-sky-200"><Icon d="M3 7h18v13H3zM7 7V5h10v2M7 12h4" /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Payment</p>
              <p className="mt-0.5 truncate text-sm font-medium text-slate-200">{order.paymentMethod === "COD" ? "Cash on delivery" : order.paymentMethod ? titleCaseStatus(order.paymentMethod) : "Not recorded"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-slate-700 bg-[#171c24] px-3.5 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-slate-600 bg-[#202630] text-slate-300"><Icon d="M4 7h16v13H4zM8 7V5h8v2M8 12h8M8 16h5" /></span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">Items</p>
              <p className="mt-0.5 text-sm font-medium text-slate-200">{order.items.reduce((sum, item) => sum + item.quantity, 0)} units <span className="text-xs text-slate-500">· {order.items.length} lines</span></p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-sky-800/40 bg-sky-950/15 px-3.5 py-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-sky-800/50 bg-sky-950/25 text-sky-200"><Icon d="M12 2v20m5-16H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-sky-300">Order total</p>
              <p className="mt-0.5 text-base font-semibold text-sky-200">{money(order.total)}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-800/40 bg-emerald-950/15 px-3.5 py-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-800/50 bg-emerald-950/25 text-emerald-200"><Icon d="M12 2v20m5-16H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-300">Staff commission</p>
                <p className="mt-0.5 text-sm font-semibold text-emerald-200">{money(commissionTotal)}</p>
                <p className="text-[10px] text-slate-400">
                  {order.referredByStaff
                    ? order.staffCommissionPaidAt
                      ? `Paid to ${order.referredByStaff.firstName}`
                      : order.status === "DELIVERED"
                        ? `Due to ${order.referredByStaff.firstName}`
                        : "Payable after delivery"
                    : "No staff referral"}
                </p>
              </div>
            </div>
            {order.referredByStaff &&
            commissionTotal > 0 &&
            order.status === "DELIVERED" &&
            !order.staffCommissionPaidAt ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void recordCommissionPayout()}
                className="rounded-lg border border-emerald-700/60 px-3 py-2 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-950/50 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Mark paid"}
              </button>
            ) : null}
          </div>
        </div>
        {customerProfile ? (
          <section aria-live="polite" className="mt-4 flex items-center gap-3 rounded-xl border border-sky-800/50 bg-sky-950/15 p-3.5 shadow-inner">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-sky-700 bg-sky-950/40 text-sm font-semibold text-sky-200">
              {`${customerProfile.firstName.slice(0, 1)}${customerProfile.lastName.slice(0, 1)}`.toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-300">Customer profile</p>
              <p className="mt-0.5 truncate text-sm font-semibold text-slate-100">{customerProfile.firstName} {customerProfile.lastName}</p>
              <p className="truncate text-xs text-slate-400">{customerProfile.email}{customerProfile.phone ? ` · ${customerProfile.phone}` : ""}</p>
            </div>
          </section>
        ) : null}
        {note ? <p role="status" className="mt-3 rounded-xl border border-emerald-800/60 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-200">{note}</p> : null}
      </header>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-sky-700 bg-[#202630] shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-sky-800/50 bg-sky-950/25 text-sky-200">
                <Icon d="M4 7h16l-1 13H5L4 7zM9 7a3 3 0 0 1 6 0" />
              </span>
              <h2 className="text-sm font-semibold text-slate-100">Items</h2>
            </div>
            <span className="rounded-lg border border-slate-600 bg-[#171c24] px-2.5 py-1 text-xs font-medium text-slate-300">{order.items.length} items</span>
          </div>
          <ul className="divide-y divide-slate-700 px-5">
            {order.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-4 text-sm transition-colors duration-200 hover:bg-slate-700/10">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-100">{item.productName}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md border border-slate-700 bg-[#171c24] px-2 py-0.5 text-[11px] text-slate-400">SKU {item.sku}</span>
                    <span className="rounded-md border border-sky-800/50 bg-sky-950/30 px-2 py-0.5 text-[11px] font-medium text-sky-200">Qty {item.quantity}</span>
                    {order.referredByStaff ? (
                      <span className="rounded-md border border-emerald-800/50 bg-emerald-950/25 px-2 py-0.5 text-[11px] text-emerald-200">
                        Staff commission {money(Number(item.commissionPerUnit) * item.quantity)}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="shrink-0 rounded-lg bg-[#171c24] px-2.5 py-1.5 font-semibold text-slate-100">{money(item.lineTotal)}</p>
              </li>
            ))}
          </ul>
          <dl className="mx-5 space-y-2 border-t border-slate-700 py-4 text-sm">
            <div className="flex justify-between text-slate-400"><dt>Subtotal</dt><dd className="text-slate-200">{money(order.subtotal)}</dd></div>
            <div className="flex justify-between text-slate-400"><dt>Discount</dt><dd className="text-emerald-300">−{money(order.discountAmount)}</dd></div>
            <div className="flex justify-between text-slate-400"><dt>Shipping</dt><dd className="text-slate-200">{money(order.shippingAmount)}</dd></div>
            <div className="flex justify-between border-t border-slate-700 pt-3 text-base font-semibold text-slate-100"><dt>Total</dt><dd className="text-sky-200">{money(order.total)}</dd></div>
          </dl>
        </section>
        <div className="space-y-4">
          <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-sky-700 bg-[#202630] text-sm shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-700 px-5 py-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-sky-800/50 bg-sky-950/25 text-sky-200">
                <Icon d="M20 21a8 8 0 0 0-16 0M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
              </span>
              <div>
                <h2 className="font-semibold text-slate-100">Customer</h2>
                <p className="text-xs text-slate-400">Contact and delivery details</p>
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sky-700 text-xs font-semibold text-white">
                  {buyer(order).split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-100">{buyer(order)}</p>
                  <p className="truncate text-xs text-slate-400">{buyerEmail(order)}</p>
                </div>
              </div>
              <div className="mt-4 space-y-3 border-t border-slate-700 pt-4">
                <p className="flex items-start gap-3 text-slate-300">
                  <span className="mt-0.5 text-sky-300"><Icon d="M6.6 3h3l1.5 4-2 1.5a15 15 0 0 0 6.4 6.4l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.6 5.2 2 2 0 0 1 6.6 3z" /></span>
                  <span>{order.shippingPhone}</span>
                </p>
                <p className="flex items-start gap-3 leading-6 text-slate-300">
                  <span className="mt-1 text-sky-300"><Icon d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0zM12 10h.01" /></span>
                  <span>
                    {order.shippingLine1}
                    {order.shippingLine2 ? `, ${order.shippingLine2}` : ""}
                    <br />
                    {order.shippingCity}{order.shippingState ? `, ${order.shippingState}` : ""} {order.shippingPostalCode}
                    <br />
                    {order.shippingCountry}
                  </span>
                </p>
              </div>
              {order.customerNote ? <p className="mt-4 rounded-xl border border-slate-700 bg-[#171c24] px-3 py-2.5 text-slate-300"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-300">Customer note</span>{order.customerNote}</p> : null}
              {order.cancelReason ? <p className="mt-3 rounded-xl border border-rose-900/60 bg-rose-950/30 px-3 py-2.5 text-rose-200">Cancelled: {order.cancelReason}</p> : null}
            </div>
          </section>
          <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-sky-700 bg-[#202630] shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-700 px-5 py-4">
              <span className="grid h-9 w-9 place-items-center rounded-xl border border-sky-800/50 bg-sky-950/25 text-sky-200">
                <Icon d="M12 3v4m0 10v4M3 12h4m10 0h4M5.6 5.6l2.8 2.8m7.2 7.2 2.8 2.8m0-12.8-2.8 2.8m-7.2 7.2-2.8 2.8" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-100">Update status</h2>
                <p className="text-xs text-slate-400">Current: {titleCaseStatus(order.status)}</p>
              </div>
            </div>
            <div className="px-5 pt-3 pb-5">
            {options.length === 0 ? (
              <p className="mt-2 text-sm text-slate-400">This order cannot move further.</p>
            ) : (
              <form onSubmit={onSubmit} className="mt-1 space-y-3">
                <div className="flex flex-wrap gap-2">
                  {options.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setNext(status)}
                      aria-pressed={next === status}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ring-1 ring-inset transition-colors duration-200 ${next === status ? "bg-sky-700 text-white ring-sky-400" : "bg-[#171c24] text-slate-300 ring-slate-600 hover:text-white hover:ring-sky-600"}`}
                    >
                      {next === status ? <Icon d="m5 12 4 4L19 6" /> : null}
                      {titleCaseStatus(status)}
                    </button>
                  ))}
                </div>
                {next === "CANCELLED" ? (
                  <textarea
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    required
                    placeholder="Why is this order being cancelled?"
                    className="w-full rounded-xl border border-slate-600 bg-[#171c24] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
                    rows={3}
                  />
                ) : null}
                {error ? <p className="rounded-xl border border-rose-900/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200">{error}</p> : null}
                <button type="submit" disabled={!next || busy} className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white transition duration-200 hover:bg-sky-600 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-40">
                  {busy ? "Saving…" : <><Icon d="M5 12h14m-6-6 6 6-6 6" /> Save status</>}
                </button>
              </form>
            )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

type AdminProduct = ProductCardData & {
  status?: string;
  variants?: { stock: number }[];
};

export function AdminProducts() {
  const { user } = useAuth();
  const canDeleteProducts = user?.adminRole === "SUPER_ADMIN";
  const [params] = useSearchParams();
  const search = params.get("search") ?? "";
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AdminProduct[]>([]);
  const [meta, setMeta] = useState<PageMeta | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [stockProduct, setStockProduct] = useState<ProductDetail | null>(null);
  const [selectedStockVariantId, setSelectedStockVariantId] = useState("");
  const [stockToAdd, setStockToAdd] = useState("");
  const [stockBusy, setStockBusy] = useState(false);
  const [stockError, setStockError] = useState("");
  const [stockNote, setStockNote] = useState("");

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    let active = true;
    const loadProducts = () => {
      setLoading(true);
      setError("");
      api
        .products({ page, limit: 12, sort: "latest", search: search || undefined })
        .then((result) => {
          if (!active) return;
          setItems(result.items as AdminProduct[]);
          setMeta(result.meta);
        })
        .catch((reason) => {
          if (active) setError(reason instanceof ApiError ? reason.message : "Could not load products");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };
    loadProducts();
    window.addEventListener("app:products-changed", loadProducts);
    window.addEventListener("app:variant-changed", loadProducts);
    return () => {
      active = false;
      window.removeEventListener("app:products-changed", loadProducts);
      window.removeEventListener("app:variant-changed", loadProducts);
    };
  }, [page, search]);

  const visibleStock = items.reduce((sum, product) => sum + (product.variants ?? []).reduce((variantSum, variant) => variantSum + variant.stock, 0), 0);
  const lowStockProducts = items.filter((product) => {
    const productStock = (product.variants ?? []).reduce((sum, variant) => sum + variant.stock, 0);
    return productStock > 0 && productStock <= 5;
  }).length;
  const activeStockVariants = stockProduct?.variants.filter((variant) => variant.isActive !== false) ?? [];
  const selectedStockVariant = activeStockVariants.find((variant) => variant.id === selectedStockVariantId);

  async function openStockEditor(productId: string) {
    setStockError("");
    setStockNote("");
    setStockProduct(null);
    setSelectedStockVariantId("");
    setStockToAdd("");
    try {
      const product = await api.product(productId, true);
      setStockProduct(product);
      const firstActiveVariant = product.variants.find((variant) => variant.isActive !== false);
      setSelectedStockVariantId(firstActiveVariant?.id ?? "");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not load product inventory");
    }
  }

  async function addProductStock(event: FormEvent) {
    event.preventDefault();
    if (!stockProduct) return;
    const quantity = Number(stockToAdd);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      setStockError("Enter a whole number greater than zero.");
      return;
    }

    setStockBusy(true);
    setStockError("");
    try {
      if (selectedStockVariant) {
        await api.saveVariant({
          stock: selectedStockVariant.stock + quantity,
        }, selectedStockVariant.id);
      } else {
        const skuBase = (stockProduct.slug || stockProduct.name)
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 40) || "ITEM";
        const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
        const newVariant = {
          productId: stockProduct.id,
          sku: `${skuBase}-${suffix}`,
          stock: quantity,
        };
        const [sizes, fabrics] = await Promise.all([api.sizes(), api.fabrics()]);
        let genericSize = sizes.find((size) => size.slug === "one-size");
        if (!genericSize) {
          try {
            genericSize = await api.createSize({ name: "One Size", slug: "one-size" });
          } catch (createError) {
            if (!(createError instanceof ApiError) || createError.status !== 409) {
              throw createError;
            }
            genericSize = (await api.sizes({ fresh: true })).find(
              (size) => size.slug === "one-size",
            );
            if (!genericSize) throw createError;
          }
        }

        let genericFabric = fabrics.find((fabric) => fabric.slug === "not-applicable");
        if (!genericFabric) {
          try {
            genericFabric = await api.createFabric({
              name: "Not Applicable",
              slug: "not-applicable",
            });
          } catch (createError) {
            if (!(createError instanceof ApiError) || createError.status !== 409) {
              throw createError;
            }
            genericFabric = (await api.fabrics({ fresh: true })).find(
              (fabric) => fabric.slug === "not-applicable",
            );
            if (!genericFabric) throw createError;
          }
        }

        await api.saveVariant({
          ...newVariant,
          sizeId: genericSize.id,
          fabricId: genericFabric.id,
        });
      }

      setStockNote(`${quantity} units added to ${stockProduct.name}.`);
      setStockProduct(null);
      setStockToAdd("");
    } catch (reason) {
      if (reason instanceof ApiError) {
        const details = reason.errors
          ?.map((issue) => `${issue.path}: ${issue.message}`)
          .join("; ");
        const compatibilityHint = reason.errors?.some(
          (issue) => issue.path === "sizeId" || issue.path === "fabricId",
        )
          ? " The backend still requires size/fabric fields. Deploy the updated backend and run `pnpm db:deploy`."
          : "";
        setStockError(`${reason.message}${details ? ` — ${details}` : ""}${compatibilityHint}`);
      } else {
        setStockError("Could not update product stock");
      }
    } finally {
      setStockBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-700 border-l-2 border-l-emerald-500 bg-[#171c24] p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-emerald-800/60 bg-emerald-950/30 text-emerald-200"><Icon d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8" /></span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Catalog management</p>
            <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-100">Products</h1>
            <p className="mt-0.5 text-xs text-slate-400">{search ? `Results for “${search}”` : meta ? `${meta.total} products in your catalog` : loading ? <SkeletonBlock className="h-3.5 w-28" /> : "Manage your product range"}</p>
          </div>
        </div>
        <Link to="/admin/products/new" className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition duration-200 hover:bg-emerald-600 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
          <Icon d="M12 5v14m-7-7h14" />
          Add product
        </Link>
      </header>
      {error ? <p className="rounded-xl border border-rose-800/60 bg-rose-950/30 px-4 py-3 text-sm text-rose-200" role="alert">{error}</p> : null}
      <section className="overflow-hidden rounded-2xl border border-slate-700 border-t-2 border-t-emerald-700 bg-[#202630] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-xl border border-emerald-800/50 bg-emerald-950/25 text-emerald-200"><Icon d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8" /></span>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Product inventory</h2>
              <p className="mt-0.5 text-xs text-slate-400">Current page stock overview</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg border border-slate-600 bg-[#171c24] px-2.5 py-1 text-xs text-slate-300">{items.length} shown</span>
            <span className="rounded-lg border border-emerald-800/60 bg-emerald-950/25 px-2.5 py-1 text-xs text-emerald-200">{visibleStock} units</span>
            <span className="rounded-lg border border-rose-800/60 bg-rose-950/25 px-2.5 py-1 text-xs text-rose-200">{lowStockProducts} low stock</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-[#171c24] text-[11px] tracking-[0.1em] text-slate-400 uppercase">
              <tr>
                <th className="px-5 py-3 font-medium"><span className="inline-flex items-center gap-1.5"><Icon d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8" />Product</span></th>
                <th className="px-5 py-3 font-medium"><span className="inline-flex items-center gap-1.5"><Icon d="M4 5h7v7H4V5zm9 0h7v7h-7V5zM4 14h7v5H4v-5zm9 0h7v5h-7v-5z" />Category</span></th>
                <th className="px-5 py-3 font-medium"><span className="inline-flex items-center gap-1.5"><Icon d="M12 2v20m5-16H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />Price</span></th>
                <th className="px-5 py-3 font-medium"><span className="inline-flex items-center gap-1.5"><Icon d="m2 5 6-3 6 3v6l-6 3-6-3zM2 5l6 3 6-3m-6 3v6m6-8 4-2 6 3v6l-6 3-4-2" />Stock</span></th>
                <th className="px-5 py-3 font-medium"><span className="inline-flex items-center gap-1.5"><Icon d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11zM9 12l2 2 4-4" />Status</span></th>
                <th className="px-5 py-3 text-right font-medium"><span className="inline-flex items-center justify-end gap-1.5"><Icon d="M4 6h16M4 12h16M4 18h16" />Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-5"><RowsSkeleton rows={6} columns={6} /></td></tr>
              ) : items.map((product) => {
                const stock = (product.variants ?? []).reduce((sum, variant) => sum + variant.stock, 0);
                return (
                  <tr key={product.id} className="border-t border-slate-700 transition-colors duration-200 ease-out hover:bg-slate-700/20">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {coverImage(product) ? <img src={coverImage(product) ?? ""} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-slate-700 bg-[#171c24] object-cover" /> : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-slate-700 bg-[#171c24] text-sm font-semibold text-[#f0c0cf]">{product.name.slice(0, 1)}</span>}
                        <div className="min-w-0">
                          <Link to={`/product/${product.id}`} className="block truncate font-medium text-slate-100 transition-colors duration-200 ease-out hover:text-emerald-300">{product.name}</Link>
                          <p className="mt-0.5 truncate text-xs text-slate-400">{product.brand?.name ?? "Unbranded"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5"><span className="rounded-md border border-slate-700 bg-[#171c24] px-2 py-1 text-xs text-slate-300">{product.category?.name ?? "Uncategorized"}</span></td>
                    <td className="px-5 py-3.5 font-semibold text-slate-100">{money(product.basePrice)}</td>
                    <td className="px-5 py-3.5"><span className={`inline-flex min-w-14 justify-center rounded-lg border px-2.5 py-1 text-xs font-semibold ${stock <= 0 ? "border-rose-800/60 bg-rose-950/30 text-rose-200" : stock <= 5 ? "border-amber-800/60 bg-amber-950/25 text-amber-200" : "border-emerald-800/60 bg-emerald-950/25 text-emerald-200"}`}>{stock}</span></td>
                    <td className="px-5 py-3.5">{product.status ? <StatusBadge status={product.status} /> : "—"}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-emerald-700/70 bg-emerald-950/30 px-3 text-sm font-medium text-emerald-200 transition-colors duration-200 hover:bg-emerald-800/50"
                          onClick={() => void openStockEditor(product.id)}
                        >
                          <Icon d="M12 5v14m-7-7h14" />
                          Add stock
                        </button>
                        <Link
                          to={`/admin/products/${product.id}/edit`}
                          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-600 bg-[#202630] px-3 text-sm font-medium text-slate-300 transition-colors duration-200 hover:border-emerald-700 hover:bg-emerald-950/40 hover:text-emerald-200"
                        >
                          <Icon d="m15 5 4 4M4 20l4.5-1 10.2-10.2a2.1 2.1 0 0 0-3-3L5.5 16 4 20z" />
                          Edit
                        </Link>
                        {canDeleteProducts ? (
                          <button
                            type="button"
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 text-sm font-medium text-rose-300 transition-colors duration-200 hover:border-rose-700 hover:bg-rose-700 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#202630]"
                            onClick={() => {
                              if (!window.confirm(`Delete ${product.name}?`)) return;
                              api.deleteProduct(product.id).then((result) => {
                                if (result.archived) {
                                  setItems((current) => current.map((item) => item.id === product.id ? { ...item, status: "ARCHIVED" } : item));
                                  setError(result.message);
                                  return;
                                }
                                setItems((current) => current.filter((item) => item.id !== product.id));
                                setError("");
                              }).catch((reason) => setError(reason instanceof ApiError ? reason.message : "Could not delete the product"));
                            }}
                          >
                            <Icon d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" />
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!loading && items.length === 0 && !error ? <div className="px-5 py-12 text-center"><span className="mx-auto grid h-11 w-11 place-items-center rounded-xl border border-slate-700 bg-[#171c24] text-slate-400"><Icon d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8" /></span><p className="mt-3 text-sm font-medium text-slate-200">No products found</p><p className="mt-1 text-xs text-slate-400">Add a product or adjust your search to see catalog results.</p></div> : null}
      </section>
      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)} className="rounded-lg border border-slate-600 bg-[#202630] px-3 py-1.5 text-sm text-slate-300 transition-colors hover:border-[#9b6075] hover:text-white disabled:opacity-40">Previous</button>
          <span className="rounded-lg border border-slate-700 bg-[#171c24] px-3 py-1.5 text-xs text-slate-300">Page {page} of {meta.totalPages}</span>
          <button type="button" disabled={page >= meta.totalPages} onClick={() => setPage((current) => current + 1)} className="rounded-lg border border-slate-600 bg-[#202630] px-3 py-1.5 text-sm text-slate-300 transition-colors hover:border-[#9b6075] hover:text-white disabled:opacity-40">Next</button>
        </div>
      ) : null}
      {stockProduct ? (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/70 p-4" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !stockBusy) setStockProduct(null);
        }}>
          <form
            className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-600 bg-[#202630] p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="stock-dialog-title"
            onSubmit={addProductStock}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300">Inventory update</p>
                <h2 id="stock-dialog-title" className="mt-1 text-lg font-semibold text-slate-100">Add stock</h2>
                <p className="mt-1 text-sm text-slate-400">{stockProduct.name}</p>
              </div>
              <button type="button" className="rounded-lg border border-slate-600 px-3 py-1.5 text-sm text-slate-300 disabled:opacity-50" disabled={stockBusy} onClick={() => setStockProduct(null)}>Close</button>
            </div>
            {activeStockVariants.length > 0 ? (
              <>
                <label className="grid gap-1.5 text-sm text-slate-300">
                  Inventory option
                  <select className="h-11 rounded-xl border border-slate-600 bg-[#171c24] px-3 text-white" value={selectedStockVariantId} onChange={(event) => setSelectedStockVariantId(event.target.value)}>
                    {activeStockVariants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {[variant.optionLabel, variant.size?.name, variant.color?.name, variant.fabric?.name].filter(Boolean).join(" / ") || variant.sku} — {variant.stock} in stock
                      </option>
                    ))}
                  </select>
                </label>
                {selectedStockVariant ? <p className="text-xs text-slate-400">Current stock: {selectedStockVariant.stock} · Reserved: {selectedStockVariant.reserved ?? 0}</p> : null}
              </>
            ) : (
              <p className="rounded-xl border border-amber-800/60 bg-amber-950/20 px-3 py-2 text-sm text-amber-100">This product has no active inventory option yet. Add the opening stock below to create one. For compatibility, the system uses “One Size” and “Not Applicable”; no option label is added.</p>
            )}
            <label className="grid gap-1.5 text-sm text-slate-300">
              Units to add
              <input className="h-11 rounded-xl border border-slate-600 bg-[#171c24] px-3 text-white" type="number" min="1" step="1" required value={stockToAdd} onChange={(event) => setStockToAdd(event.target.value)} placeholder="Enter quantity to add" />
            </label>
            {stockError ? <p className="rounded-lg border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-sm text-rose-200" role="alert">{stockError}</p> : null}
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-xl border border-slate-600 px-4 py-2.5 text-sm text-slate-300" disabled={stockBusy} onClick={() => setStockProduct(null)}>Cancel</button>
              <button type="submit" className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50" disabled={stockBusy || (activeStockVariants.length > 0 && !selectedStockVariant)}>
                {stockBusy ? "Saving…" : "Add stock"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
      {stockNote ? <div className="fixed bottom-5 right-5 z-[110] rounded-xl border border-emerald-700 bg-emerald-950 px-4 py-3 text-sm text-emerald-100" role="status">{stockNote}</div> : null}
    </div>
  );
}
