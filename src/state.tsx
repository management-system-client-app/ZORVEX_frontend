import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ApiError, api, DATA_REFRESH_INTERVAL, sessionStore } from "./api";
import type { Cart, CartLine, Catalog, Category, Settings, User } from "./types";

type AuthValue = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  completeSession: (token: string) => Promise<User>;
  register: (input: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    confirmPassword: string;
    phone?: string;
    image?: File;
  }) => Promise<User>;
  logout: () => Promise<void>;
  updateProfile: (input: { firstName?: string; lastName?: string; phone?: string | null; currentPassword?: string; newPassword?: string; confirmPassword?: string }) => Promise<User>;
  saveAvatar: (image: File) => Promise<User>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() =>
    sessionStore.token() ? sessionStore.userSnapshot() : null,
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = sessionStore.token();
    if (!token) {
      setReady(true);
      return;
    }
    api
      .me()
      .then((account) => {
        setUser(account);
        sessionStore.setUserSnapshot(account);
      })
      .catch((reason: unknown) => {
        if (reason instanceof ApiError && reason.status === 401) {
          sessionStore.setToken(null);
          setUser(null);
        } else {
          console.warn("Saved session could not be verified; keeping the current session", reason);
        }
      })
      .finally(() => setReady(true));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await api.login(email, password);
    sessionStore.setToken(result.token);
    sessionStore.setCartSession(null);
    setUser(result.user);
    sessionStore.setUserSnapshot(result.user);
    return result.user;
  }, []);

  const completeSession = useCallback(async (token: string) => {
    sessionStore.setToken(token);
    const next = await api.me();
    const userNext = {
      ...next,
      phone: next.phone ?? null,
      accountType: next.accountType === "ADMIN" ? ("ADMIN" as const) : ("USER" as const),
    };
    setUser(userNext);
    sessionStore.setUserSnapshot(userNext);
    return userNext;
  }, []);

  const register = useCallback(
    async (input: {
      firstName: string;
      lastName: string;
      email: string;
      password: string;
      confirmPassword: string;
      phone?: string;
      image?: File;
    }) => {
      const { image, ...account } = input;
      await api.register(account);
      const signedIn = await login(account.email, account.password);
      if (!image) return signedIn;
      const next = await api.uploadAvatar(image);
      const userNext = { ...next, phone: next.phone ?? null, accountType: "USER" as const };
      setUser(userNext);
      sessionStore.setUserSnapshot(userNext);
      return userNext;
    },
    [login],
  );

  const updateProfile = useCallback(async (input: { firstName?: string; lastName?: string; phone?: string | null; currentPassword?: string; newPassword?: string; confirmPassword?: string }) => {
    const next = await api.updateMe(input);
    const userNext = { ...next, phone: next.phone ?? null, accountType: user?.accountType ?? "USER" };
    setUser(userNext);
    sessionStore.setUserSnapshot(userNext);
    return userNext;
  }, [user?.accountType]);

  const saveAvatar = useCallback(async (image: File) => {
    const next = await api.uploadAvatar(image);
    const userNext = { ...next, phone: next.phone ?? null, accountType: user?.accountType ?? "USER" };
    setUser(userNext);
    sessionStore.setUserSnapshot(userNext);
    return userNext;
  }, [user?.accountType]);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      /* token may already be gone */
    }
    sessionStore.setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, login, register, logout, updateProfile, saveAvatar, completeSession }),
    [user, ready, login, register, logout, updateProfile, saveAvatar, completeSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider missing");
  return value;
}

type CartValue = {
  cart: Cart;
  loading: boolean;
  busy: boolean;
  drawer: boolean;
  setDrawer: (open: boolean) => void;
  refresh: () => Promise<void>;
  add: (variantId: string, quantity: number) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
  setQuantity: (line: CartLine, quantity: number) => Promise<void>;
};

const emptyCart: Cart = {
  id: null,
  sessionId: null,
  paymentMethod: null,
  items: [],
  summary: { itemCount: 0, subtotal: 0 },
};

const CartContext = createContext<CartValue | null>(null);

