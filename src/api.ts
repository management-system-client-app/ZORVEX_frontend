import type {
  Cart,
  Catalog,
  Category,
  CmsPage,
  Color,
  AdminOrder,
  DashboardOverview,
  AdminHomeBlock,
  HomePayload,
  OrderResult,
  Outlet,
  PageMeta,
  ProductCardData,
  ProductDetail,
  Promotion,
  Review,
  Settings,
  SizeGuide,
  TrackedOrder,
  User,
  Brand,
  Size,
  Fabric,
  Coupon,
  CouponQuote,
  DeliveryZone,
  Subscriber,
  StoreReturn,
  ManualPayment,
  SavedAddress,
  VariantRow,
  StaffAccount,
  StaffReferral,
} from "./types";
import { prepareImageForUpload } from "./imageUpload";

const configuredApiUrl =
  import.meta.env.VITE_API_URL?.trim() ||
  "/api/v1";
export const API_BASE = `${configuredApiUrl.replace(/\/+$/, "").replace(/\/api\/v1$/i, "")}/api/v1`;
const TOKEN_KEY = "store_token";
const SESSION_KEY = "cart_session";
export const DATA_REFRESH_INTERVAL = 60_000;

const getCache = new Map<string, Envelope<unknown>>();
const pendingGets = new Map<string, Promise<Envelope<unknown>>>();
const latestGetRequest = new Map<string, number>();
let cacheVersion = 0;
let nextGetRequest = 0;

function clearApiCache() {
  cacheVersion += 1;
  getCache.clear();
  pendingGets.clear();
  latestGetRequest.clear();
}

function clearProductAndVariantCache() {
  const isProductOrVariantPath = (key: string) => /:(?:\/products|\/variants)(?:\/|\?|$)/i.test(key);
  for (const key of getCache.keys()) {
    if (isProductOrVariantPath(key)) getCache.delete(key);
  }
  for (const key of pendingGets.keys()) {
    if (isProductOrVariantPath(key)) pendingGets.delete(key);
  }
  for (const key of latestGetRequest.keys()) {
    if (isProductOrVariantPath(key)) latestGetRequest.delete(key);
  }
}

function dispatchToast(type: "success" | "error", message: string) {
  window.dispatchEvent(new CustomEvent("app:toast", { detail: { type, message } }));
}

function mutationSuccessMessage(path: string, method: string) {
  if (/\/auth\/(admin\/)?login$/i.test(path)) return "Logged in successfully";
  if (/\/auth\/logout$/i.test(path)) return "Logged out successfully";
  if (/\/users\/register$/i.test(path)) return "Account created successfully";
  if (/\/cart\/items/i.test(path)) return "Cart updated successfully";
  if (/\/orders\/?$/i.test(path) && method === "POST") return "Order placed successfully";
  if (/\/payments\//i.test(path)) return "Payment updated successfully";
  if (method === "DELETE") return "Deleted successfully";
  if (method === "POST") return "Added successfully";
  return "Changes saved successfully";
}

function shouldCacheGet(path: string) {
  const adminSession = sessionStore.userSnapshot()?.accountType === "ADMIN";
  if (adminSession) return !/^\/(cart|me|wishlist|track)(\/|\?|$)/i.test(path);
  return !/^\/(cart|me|orders|wishlist|returns|dashboard|users|track|payments|admin)(\/|\?|$)/i.test(path);
}

export class ApiError extends Error {
  status: number;
  errors?: { path: string; message: string }[];

  constructor(message: string, status: number, errors?: { path: string; message: string }[]) {
    const isGenericPermissionMessage =
      status === 403 &&
      /^(you do not have permission to perform this action|forbidden|access denied)\.?$/i.test(message.trim());
    super(
      isGenericPermissionMessage
        ? "You don’t have access to this action. Please sign in with the right account or contact support if you think this is a mistake."
        : message,
    );
    this.status = status;
    this.errors = errors;
  }
}

type Envelope<T> = {
  success: boolean;
  message?: string;
  data: T;
  meta?: PageMeta;
  errors?: { path: string; message: string }[];
};

export const sessionStore = {
  token: () => localStorage.getItem(TOKEN_KEY),
  userSnapshot: (): User | null => {
    try {
      const value = sessionStorage.getItem("store_user");
      if (!value) return null;
      const user = JSON.parse(value) as User;
      if (
        typeof user.id !== "string" ||
        typeof user.firstName !== "string" ||
        typeof user.lastName !== "string" ||
        typeof user.email !== "string" ||
        (user.accountType !== "ADMIN" && user.accountType !== "USER")
      ) {
        return null;
      }
      return user;
    } catch {
      return null;
    }
  },
  setUserSnapshot: (user: User | null) => {
    if (user) sessionStorage.setItem("store_user", JSON.stringify(user));
    else sessionStorage.removeItem("store_user");
  },
  setToken: (token: string | null) => {
    if (localStorage.getItem(TOKEN_KEY) !== token) {
      clearApiCache();
      sessionStorage.removeItem("store_user");
    }
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem("store_user");
    }
  },
  cartSession: () => localStorage.getItem(SESSION_KEY),
  setCartSession: (id: string | null) => {
    if (id) localStorage.setItem(SESSION_KEY, id);
    else localStorage.removeItem(SESSION_KEY);
  },
};

async function performRequest<T>(path: string, init: RequestInit): Promise<Envelope<T>> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = sessionStore.token();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const cartSession = sessionStore.cartSession();
  if (cartSession) headers.set("x-cart-session", cartSession);

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  const body = (await response.json().catch(() => null)) as Envelope<T> | null;
  if (!response.ok || !body || body.success === false) {
    if (response.status === 401) sessionStore.setToken(null);
    const responseMessage = body?.message?.trim();
    let message: string;
    if (response.status === 413) {
      message = "Upload is too large for the deployed server. Please choose fewer or smaller images.";
    } else if (!responseMessage) {
      message = response.ok
        ? "The server returned an invalid response"
        : `Request failed (HTTP ${response.status})`;
    } else {
      message = /^request failed\.?$/i.test(responseMessage)
        ? `${responseMessage} (HTTP ${response.status})`
        : responseMessage;
    }
    throw new ApiError(message, response.status, body?.errors);
  }
  return body;
}

function request<T>(
  path: string,
  init: RequestInit = {},
  options: { fresh?: boolean } = {},
): Promise<Envelope<T>> {
  const method = (init.method ?? "GET").toUpperCase();
  const cacheable = method === "GET" && shouldCacheGet(path);
  const useCache = cacheable && !options.fresh;
  const key = `${sessionStore.token() ?? "guest"}:${path}`;

  if (cacheable && options.fresh) pendingGets.delete(key);
  if (useCache) {
    const cached = getCache.get(key);
    if (cached) return Promise.resolve(cached as Envelope<T>);
    const pending = pendingGets.get(key);
    if (pending) return pending as Promise<Envelope<T>>;
  }

  const version = cacheVersion;
  const requestId = cacheable ? ++nextGetRequest : 0;
  if (cacheable) latestGetRequest.set(key, requestId);
  const requestPromise = performRequest<T>(
    path,
    options.fresh ? { ...init, cache: "no-store" } : init,
  ).then((result) => {
    if (method !== "GET") {
      const variantMutation = /^\/variants(?:\/[^/?]+)?\/?$/i.test(path);
      if (variantMutation) clearProductAndVariantCache();
      else clearApiCache();
      dispatchToast("success", mutationSuccessMessage(path, method));
      if (/^\/products(?:\/[^/?]+)?\/?$/i.test(path)) {
        window.dispatchEvent(new Event("app:products-changed"));
      } else if (variantMutation) {
        window.dispatchEvent(new Event("app:variant-changed"));
      }
    } else if (
      cacheable &&
      version === cacheVersion &&
      latestGetRequest.get(key) === requestId
    ) {
      getCache.set(key, result as Envelope<unknown>);
    }
    return result;
  }).catch((reason: unknown) => {
    const expectedAdminLoginFallback =
      path === "/auth/login" && reason instanceof ApiError && reason.status === 401;
    if (method !== "GET" && !expectedAdminLoginFallback) {
      if (!(reason instanceof ApiError && reason.status === 403)) {
        dispatchToast(
          "error",
          reason instanceof Error ? reason.message : "The action could not be completed",
        );
      }
    }
    throw reason;
  });

  if (useCache) {
    const pending = requestPromise as Promise<Envelope<unknown>>;
    pendingGets.set(key, pending);
    const clearPending = () => {
      if (pendingGets.get(key) === pending) pendingGets.delete(key);
    };
    void pending.then(clearPending, clearPending);
  }

  return requestPromise;
}

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