function keepSession(cart: Cart) {
  if (cart.sessionId) sessionStore.setCartSession(cart.sessionId);
  return cart;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const [cart, setCart] = useState<Cart>(emptyCart);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = keepSession(await api.cart());
      setCart(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    refresh().catch(() => setCart(emptyCart));
  }, [ready, user, refresh]);

  const add = useCallback(async (variantId: string, quantity: number) => {
    setBusy(true);
    try {
      setCart(keepSession(await api.addCartItem({ variantId, quantity })));
      setDrawer(true);
    } finally {
      setBusy(false);
    }
  }, []);

  const remove = useCallback(async (itemId: string) => {
    setBusy(true);
    try {
      setCart(keepSession(await api.removeCartItem(itemId)));
    } finally {
      setBusy(false);
    }
  }, []);

  const setQuantity = useCallback(async (line: CartLine, quantity: number) => {
    if (quantity === line.quantity) return;
    setBusy(true);
    try {
      if (quantity <= 0) {
        setCart(keepSession(await api.removeCartItem(line.id)));
        return;
      }
      if (quantity > line.quantity) {
        setCart(
          keepSession(
            await api.addCartItem({ variantId: line.variant.id, quantity: quantity - line.quantity }),
          ),
        );
        return;
      }
      await api.removeCartItem(line.id);
      setCart(keepSession(await api.addCartItem({ variantId: line.variant.id, quantity })));
    } finally {
      setBusy(false);
    }
  }, []);

  const value = useMemo(
    () => ({ cart, loading, busy, drawer, setDrawer, refresh, add, remove, setQuantity }),
    [cart, loading, busy, drawer, refresh, add, remove, setQuantity],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) throw new Error("CartProvider missing");
  return value;
}

type StoreValue = {
  settings: Settings;
  updateSettings: (settings: Settings) => void;
  settingsReady: boolean;
  catalog: Catalog;
  catalogReady: boolean;
  categoryImages: Map<string, string | null>;
  promo: string;
};

const StoreContext = createContext<StoreValue | null>(null);

const fallbackSettings: Settings = {
  storeName: "Store",
  supportEmail: null,
  supportPhone: null,
  address: null,
  facebookUrl: null,
  instagramUrl: null,
  bkashNumber: null,
  nagadNumber: null,
  rocketNumber: null,
  collageManImageUrl: null,
  collageWomanImageUrl: null,
  collageChildImageUrl: null,
  collageAccessoriesImageUrl: null,
};

const SETTINGS_CACHE_KEY = "store_settings";
const CATALOG_CACHE_KEY = "store_catalog";
const CATEGORIES_CACHE_KEY = "store_categories";
const PROMO_CACHE_KEY = "store_promo";

const fallbackCatalog: Catalog = {
  brands: [],
  categories: [],
  sizes: [],
  colors: [],
  fabrics: [],
};

function readStoreCache<T>(
  key: string,
  fallback: T,
  isValid: (value: unknown) => value is T,
): T {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return isValid(value) ? value : fallback;
  } catch (reason) {
    console.warn(`Cached store data (${key}) could not be read`, reason);
    return fallback;
  }
}

function writeStoreCache<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (reason) {
    console.warn(`Store data (${key}) could not be cached`, reason);
  }
}

function isNullableStringField(value: object, key: string) {
  if (!(key in value)) return false;
  const field = Reflect.get(value, key);
  return typeof field === "string" || field === null;
}

function isSettings(value: unknown): value is Settings {
  if (typeof value !== "object" || value === null || !("storeName" in value) || typeof value.storeName !== "string") {
    return false;
  }
  return [
    "supportEmail",
    "supportPhone",
    "address",
    "facebookUrl",
    "instagramUrl",
    "bkashNumber",
    "nagadNumber",
    "rocketNumber",
    "collageManImageUrl",
    "collageWomanImageUrl",
    "collageChildImageUrl",
    "collageAccessoriesImageUrl",
  ].every((key) => isNullableStringField(value, key));
}