const imageCache = new Map<string, string | null>();

export async function hydrateImages(products: ProductCardData[]): Promise<ProductCardData[]> {
  const missing = products.filter((product) => !product.images?.length && !product.imageUrl);
  await Promise.all(
    missing.map(async (product) => {
      if (imageCache.has(product.id)) return;
      try {
        const detail = await api.product(product.id);
        const url =
          detail.images.find((image) => image.isPrimary)?.url ?? detail.images[0]?.url ?? null;
        imageCache.set(product.id, url);
      } catch {
        imageCache.set(product.id, null);
      }
    }),
  );

  return products.map((product) => {
    if (product.images?.length || product.imageUrl) return product;
    const url = imageCache.get(product.id);
    return url ? { ...product, imageUrl: url } : product;
  });
}

export const api = {
  settings: (fresh = false) => request<Settings>("/settings", {}, { fresh }).then((res) => res.data),
  catalog: (fresh = false) => request<Catalog>("/catalog", {}, { fresh }).then((res) => res.data),
  categories: (fresh = false) =>
    request<Category[]>("/categories?limit=100&isActive=true", {}, { fresh }).then((res) => res.data),
  adminCategories: () => request<Category[]>("/categories?limit=100").then((res) => res.data),
  saveCategory: async (input: Record<string, unknown>, image?: File | null, id?: string) => {
    const body = new FormData();
    body.append("data", JSON.stringify(input));
    if (image) body.append("image", await prepareImageForUpload(image));
    return request<Category>(id ? `/categories/${id}` : "/categories", {
      method: id ? "PATCH" : "POST",
      body,
    }).then((res) => res.data);
  },
  deleteCategory: (id: string) =>
    request<unknown>(`/categories/${id}`, { method: "DELETE" }).then((res) => res.data),
  homeBlocks: () => request<AdminHomeBlock[]>("/home/blocks").then((res) => res.data),
  saveHomeBlock: async (input: Record<string, unknown>, image?: File | null, id?: string) => {
    const body = new FormData();
    body.append("data", JSON.stringify(input));
    if (image) body.append("image", await prepareImageForUpload(image));
    return request<AdminHomeBlock>(id ? `/home/${id}` : "/home", {
      method: id ? "PATCH" : "POST",
      body,
    }).then((res) => res.data);
  },
  deleteHomeBlock: (id: string) =>
    request<unknown>(`/home/${id}`, { method: "DELETE" }).then((res) => res.data),
  home: (fresh = false) => request<HomePayload>("/home", {}, { fresh }).then((res) => res.data),
  promotions: (fresh = false) => request<Promotion[]>("/promotions/active", {}, { fresh }).then((res) => res.data),
  pages: (fresh = false) => request<CmsPage[]>("/pages", {}, { fresh }).then((res) => res.data),
  page: (slug: string, fresh = false) =>
    request<CmsPage>(`/pages/${encodeURIComponent(slug)}`, {}, { fresh }).then((res) => res.data),
  outlets: (fresh = false) => request<Outlet[]>("/outlets", {}, { fresh }).then((res) => res.data),
  products: (
    params: Record<string, string | number | boolean | undefined | null>,
    fresh = false,
  ) =>
    request<ProductCardData[]>(`/products${qs(params)}`, {}, { fresh }).then((res) => ({
      items: res.data,
      meta: res.meta ?? { page: 1, limit: 20, total: res.data.length, totalPages: 1 },
    })),
  bestSellers: (fresh = false) => request<ProductCardData[]>("/products/best-sellers", {}, { fresh }).then((res) => res.data),
  related: (id: string) =>
    request<ProductCardData[]>(`/products/${id}/related`).then((res) => res.data),
  product: (id: string, fresh = false) =>
    request<ProductDetail>(`/products/${id}`, {}, { fresh }).then((res) => res.data),
  createProduct: async (
    input: Record<string, unknown>,
    images: File[],
    imageColorIds: (string | null)[] = [],
  ) => {
    const preparedImages: File[] = [];
    for (const image of images) preparedImages.push(await prepareImageForUpload(image));
    const body = new FormData();
    body.append("data", JSON.stringify(input));
    for (const image of preparedImages) body.append("images", image);
    if (preparedImages.length > 0) body.append("imageColorIds", JSON.stringify(imageColorIds));
    return request<ProductDetail>("/products", { method: "POST", body }).then((res) => res.data);
  },
  updateProduct: async (
    id: string,
    input: Record<string, unknown>,
    images: File[] = [],
    imageColorIds: (string | null)[] = [],
  ) => {
    const preparedImages: File[] = [];
    for (const image of images) preparedImages.push(await prepareImageForUpload(image));
    const body: BodyInit =
      preparedImages.length > 0
        ? (() => {
            const form = new FormData();
            form.append("data", JSON.stringify(input));
            for (const image of preparedImages) form.append("images", image);
            form.append("imageColorIds", JSON.stringify(imageColorIds));
            return form;
          })()
        : JSON.stringify(input);
    return request<ProductDetail>(`/products/${id}`, {
      method: "PATCH",
      body,
    }).then((res) => res.data);
  },
  colors: async (fresh = false): Promise<Color[]> => {
    const found = new Map<string, Color>();
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages && page <= 4) {
      const res = await request<
        { color: Color | null }[]
      >(`/variants${qs({ limit: 100, page, isActive: true })}`, {}, { fresh });
      for (const variant of res.data) {
        if (variant.color) found.set(variant.color.id, variant.color);
      }
      totalPages = res.meta?.totalPages ?? 1;
      page += 1;
    }
    return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
  },
  colorList: (limit = 100) => request<Color[]>(`/catalog/colors${qs({ limit })}`).then((res) => res.data),
  createColor: (body: { name: string; hexCode: string }) =>
    request<Color>("/catalog/colors", {
      method: "POST",
      body: JSON.stringify(body),
    }).then((res) => res.data),
  searchColors: (search: string) =>
    request<Color[]>(`/catalog/colors${qs({ search })}`).then((res) => res.data),
  reviews: (productId: string) =>
    request<Review[]>(`/reviews/products/${productId}`).then((res) => ({
      items: res.data,
      summary:
        (res as Envelope<Review[]> & { summary?: { count: number; averageRating: number } }).summary ?? {
          count: res.data.length,
          averageRating: 0,
        },
    })),
  createReview: (body: { productId: string; rating: number; title?: string; comment: string }) =>
    request<Review>("/reviews", { method: "POST", body: JSON.stringify(body) }).then((res) => res.data),
  sizeGuides: (categoryId: string) =>
    request<SizeGuide[]>(`/size-guides${qs({ categoryId })}`).then((res) => res.data),
  cart: () => request<Cart>("/cart").then((res) => res.data),
  addCartItem: (body: { variantId?: string; productId?: string; quantity: number }) =>
    request<Cart>("/cart/items", { method: "POST", body: JSON.stringify(body) }).then((res) => res.data),
  removeCartItem: (itemId: string) =>
    request<Cart>(`/cart/items/${itemId}`, { method: "DELETE" }).then((res) => res.data),
  choosePayment: (paymentMethod: Cart["paymentMethod"]) =>
    request<Cart>("/cart/payment", {
      method: "POST",
      body: JSON.stringify({ paymentMethod }),
    }).then((res) => res.data),
  quoteDelivery: (city: string, subtotal: number) =>
    request<{
      city: string;
      subtotal: number;
      shippingAmount: number | string;
      zoneId: string | null;
      zoneName: string | null;
      deliveryDistrict: string;
      advancePaymentAmount?: number | string | null;
      advancePaymentCurrency?: string;
    }>(`/delivery-zones/quote${qs({ city, subtotal })}`).then((res) => res.data),
  quotePromotion: (couponCode?: string) =>
    request<{
      subtotal: number;
      discount: number;
      total: number;
      applied: { source: string; label: string; discount: number } | null;
    }>("/promotions/quote", {
      method: "POST",
      body: JSON.stringify(couponCode ? { couponCode } : {}),
    }).then((res) => res.data),
  placeOrder: (body: Record<string, string | undefined>) =>
    request<OrderResult>("/orders", {
      method: "POST",
      body: JSON.stringify(body),
    }).then((res) => res.data),
  createCodAdvanceCheckout: (body: { orderId: string } | { orderNumber: string; phone: string }) =>
    request<{ url: string; paymentId: string; amount: number; currency: string }>(
      "/payments/cod/advance/checkout",
      { method: "POST", body: JSON.stringify(body) },
    ).then((res) => res.data),
  submitManualPayment: (body: {
    orderId?: string;
    orderNumber?: string;
    phone?: string;
    transactionId: string;
  }) =>
    request<unknown>("/payments/manual", { method: "POST", body: JSON.stringify(body) }).then(
      (res) => res.data,
    ),
  track: (orderNumber: string, phone: string) =>
    request<TrackedOrder>(`/orders/track${qs({ orderNumber, phone })}`).then((res) => res.data),
  orders: () =>
    request<
      {
        id: string;
        orderNumber: string;
        status: string;
        total: string | number;
        subtotal?: string | number;
        shippingAmount?: string | number;
        discountAmount?: string | number;
        placedAt: string;
        currency: string;
        items?: { id: string; productName: string; quantity: number; lineTotal: string | number }[];
      }[]
    >("/orders").then((res) => res.data),
  dashboard: () => request<DashboardOverview>("/dashboard").then((res) => res.data),
  adminOrders: (
    params: { page?: number; limit?: number; status?: string },
    options: { fresh?: boolean } = {},
  ) =>
    request<AdminOrder[]>(`/orders${qs(params)}`, {}, options).then((res) => ({
      items: res.data,
      meta: res.meta ?? { page: 1, limit: 20, total: res.data.length, totalPages: 1 },
    })),
  staff: (fresh = false) =>
    request<StaffAccount[]>("/staff", {}, { fresh }).then((res) => {
      const activeCount = res.data.filter((staff) => staff.isActive).length;
      return {
        items: res.data,
        meta: {
          total: res.data.length,
          activeCount,
          limit: 20,
          remaining: Math.max(0, 20 - activeCount),
        },
      };
    }),
  staffReferral: (id: string) =>
    request<StaffReferral>(`/staff/referrals/${id}`).then((res) => res.data),
  createStaff: (body: { firstName: string; lastName: string; email: string; whatsappNumber: string; temporaryPassword: string }) =>
    request<StaffAccount>("/staff", { method: "POST", body: JSON.stringify(body) }).then((res) => res.data),
  updateStaffContact: (id: string, whatsappNumber: string) =>
    request<StaffAccount>(`/staff/${id}/contact`, {
      method: "PATCH",
      body: JSON.stringify({ whatsappNumber }),
    }).then((res) => res.data),
  updateStaffStatus: (id: string, isActive: boolean) =>
    request<StaffAccount>(`/staff/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }).then((res) => res.data),
  order: (id: string) => request<AdminOrder>(`/orders/${id}`).then((res) => res.data),
  updateOrderStatus: (id: string, body: { status: string; cancelReason?: string }) =>
    request<AdminOrder>(`/orders/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }).then((res) => res.data),
  recordStaffCommissionPayout: (id: string) =>
    request<AdminOrder>(`/orders/${id}/commission/paid`, { method: "PATCH" }).then((res) => res.data),
  login: async (email: string, password: string) => {
    const body = JSON.stringify({ email, password });
    try {
      const customer = await request<{ token: string; user: User }>("/auth/login", {
        method: "POST",
        body,
      });
      return {
        token: customer.data.token,
        user: { ...customer.data.user, phone: customer.data.user.phone ?? null, accountType: "USER" as const },
      };
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      const admin = await request<{ token: string; user: User & { role?: User["adminRole"] } }>("/auth/admin/login", {
        method: "POST",
        body,
      });
      return {
        token: admin.data.token,
        user: {
          id: admin.data.user.id,
          firstName: admin.data.user.firstName,
          lastName: admin.data.user.lastName,
          email: admin.data.user.email,
          phone: null,
          avatarUrl: admin.data.user.avatarUrl ?? null,
          accountType: "ADMIN" as const,
          adminRole: admin.data.user.role,
        },
      };
    }
  },
  register: (body: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword: string;
    phone?: string;
  }) => request<User>("/users/register", { method: "POST", body: JSON.stringify(body) }).then((res) => res.data),
  me: () =>
    request<User & { role?: User["adminRole"] }>("/users/me").then((res) => ({
      ...res.data,
      phone: res.data.phone ?? null,
      ...(res.data.accountType === "ADMIN" && res.data.role
        ? { adminRole: res.data.role }
        : {}),
    })),
  defaultAddress: () => request<SavedAddress | null>("/users/me/address").then((res) => res.data),
  saveDefaultAddress: (body: Omit<SavedAddress, "id" | "isDefault" | "label"> & { label?: string }) =>
    request<SavedAddress>("/users/me/address", { method: "PUT", body: JSON.stringify(body) }).then((res) => res.data),
  logout: () => request<unknown>("/auth/logout", { method: "POST" }).then((res) => res.data),
  wishlist: () =>
    request<
      {
        id: string;
        product: ProductCardData;
      }[]
    >("/wishlist").then((res) => res.data),
  saveWishlist: (productId: string) =>
    request<unknown>("/wishlist", { method: "POST", body: JSON.stringify({ productId }) }).then(
      (res) => res.data,
    ),
  removeWishlist: (productId: string) =>
    request<unknown>(`/wishlist/${productId}`, { method: "DELETE" }).then((res) => res.data),
  subscribe: (email: string) =>
    request<unknown>("/newsletter", { method: "POST", body: JSON.stringify({ email }) }).then(
      (res) => res.data,
    ),
  forgotPassword: (email: string) =>
    request<unknown>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email }) }).then((res) => res.data),
  forgotAdminPassword: (email: string) =>
    request<unknown>("/auth/admin/forgot-password", { method: "POST", body: JSON.stringify({ email }) }).then((res) => res.data),
  resetPassword: (body: { email: string; code: string; password: string; confirmPassword: string }) =>
    request<unknown>("/auth/reset-password", { method: "POST", body: JSON.stringify(body) }).then((res) => res.data),
  updateMe: (body: Record<string, unknown>) =>
    request<User>("/users/me", { method: "PATCH", body: JSON.stringify(body) }).then((res) => res.data),
  uploadAvatar: async (image: File) => {
    const body = new FormData();
    body.append("data", JSON.stringify({}));
    body.append("image", await prepareImageForUpload(image));
    return request<User>("/users/me", { method: "PATCH", body }).then((res) => res.data);
  },
  user: (id: string) => request<User>(`/users/${id}`).then((res) => res.data),
  brands: () => request<Brand[]>("/brands?limit=100").then((res) => res.data),
  createBrand: (body: Record<string, unknown>) =>
    request<Brand>("/brands", { method: "POST", body: JSON.stringify(body) }).then((res) => res.data),
  sizes: (options: { fresh?: boolean } = {}) =>
    request<Size[]>("/catalog/sizes?limit=100", {}, options).then((res) => res.data),
  createSize: (body: Record<string, unknown>) =>
    request<Size>("/catalog/sizes", { method: "POST", body: JSON.stringify(body) }).then((res) => res.data),
  fabrics: (options: { fresh?: boolean } = {}) =>
    request<Fabric[]>("/catalog/fabrics?limit=100", {}, options).then((res) => res.data),
  createFabric: (body: Record<string, unknown>) =>
    request<Fabric>("/catalog/fabrics", { method: "POST", body: JSON.stringify(body) }).then((res) => res.data),
  coupons: () => request<Coupon[]>("/coupons?limit=100").then((res) => res.data),
  coupon: (id: string) => request<Coupon>(`/coupons/${id}`).then((res) => res.data),
  saveCoupon: (body: Record<string, unknown>, id?: string) =>
    request<Coupon>(id ? `/coupons/${id}` : "/coupons", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(body),
    }).then((res) => res.data),
  deleteCoupon: (id: string) => request<unknown>(`/coupons/${id}`, { method: "DELETE" }).then((res) => res.data),
  applyCoupon: (code: string, orderId?: string) =>
    request<CouponQuote>("/coupons/apply", {
      method: "POST",
      body: JSON.stringify(orderId ? { code, orderId } : { code }),
    }).then((res) => res.data),
  adminPromotions: () => request<Promotion[]>("/promotions?limit=100").then((res) => res.data),
  savePromotion: (body: Record<string, unknown>, id?: string) =>
    request<Promotion>(id ? `/promotions/${id}` : "/promotions", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(body),
    }).then((res) => res.data),
  deletePromotion: (id: string) =>
    request<unknown>(`/promotions/${id}`, { method: "DELETE" }).then((res) => res.data),
  saveOutlet: (body: Record<string, unknown>, id?: string) =>
    request<Outlet>(id ? `/outlets/${id}` : "/outlets", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(body),
    }).then((res) => res.data),
  outlet: (id: string) => request<Outlet>(`/outlets/${id}`).then((res) => res.data),
  adminOutlets: () => request<Outlet[]>("/outlets/manage").then((res) => res.data),
  deleteOutlet: (id: string) => request<unknown>(`/outlets/${id}`, { method: "DELETE" }).then((res) => res.data),
  managePages: () => request<CmsPage[]>("/pages/manage").then((res) => res.data),
  savePage: (slug: string, body: { title: string; body: string; isActive?: boolean }) =>
    request<CmsPage>(`/pages/${encodeURIComponent(slug)}`, { method: "PUT", body: JSON.stringify(body) }).then((res) => res.data),
  deletePage: (slug: string) =>
    request<unknown>(`/pages/${encodeURIComponent(slug)}`, { method: "DELETE" }).then((res) => res.data),
  zones: () => request<DeliveryZone[]>("/delivery-zones").then((res) => res.data),
  adminZones: () => request<DeliveryZone[]>("/delivery-zones/manage").then((res) => res.data),
  zone: (id: string) => request<DeliveryZone>(`/delivery-zones/${id}`).then((res) => res.data),
  saveZone: (body: Record<string, unknown>, id?: string) =>
    request<DeliveryZone>(id ? `/delivery-zones/${id}` : "/delivery-zones", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(body),
    }).then((res) => res.data),
  deleteZone: (id: string) =>
    request<unknown>(`/delivery-zones/${id}`, { method: "DELETE" }).then((res) => res.data),
  subscribers: () => request<Subscriber[]>("/newsletter").then((res) => res.data),
  deleteSubscriber: (id: string) =>
    request<unknown>(`/newsletter/${id}`, { method: "DELETE" }).then((res) => res.data),
  updateSettings: (body: Partial<Settings>) =>
    request<Settings>("/settings", { method: "PUT", body: JSON.stringify(body) }).then((res) => res.data),
  uploadCollageImage: async (slot: "man" | "woman" | "child" | "accessories", image: File) => {
    const body = new FormData();
    body.append("image", await prepareImageForUpload(image));
    return request<{ slot: typeof slot; imageUrl: string }>(`/settings/collage-images/${slot}`, {
      method: "POST",
      body,
    }).then((res) => res.data);
  },
  returns: () => request<StoreReturn[]>("/returns?limit=100").then((res) => res.data),
  returnOne: (id: string) => request<StoreReturn>(`/returns/${id}`).then((res) => res.data),
  createReturn: (body: Record<string, unknown>) =>
    request<StoreReturn>("/returns", { method: "POST", body: JSON.stringify(body) }).then((res) => res.data),
  reviewReturn: (id: string, body: { decision: "APPROVED" | "REJECTED"; adminNote?: string }) =>
    request<StoreReturn>(`/returns/${id}/review`, { method: "PATCH", body: JSON.stringify(body) }).then((res) => res.data),
  manualPayments: () => request<ManualPayment[]>("/payments/manual").then((res) => res.data),
  approvePayment: (id: string) =>
    request<ManualPayment>(`/payments/manual/${id}/approve`, { method: "POST" }).then((res) => res.data),
  rejectPayment: (id: string, reason: string) =>
    request<ManualPayment>(`/payments/manual/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }).then((res) => res.data),
  collectCash: (orderId: string) =>
    request<unknown>("/payments/cod/collect", { method: "POST", body: JSON.stringify({ orderId }) }).then((res) => res.data),
  createPaymentIntent: (orderId: string) =>
    request<{ clientSecret?: string | null }>("/payments/create-intent", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    }).then((res) => res.data),
  createCheckout: (orderId: string) =>
    request<{ url?: string | null }>("/payments/checkout", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    }).then((res) => res.data),
  adminSizeGuides: () => request<SizeGuide[]>("/size-guides/manage").then((res) => res.data),
  sizeGuide: (id: string) => request<SizeGuide>(`/size-guides/${id}`).then((res) => res.data),
  saveSizeGuide: (body: Record<string, unknown>, id?: string) =>
    request<SizeGuide>(id ? `/size-guides/${id}` : "/size-guides", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(body),
    }).then((res) => res.data),
  deleteSizeGuide: (id: string) =>
    request<unknown>(`/size-guides/${id}`, { method: "DELETE" }).then((res) => res.data),
  variants: (params: Record<string, string | number | boolean | undefined | null>) =>
    request<VariantRow[]>(`/variants${qs(params)}`).then((res) => res.data),
  variant: (id: string) => request<VariantRow>(`/variants/${id}`).then((res) => res.data),
  saveVariant: (body: Record<string, unknown>, id?: string) =>
    request<VariantRow>(id ? `/variants/${id}` : "/variants", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(body),
    }).then((res) => res.data),
  deleteVariant: (id: string) =>
    request<{ deactivated: boolean }>(`/variants/${id}`, { method: "DELETE" }).then((res) => ({
      deactivated: Boolean(res.data?.deactivated),
      message: res.message ?? "Variant deleted",
    })),
  deleteProduct: (id: string) =>
    request<{ archived: boolean }>(`/products/${id}`, { method: "DELETE" }).then((res) => ({
      archived: Boolean(res.data?.archived),
      message: res.message ?? "Product deleted",
    })),
};