function isCatalog(value: unknown): value is Catalog {
  return (
    typeof value === "object" &&
    value !== null &&
    "brands" in value &&
    Array.isArray(value.brands) &&
    "categories" in value &&
    Array.isArray(value.categories) &&
    "sizes" in value &&
    Array.isArray(value.sizes) &&
    "fabrics" in value &&
    Array.isArray(value.fabrics)
  );
}

function isCategoryList(value: unknown): value is Category[] {
  return (
    Array.isArray(value) &&
    value.every(
      (category) =>
        typeof category === "object" &&
        category !== null &&
        "id" in category &&
        typeof category.id === "string" &&
        "name" in category &&
        typeof category.name === "string" &&
        "slug" in category &&
        typeof category.slug === "string",
    )
  );
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() =>
    readStoreCache(SETTINGS_CACHE_KEY, fallbackSettings, isSettings),
  );
  const [settingsReady, setSettingsReady] = useState(() => Boolean(localStorage.getItem(SETTINGS_CACHE_KEY)));
  const [catalog, setCatalog] = useState<Catalog>(() =>
    readStoreCache(CATALOG_CACHE_KEY, fallbackCatalog, isCatalog),
  );
  const [catalogReady, setCatalogReady] = useState(() => Boolean(localStorage.getItem(CATALOG_CACHE_KEY)));
  const [categoryImages, setCategoryImages] = useState<Map<string, string | null>>(() =>
    new Map(
      readStoreCache(CATEGORIES_CACHE_KEY, [] as Category[], isCategoryList)
        .map((item) => [item.id, item.imageUrl ?? null]),
    ),
  );
  const [promo, setPromo] = useState(() =>
    readStoreCache(PROMO_CACHE_KEY, "New arrivals are in", (value): value is string => typeof value === "string"),
  );
  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    writeStoreCache(SETTINGS_CACHE_KEY, next);
  }, []);

  useEffect(() => {
    let active = true;
    let refreshing = false;

    const refresh = async (fresh = false) => {
      if (!active || refreshing || document.visibilityState !== "visible") return;
      refreshing = true;
      const results = await Promise.allSettled([
        api.settings(fresh),
        api.catalog(fresh),
        api.categories(fresh),
        api.promotions(fresh),
      ]);
      if (active) {
        const [settingsResult, catalogResult, categoriesResult, promotionsResult] = results;
        if (settingsResult.status === "fulfilled") {
          setSettings(settingsResult.value);
          writeStoreCache(SETTINGS_CACHE_KEY, settingsResult.value);
          document.title = settingsResult.value.storeName;
        } else {
          console.warn("Store settings could not be refreshed", settingsResult.reason);
        }
        if (catalogResult.status === "fulfilled") {
          setCatalog(catalogResult.value);
          writeStoreCache(CATALOG_CACHE_KEY, catalogResult.value);
        }
        else console.warn("Store catalog could not be refreshed", catalogResult.reason);
        if (categoriesResult.status === "fulfilled") {
          setCategoryImages(new Map(categoriesResult.value.map((item) => [item.id, item.imageUrl ?? null])));
          writeStoreCache(CATEGORIES_CACHE_KEY, categoriesResult.value);
        } else {
          console.warn("Store categories could not be refreshed", categoriesResult.reason);
        }
        if (promotionsResult.status === "fulfilled") {
          const first = promotionsResult.value[0];
          const nextPromo = first ? first.description || first.name : "New arrivals are in";
          setPromo(nextPromo);
          writeStoreCache(PROMO_CACHE_KEY, nextPromo);
        } else {
          console.warn("Store promotions could not be refreshed", promotionsResult.reason);
        }
        setSettingsReady(true);
        setCatalogReady(true);
      }
      refreshing = false;
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(true), DATA_REFRESH_INTERVAL);
    const refreshOnFocus = () => void refresh(true);
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, []);

  const value = useMemo(
    () => ({ settings, updateSettings, settingsReady, catalog, catalogReady, categoryImages, promo }),
    [settings, updateSettings, settingsReady, catalog, catalogReady, categoryImages, promo],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("StoreProvider missing");
  return value;
}

export function categoryImage(images: Map<string, string | null>, category: Category) {
  return images.get(category.id) ?? category.imageUrl ?? null;
}
