import { FormEvent, type ReactNode, useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet as RouterOutlet, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BadgeCheck, Bell, Clock3, Eye, EyeOff, Heart, ImagePlus, LayoutDashboard, LogOut, MapPin, PackageCheck, PackageOpen, ShieldCheck, ShoppingBag, Star, Ticket, Trash2, Truck, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ApiError, api, DATA_REFRESH_INTERVAL } from "../api";
import { UserFace } from "../components/Chrome";
import { ProductGrid } from "../components/ProductCard";
import { DetailSkeleton, ProductGridSkeleton, RowsSkeleton } from "../components/Skeleton";
import { money, titleCaseStatus } from "../format";
import { useAuth, useCart } from "../state";
import type { CmsPage, Coupon, Outlet, ProductCardData, TrackedOrder } from "../types";

const OAUTH_TOKEN_KEY = "oauth_token";

export function AuthCallbackPage() {
  const { completeSession } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const failed = params.get("error");
    if (failed) {
      setError(failed);
      return;
    }
    const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("token");
    if (fromHash) sessionStorage.setItem(OAUTH_TOKEN_KEY, fromHash);
    const token = fromHash || sessionStorage.getItem(OAUTH_TOKEN_KEY);
    if (!token) {
      setError("Login did not return a session");
      return;
    }
    window.history.replaceState(null, "", "/auth/callback");
    let active = true;
    completeSession(token)
      .then((account) => {
        sessionStorage.removeItem(OAUTH_TOKEN_KEY);
        if (!active) return;
        navigate(account.accountType === "ADMIN" ? "/admin" : "/", { replace: true });
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof ApiError ? reason.message : "Could not finish login");
      });
    return () => {
      active = false;
    };
  }, [completeSession, navigate]);

  return (
    <div className="auth">
      <h1 className="label">Login</h1>
      {error ? <p className="error">{error}</p> : <DetailSkeleton />}
      {error ? <p className="note"><Link to="/login">Back to login</Link></p> : null}
    </div>
  );
}

function StandaloneAuthLayout({ activeTab, children }: { activeTab: "login" | "register"; children: ReactNode }) {
  return (
    <main className="login-standalone">
      <div className="login-content">
        <Link className="login-back" to="/">
          <ArrowLeft size={14} strokeWidth={1.8} /> Back To Home
        </Link>
        <div className="login-brand-row" aria-label="Shopnex">
          <strong className="login-brand-resell">Shop<span>nex</span></strong>
          <span className="login-brand-tagline">SMART SHOPPING · BETTER VALUE</span>
        </div>
        <section className="login-card">
          <nav className="login-tabs" aria-label="Account access">
            <Link to="/login" className={`login-tab${activeTab === "login" ? " login-tab-active" : ""}`} aria-current={activeTab === "login" ? "page" : undefined}>Login</Link>
            <Link to="/register" className={`login-tab${activeTab === "register" ? " login-tab-active" : ""}`} aria-current={activeTab === "register" ? "page" : undefined}>Register</Link>
          </nav>
          <div className="login-divider" />
          {children}
        </section>
      </div>
    </main>
  );
}

function AuthSubmitButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <button className="login-submit" type="submit" disabled={loading} aria-busy={loading}>
      {loading ? <span className="auth-submit-spinner" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function AccountPageHeading({ icon: Icon, kicker, title, children }: { icon: LucideIcon; kicker: string; title: string; children?: ReactNode }) {
  return (
    <header className="account-page-heading">
      <div className="account-page-heading-copy">
        <span className="account-page-heading-icon"><Icon size={20} strokeWidth={1.8} /></span>
        <div><span className="account-page-kicker">{kicker}</span><h1>{title}</h1></div>
      </div>
      {children}
    </header>
  );
}

function AccountActionButton({ loading, children }: { loading: boolean; children: ReactNode }) {
  return (
    <button className="account-primary-action" type="submit" disabled={loading} aria-busy={loading}>
      {loading ? <span className="auth-submit-spinner" aria-hidden="true" /> : null}
      {children}
      {!loading ? <ArrowRight size={16} /> : null}
    </button>
  );
}

export function LoginPage() {
  const { user, ready, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const account = await login(email, password);
      navigate(account.accountType === "ADMIN" ? "/admin" : "/account");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;
  if (user) return <Navigate to={user.accountType === "ADMIN" ? "/admin" : "/"} replace />;

  return (
    <StandaloneAuthLayout activeTab="login">
      <form className="login-form" onSubmit={onSubmit}>
          <label className="login-field">
            <span>E-mail / Phone Number <b>*</b></span>
            <input type="text" autoComplete="username" placeholder="Enter Your E-mail address / Phone number" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="login-field">
            <span>Password <b>*</b></span>
            <span className="login-password-control">
              <input type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter Your Password" required value={password} onChange={(event) => setPassword(event.target.value)} />
              <button
                type="button"
                className="login-password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
              </button>
            </span>
          </label>
          <div className="login-forgot-row"><Link to="/forgot-password">Forgot Password?</Link></div>
          {error ? <p className="login-error" role="alert">{error}</p> : null}
          <AuthSubmitButton loading={loading}>Login</AuthSubmitButton>
      </form>
    </StandaloneAuthLayout>
  );
}

export function ForgotPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.forgotPassword(email);
      try {
        await api.forgotAdminPassword(email);
      } catch {
        /* the customer email was already sent */
      }
      setStep("code");
      setNote("Check your email and enter the 6-digit code.");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not send the code");
    } finally {
      setLoading(false);
    }
  }

  function confirmCode(event: FormEvent) {
    event.preventDefault();
    setError("");
    setStep("password");
    setNote("Choose a new password. Your code will be checked when you save it.");
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.resetPassword({ email, code, password, confirmPassword });
      navigate("/login");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not change the password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <StandaloneAuthLayout activeTab="login">
      <form className="login-form" onSubmit={step === "email" ? sendCode : step === "code" ? confirmCode : changePassword}>
        <h1 className="login-flow-title">Forgot Password</h1>
        <label className="login-field">
          <span>E-mail <b>*</b></span>
          <input type="email" placeholder="Enter Your E-mail address" required value={email} readOnly={step !== "email"} onChange={(event) => setEmail(event.target.value)} />
        </label>
        {step !== "email" ? (
          <label className="login-field">
            <span>Code from email <b>*</b></span>
            <input placeholder="Enter the 6-digit code" required inputMode="numeric" minLength={6} maxLength={6} value={code} readOnly={step === "password"} onChange={(event) => setCode(event.target.value)} />
          </label>
        ) : null}
        {step === "password" ? (
          <>
            <label className="login-field">
              <span>New password <b>*</b></span>
              <input type="password" placeholder="Enter New Password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            <label className="login-field">
              <span>Confirm password <b>*</b></span>
              <input type="password" placeholder="Confirm New Password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
            </label>
          </>
        ) : null}
        {error ? <p className="login-error" role="alert">{error}</p> : null}
        {note ? <p className="login-note">{note}</p> : null}
        <AuthSubmitButton loading={loading}>{step === "email" ? "Send Code" : step === "code" ? "Continue" : "Change Password"}</AuthSubmitButton>
      </form>
    </StandaloneAuthLayout>
  );
}

export function ResetPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ email: params.get("email") ?? "", code: "", password: "", confirmPassword: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.resetPassword(form);
      navigate("/login");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not reset the password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <StandaloneAuthLayout activeTab="login">
      <form className="login-form" onSubmit={onSubmit}>
        <h1 className="login-flow-title">Reset Password</h1>
        <label className="login-field"><span>E-mail <b>*</b></span><input type="email" placeholder="Enter Your E-mail address" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label className="login-field"><span>Code <b>*</b></span><input placeholder="Enter the 6-digit code" required minLength={6} maxLength={6} value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
        <label className="login-field"><span>New password <b>*</b></span><input type="password" placeholder="Enter New Password" required minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        <label className="login-field"><span>Confirm password <b>*</b></span><input type="password" placeholder="Confirm New Password" required value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label>
        {error ? <p className="login-error" role="alert">{error}</p> : null}
        <AuthSubmitButton loading={loading}>Reset Password</AuthSubmitButton>
      </form>
    </StandaloneAuthLayout>
  );
}

export function RegisterPage() {
  const { user, ready, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({
        ...form,
        phone: form.phone || undefined,
        image: photo ?? undefined,
      });
      navigate("/account");
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not register");
    } finally {
      setLoading(false);
    }
  }

  if (!ready) return null;
  if (user) return <Navigate to="/" replace />;

  return (
    <StandaloneAuthLayout activeTab="register">
      <form className="login-form register-form" onSubmit={onSubmit}>
        <div className="register-photo-row">
          <div className="register-avatar-preview">
            {preview ? <img src={preview} alt="Profile preview" /> : <UserRound size={30} strokeWidth={1.6} />}
          </div>
          <label className="register-photo-picker">
            <ImagePlus size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>{photo ? photo.name : "Choose a profile photo"}</span>
            <input
              type="file"
              accept="image/avif,image/jpeg,image/png,image/webp"
              aria-label="Choose a profile photo"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setPhoto(file);
                setPreview((current) => {
                  if (current) URL.revokeObjectURL(current);
                  return file ? URL.createObjectURL(file) : "";
                });
              }}
            />
          </label>
        </div>
        <div className="register-name-grid">
          <label className="login-field"><span>First name <b>*</b></span><input autoComplete="given-name" placeholder="Enter your first name" required value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} /></label>
          <label className="login-field"><span>Last name <b>*</b></span><input autoComplete="family-name" placeholder="Enter your last name" required value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} /></label>
        </div>
        <label className="login-field"><span>Email <b>*</b></span><input type="email" autoComplete="email" placeholder="Enter your email address" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label className="login-field"><span>Phone</span><input type="tel" autoComplete="tel" placeholder="Enter your phone number" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
        <label className="login-field"><span>Password <b>*</b></span><input type="password" autoComplete="new-password" placeholder="Create a password (8+ characters)" required minLength={8} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        <label className="login-field"><span>Confirm password <b>*</b></span><input type="password" autoComplete="new-password" placeholder="Confirm your password" required value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label>
        {error ? <p className="login-error" role="alert">{error}</p> : null}
        <AuthSubmitButton loading={loading}>Create Account</AuthSubmitButton>
        <p className="login-note">Already have an account? <Link to="/login">Sign in</Link></p>
      </form>
    </StandaloneAuthLayout>
  );
}

export function WishlistPage() {
  const { user, ready } = useAuth();
  const [products, setProducts] = useState<ProductCardData[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setLoading(false);
      return;
    }
    api
      .wishlist()
      .then((items) => setProducts(items.map((item) => item.product)))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load wishlist"))
      .finally(() => setLoading(false));
  }, [ready, user]);

  if (!ready) return <ProductGridSkeleton />;
  if (!user) return <Navigate to="/login" replace />;
  if (loading) return <ProductGridSkeleton />;

  return (
    <section className="account-page wishlist-page">
      <AccountPageHeading icon={Heart} kicker="SAVED FOR LATER" title="Wishlist">
        {products.length > 0 ? <span className="account-count-badge">{products.length} items</span> : null}
      </AccountPageHeading>
      {products.length > 0 ? (
        <div className="wishlist-intro">
          <span><Heart size={16} /> Your personal collection</span>
          <p>All the pieces you have saved, together in one place.</p>
        </div>
      ) : null}
      {error ? <p className="error">{error}</p> : null}
      {!error && products.length === 0 ? (
        <div className="account-surface customer-empty-state wishlist-empty">
          <span><Heart size={25} /></span>
          <h2>Your wishlist is empty</h2>
          <p>Save the pieces you love and find them here later.</p>
          <Link className="account-primary-action" to="/shop">Browse products <ArrowRight size={16} /></Link>
        </div>
      ) : null}
      {products.length > 0 ? <div className="wishlist-product-grid"><ProductGrid products={products} /></div> : null}
    </section>
  );
}

export function TrackPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setOrder(null);
    setLoading(true);
    try {
      setOrder(await api.track(orderNumber, phone));
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Order not found");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="tracking-card">
      <div className="tracking-page">
        <header className="tracking-heading">
          <div>
            <span className="tracking-kicker">ORDER SUPPORT</span>
            <h1 className="tracking-title">Track your order</h1>
            <p className="tracking-description">Enter the order number and contact details used at checkout.</p>
          </div>
          <span className="tracking-mark"><PackageOpen size={25} /></span>
        </header>
        <form onSubmit={onSubmit} className="tracking-form">
          <label className="field tracking-field">
            <span>Order No <b className="tracking-required">*</b></span>
            <input required placeholder="Enter Your Order No" value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)} />
          </label>
          <label className="field tracking-field">
            <span>Email/Mobile Number <b className="tracking-required">*</b></span>
            <input required minLength={7} placeholder="Enter Your Email/Mobile Number" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <button className="btn tracking-submit" type="submit" disabled={loading}>
            {loading ? "Checking order..." : "Track order"} <ArrowRight size={17} />
          </button>
          {error ? <p className="error tracking-error">{error}</p> : null}
        </form>
        {loading ? <RowsSkeleton rows={3} /> : null}
        {order ? (
          <section className="tracking-result" aria-label="Order details">
            <header className="tracking-result-heading">
              <div><span className="tracking-kicker">ORDER DETAILS</span><h2>{order.orderNumber}</h2></div>
              <span className="tracking-status">{titleCaseStatus(order.status)}</span>
            </header>
            <div className="tracking-items">
              {order.items.map((item) => (
                <article className="tracking-item" key={item.sku + item.productName}>
                  {item.imageUrl ? <img className="tracking-item-image" src={item.imageUrl} alt="" /> : <div className="tracking-item-image photo-fallback" />}
                  <div className="tracking-item-copy">
                    <h3>{item.productName}</h3>
                    <p>{item.size} {item.color} <span>·</span> Qty {item.quantity}</p>
                  </div>
                </article>
              ))}
            </div>
            <footer className="tracking-result-total"><span>Order total</span><strong>{money(order.total)}</strong></footer>
          </section>
        ) : null}
      </div>
    </section>
  );
}

export function OutletsPage() {
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let refreshing = false;
    let initialLoad = true;
    const loadOutlets = async (fresh = false) => {
      if (!active || refreshing) return;
      refreshing = true;
      try {
        const result = await api.outlets(fresh);
        if (active) {
          setOutlets(result);
          setError("");
        }
      } catch (reason: unknown) {
        if (active && initialLoad) {
          setError(reason instanceof Error ? reason.message : "Could not load outlets");
        } else if (active) {
          console.warn("Outlets could not be refreshed", reason);
        }
      } finally {
        if (active && initialLoad) {
          initialLoad = false;
          setLoading(false);
        }
        refreshing = false;
      }
    };
    void loadOutlets();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadOutlets(true);
    }, DATA_REFRESH_INTERVAL);
    const refreshOnFocus = () => void loadOutlets(true);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, []);

  return (
    <div>
      <h1 className="label">Outlets</h1>
      {error ? <p className="error">{error}</p> : null}
      {loading ? <RowsSkeleton rows={4} /> : null}
      {!loading && !error && outlets.length === 0 ? <p className="note">No outlets available.</p> : null}
      {!loading && outlets.map((outlet) => (
        <article key={outlet.id} className="outlet">
          <h2>{outlet.name}</h2>
          <p>
            {outlet.address}, {outlet.city}
          </p>
          <p>{outlet.phone}</p>
          {outlet.hours ? <p className="note">{outlet.hours}</p> : null}
          {outlet.mapUrl ? (
            <a href={outlet.mapUrl} target="_blank" rel="noreferrer">
              Map
            </a>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function CmsPageView() {
  const { slug = "" } = useParams();
  const [page, setPage] = useState<CmsPage | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let refreshing = false;
    let initialLoad = true;
    setPage(null);
    setError("");
    setLoading(true);
    const loadPage = async (fresh = false) => {
      if (!active || refreshing) return;
      refreshing = true;
      try {
        const result = await api.page(slug, fresh);
        if (active) {
          setPage(result);
          setError("");
        }
      } catch (reason: unknown) {
        if (active && initialLoad) {
          setError(reason instanceof Error ? reason.message : "Page not found");
        } else if (active) {
          console.warn("Content page could not be refreshed", reason);
        }
      } finally {
        if (active && initialLoad) {
          initialLoad = false;
          setLoading(false);
        }
        refreshing = false;
      }
    };
    void loadPage();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadPage(true);
    }, DATA_REFRESH_INTERVAL);
    const refreshOnFocus = () => void loadPage(true);
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [slug]);

  if (error) return <p className="empty">{error}</p>;
  if (loading || !page) return <DetailSkeleton />;
  return (
    <article className="cms">
      <h1>{page.title}</h1>
      <div className="body">{page.body}</div>
    </article>
  );
}

export function ChangePasswordPage() {
  const { updateProfile } = useAuth();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setNote("");
    setSaving(true);
    try {
      await updateProfile(form);
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setNote("Password changed");
    } catch (reason) {
      setNote(reason instanceof Error ? reason.message : "Could not change the password");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="account-page">
      <AccountPageHeading icon={ShieldCheck} kicker="KEEP YOUR ACCOUNT SAFE" title="Change Password" />
      <form className="account-surface account-password-form" onSubmit={onSubmit}>
        <div className="account-password-intro">
          <span><ShieldCheck size={21} /></span>
          <div><strong>Update your password</strong><small>Use at least 8 characters for a stronger password.</small></div>
          <span className="account-security-status"><ShieldCheck size={15} />Secure account</span>
        </div>
        <div className="account-password-fields">
          <label className="field"><span>Current password</span><input type="password" required autoComplete="current-password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} /></label>
          <label className="field"><span>New password</span><input type="password" required minLength={8} autoComplete="new-password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} /></label>
          <label className="field"><span>Confirm new password</span><input type="password" required autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label>
        </div>
        <footer className="account-form-footer">
          {note ? <p className="account-form-note" role="status">{note}</p> : <span />}
          <AccountActionButton loading={saving}>Update password</AccountActionButton>
        </footer>
      </form>
    </section>
  );
}

export function AccountLayout() {
  const { user, ready, logout } = useAuth();
  const navigate = useNavigate();
  if (!ready) {
    return (
      <div className="account-shell account-shell-loading" role="status" aria-label="Loading account">
        <aside className="account-side">
          <div className="account-loading-user" />
          <div className="account-loading-links">
            {Array.from({ length: 6 }, (_, index) => <div key={index} />)}
          </div>
        </aside>
        <div className="account-panel account-loading-panel">
          <div />
          <div />
          <div />
          <div />
        </div>
      </div>
    );
  }
  if (!user) return <LoginPage />;
  if (user.accountType === "ADMIN") return <Navigate to="/admin" replace />;

  const accountNav = [
    { label: "Dashboard", to: "/account", icon: LayoutDashboard, end: true },
    { label: "My Profile", to: "/account/profile", icon: UserRound },
    { label: "My Orders", to: "/account/orders", icon: PackageOpen },
    { label: "Wishlist", to: "/account/wishlist", icon: Heart },
    { label: "Coupon", to: "/account/coupons", icon: Ticket },
    { label: "Review", to: "/account/reviews", icon: Star },
    { label: "Address Book", to: "/account/address", icon: MapPin },
    { label: "Notification", to: "/account/notifications", icon: Bell },
  ];

  return (
    <div className="account-shell customer-account-shell">
      <aside className="account-side customer-account-side">
        <div className="account-who">
          <UserFace user={user} size={48} />
          <div className="account-who-copy">
            <strong>{user.firstName} {user.lastName}</strong>
            <p>{user.phone || user.email}</p>
          </div>
        </div>
        <nav className="account-side-nav" aria-label="My account">
          {accountNav.map(({ label, to, icon: Icon, end = false }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? "on" : "")}>
              <Icon size={18} strokeWidth={1.9} />
              <span>{label}</span>
            </NavLink>
          ))}
          <NavLink to="/account/returns" className={({ isActive }) => (isActive ? "on" : "")}>
            <ArrowRight size={18} strokeWidth={1.9} />
            <span>Returns</span>
          </NavLink>
          <NavLink to="/account/password" className={({ isActive }) => (isActive ? "on" : "")}>
            <ShieldCheck size={18} strokeWidth={1.9} />
            <span>Change password</span>
          </NavLink>
        </nav>
        <div className="account-side-footer">
          <button type="button" onClick={() => { logout().then(() => navigate("/")); }}>
            <LogOut size={17} /> Logout
          </button>
        </div>
      </aside>
      <main className="account-panel customer-account-panel">
        <RouterOutlet />
      </main>
    </div>
  );
}

type CustomerOrder = Awaited<ReturnType<typeof api.orders>>[number];

export function AccountDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [couponCount, setCouponCount] = useState(0);
  const [hasAddress, setHasAddress] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([
      api.orders().catch(() => []),
      api.wishlist().catch(() => []),
      api.coupons().catch(() => []),
      api.defaultAddress().catch(() => null),
    ]).then(([nextOrders, wishlist, coupons, address]) => {
      if (!active) return;
      setOrders(nextOrders);
      setWishlistCount(wishlist.length);
      setCouponCount(coupons.filter((coupon) => coupon.isActive).length);
      setHasAddress(Boolean(address));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const normalizeStatus = (status: string) => status.toUpperCase().replace(/[\s-]+/g, "_");
  const statusTiles = [
    { label: "Processing", icon: Clock3, statuses: ["PENDING", "CONFIRMED", "PROCESSING"], tone: "violet" },
    { label: "Ready to ship", icon: PackageCheck, statuses: ["READY_TO_SHIP", "PACKED"], tone: "teal" },
    { label: "Shipped", icon: Truck, statuses: ["SHIPPED", "IN_TRANSIT"], tone: "blue" },
    { label: "Delivered", icon: BadgeCheck, statuses: ["DELIVERED", "COMPLETED"], tone: "green" },
  ];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="customer-dashboard">
      <header className="customer-dashboard-welcome">
        <div className="customer-dashboard-intro">
          <span className="customer-dashboard-mark"><LayoutDashboard size={21} strokeWidth={1.8} /></span>
          <div>
          <span className="customer-eyebrow">ACCOUNT OVERVIEW</span>
          <h1>{greeting}, <strong>{user?.firstName}!</strong></h1>
          </div>
        </div>
        <Link className="account-text-link" to="/account/orders">All orders <ArrowRight size={16} /></Link>
      </header>

      <div className="customer-dashboard-top">
        <div className="customer-dashboard-left">
          <section className="customer-orders-overview">
            <header className="customer-section-heading">
              <div><span className="customer-eyebrow">YOUR ACTIVITY</span><h2>My Orders</h2></div>
              <Link to="/account/orders" aria-label="See all orders"><ArrowRight size={18} /></Link>
            </header>
            <div className="customer-status-grid">
              {statusTiles.map(({ label, icon: Icon, statuses, tone }) => {
                const count = orders.filter((order) => statuses.includes(normalizeStatus(order.status))).length;
                return (
                  <Link className="customer-status-tile" to="/account/orders" key={label}>
                    <span className={`customer-status-icon ${tone}`}><Icon size={19} /></span>
                    <strong>{loading ? "–" : count}</strong>
                    <small>{label}</small>
                  </Link>
                );
              })}
            </div>
          </section>

          <div className="customer-shortcuts">
            <Link to="/track" className="customer-shortcut">
              <span className="customer-shortcut-icon teal"><Truck size={20} /></span>
              <span><strong>Order Tracking</strong><small>Follow a delivery</small></span>
              <ArrowRight size={16} />
            </Link>
            <Link to="/account/address" className="customer-shortcut">
              <span className="customer-shortcut-icon blue"><MapPin size={20} /></span>
              <span><strong>Address Book</strong><small>{hasAddress ? "Manage your address" : "Add a delivery address"}</small></span>
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="customer-feature-grid">
          <Link to="/account/orders" className="customer-feature-tile orders">
            <span className="customer-feature-art"><PackageOpen size={34} /></span>
            <strong>My Orders</strong>
            <small>All of your orders in one place</small>
            <span className="customer-feature-count">{loading ? "–" : orders.length}</span>
          </Link>
          <Link to="/account/wishlist" className="customer-feature-tile wishlist">
            <span className="customer-feature-art"><Heart size={34} /></span>
            <strong>Wishlist</strong>
            <small>Save the pieces you love</small>
            <span className="customer-feature-count">{loading ? "–" : wishlistCount}</span>
          </Link>
          <Link to="/account/coupons" className="customer-feature-tile coupons">
            <span className="customer-feature-art"><Ticket size={34} /></span>
            <strong>Coupon</strong>
            <small>Offers for your next order</small>
            <span className="customer-feature-count">{loading ? "–" : couponCount}</span>
          </Link>
        </div>
      </div>

      <section className="customer-recent-orders">
        <header className="customer-section-heading">
          <div><span className="customer-eyebrow">YOUR PURCHASES</span><h2>Recent Orders</h2></div>
          {orders.length > 0 ? <Link className="account-text-link" to="/account/orders">See all <ArrowRight size={16} /></Link> : null}
        </header>
        {loading ? <RowsSkeleton rows={2} /> : orders.length === 0 ? (
          <div className="customer-empty-state compact">
            <span><PackageOpen size={22} /></span>
            <div><strong>No orders yet</strong><p>Your next favorite is waiting in the shop.</p></div>
            <Link className="account-primary-action" to="/shop">Explore the shop <ArrowRight size={15} /></Link>
          </div>
        ) : (
          <div className="customer-recent-list">
            {orders.slice(0, 4).map((order) => (
              <article className="customer-recent-row" key={order.id}>
                <span className="customer-recent-icon"><ShoppingBag size={18} /></span>
                <span className="customer-recent-order"><strong>{order.orderNumber}</strong><small>{new Date(order.placedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</small></span>
                <span className="customer-order-status">{titleCaseStatus(order.status)}</span>
                <strong className="customer-recent-total">{money(order.total)}</strong>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function AccountProfile() {
  const { user, updateProfile, saveAvatar } = useAuth();
  const [profile, setProfile] = useState({ firstName: "", lastName: "", phone: "" });
  const [profileNote, setProfileNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setProfile({ firstName: user.firstName, lastName: user.lastName, phone: user.phone ?? "" });
  }, [user]);

  if (!user) return null;

  return (
    <section className="account-page account-profile-page">
      <AccountPageHeading icon={UserRound} kicker="YOUR DETAILS" title="My Account">
        <button type="button" className="account-secondary-action" onClick={() => { setEditing((current) => !current); setProfileNote(""); }}>
          {editing ? "Cancel edit" : "Edit Profile"}
        </button>
      </AccountPageHeading>
      <div className="account-profile-grid">
        <section className="account-surface account-profile-main">
          <header className="account-surface-heading"><h2>Profile Information</h2></header>
          <div className="account-profile-content">
            <div className="account-profile-photo">
              <UserFace user={user} size={92} />
              {editing && user.accountType === "USER" ? (
                <label className="account-photo-upload">
                  <ImagePlus size={16} /> Upload Photo
                  <input
                    type="file"
                    accept="image/avif,image/jpeg,image/png,image/webp"
                    aria-label="Upload profile photo"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setProfileNote("");
                      saveAvatar(file).then(() => setProfileNote("Photo saved")).catch((reason: unknown) => setProfileNote(reason instanceof Error ? reason.message : "Could not save the photo"));
                    }}
                  />
                </label>
              ) : null}
            </div>
            {editing ? (
              <form className="account-profile-form" onSubmit={async (event) => {
                event.preventDefault();
                setProfileNote("");
                setSaving(true);
                try {
                  await updateProfile({ firstName: profile.firstName, lastName: profile.lastName, phone: profile.phone || null });
                  setEditing(false);
                  setProfileNote("Profile updated");
                } catch (reason) {
                  setProfileNote(reason instanceof Error ? reason.message : "Could not save profile");
                } finally {
                  setSaving(false);
                }
              }}>
                <div className="account-field-grid">
                  <label className="field"><span>First name</span><input required value={profile.firstName} onChange={(event) => setProfile({ ...profile, firstName: event.target.value })} /></label>
                  <label className="field"><span>Last name</span><input required value={profile.lastName} onChange={(event) => setProfile({ ...profile, lastName: event.target.value })} /></label>
                  <label className="field"><span>Mobile number</span><input type="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label>
                  <label className="field"><span>Email</span><input value={user.email} readOnly /></label>
                </div>
                <AccountActionButton loading={saving}>Save changes</AccountActionButton>
                {profileNote ? <p className="account-form-note" role="status">{profileNote}</p> : null}
              </form>
            ) : (
              <dl className="account-profile-details">
                <div><dt><UserRound size={15} />Full Name</dt><dd>{user.firstName} {user.lastName}</dd></div>
                <div><dt><MapPin size={15} />Contact Number</dt><dd>{user.phone || "Not added"}</dd></div>
                <div><dt><Bell size={15} />Email</dt><dd>{user.email}</dd></div>
              </dl>
            )}
          </div>
          {!editing && profileNote ? <p className="account-form-note" role="status">{profileNote}</p> : null}
        </section>
        <aside className="account-surface account-security-card">
          <span className="account-security-icon"><ShieldCheck size={21} /></span>
          <h2>Account Security</h2>
          <p>Keep your account secure with a strong password.</p>
          <Link to="/account/password">Change password <ArrowRight size={15} /></Link>
        </aside>
      </div>
    </section>
  );
}

export function DeliveryAddressPage() {
  const [address, setAddress] = useState({
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "Bangladesh",
  });
  const [addressNote, setAddressNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const hasAddress = Boolean(address.line1);

  useEffect(() => {
    let active = true;
    api.defaultAddress().then((saved) => {
      if (!active || !saved) return;
      setAddress({
        fullName: saved.fullName,
        phone: saved.phone,
        line1: saved.line1,
        line2: saved.line2 ?? "",
        city: saved.city,
        state: saved.state ?? "",
        postalCode: saved.postalCode,
        country: saved.country,
      });
    }).catch(() => undefined).finally(() => {
      if (active) setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setAddressNote("");
    setSaving(true);
    try {
      const saved = await api.saveDefaultAddress({
        ...address,
        line2: address.line2 || null,
        state: address.state || null,
      });
      setAddress({
        fullName: saved.fullName,
        phone: saved.phone,
        line1: saved.line1,
        line2: saved.line2 ?? "",
        city: saved.city,
        state: saved.state ?? "",
        postalCode: saved.postalCode,
        country: saved.country,
      });
      setAddressNote("Default address saved. It will be used at checkout.");
    } catch (reason) {
      setAddressNote(reason instanceof Error ? reason.message : "Could not save address");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="account-page">
      <AccountPageHeading icon={MapPin} kicker="DELIVERY DETAILS" title="Shipping Address">
        <span className={`account-default-badge${hasAddress ? " is-saved" : ""}`}><MapPin size={15} />{hasAddress ? "Default address" : "Address book"}</span>
      </AccountPageHeading>
      {loading ? <DetailSkeleton /> : (
      <form
        className="account-surface account-address-form"
        onSubmit={onSubmit}
      >
        <div className="account-address-intro">
          <span><MapPin size={19} /></span>
          <div><strong>Where should we deliver?</strong><small>Save a default address to make checkout quicker.</small></div>
        </div>
        <div className="account-field-grid">
          <label className="field"><span>Recipient name</span><input required value={address.fullName} onChange={(event) => setAddress({ ...address, fullName: event.target.value })} /></label>
          <label className="field"><span>Contact number</span><input required minLength={7} value={address.phone} onChange={(event) => setAddress({ ...address, phone: event.target.value })} /></label>
          <label className="field"><span>Country</span><input required value={address.country} onChange={(event) => setAddress({ ...address, country: event.target.value })} /></label>
          <label className="field"><span>District / City</span><input required minLength={2} value={address.city} onChange={(event) => setAddress({ ...address, city: event.target.value })} /></label>
          <label className="field"><span>Area / State</span><input value={address.state} onChange={(event) => setAddress({ ...address, state: event.target.value })} /></label>
          <label className="field"><span>Post code</span><input required value={address.postalCode} onChange={(event) => setAddress({ ...address, postalCode: event.target.value })} /></label>
          <label className="field account-field-wide"><span>Address</span><input required value={address.line1} onChange={(event) => setAddress({ ...address, line1: event.target.value })} /></label>
          <label className="field account-field-wide"><span>Address line 2</span><input value={address.line2} onChange={(event) => setAddress({ ...address, line2: event.target.value })} /></label>
        </div>
        <div className="account-address-footer">
          <p className="account-form-note" role="status">{addressNote || "Your saved address will be ready at checkout."}</p>
          <AccountActionButton loading={saving}>Save address</AccountActionButton>
        </div>
      </form>
      )}
    </section>
  );
}

export function AccountOrders() {
  const [orders, setOrders] = useState<
    { id: string; orderNumber: string; status: string; total: string | number; placedAt: string; items?: { id: string; productName: string; quantity: number; lineTotal?: string | number }[] }[]
  >([]);
  const [ordersError, setOrdersError] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    api.orders().then(setOrders).catch((reason: unknown) => {
      setOrders([]);
      setOrdersError(reason instanceof Error ? reason.message : "Could not load orders");
    }).finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    function onShow() {
      if (document.visibilityState === "visible") load();
    }
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 15000);
    document.addEventListener("visibilitychange", onShow);
    return () => {
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, []);

  return (
    <section className="account-page">
      <AccountPageHeading icon={PackageOpen} kicker="ORDER HISTORY" title="My Orders">
        <Link className="account-secondary-action" to="/track">Track an order</Link>
      </AccountPageHeading>
      {ordersError ? <p className="error">{ordersError}</p> : null}
      {loading ? <RowsSkeleton rows={4} /> : null}
      {!loading && orders.length === 0 && !ordersError ? (
        <div className="account-surface customer-empty-state">
          <span><PackageOpen size={27} /></span>
          <h2>No orders yet</h2>
          <p>Once you place an order, you can follow its progress here.</p>
          <Link className="account-primary-action" to="/shop">Explore the shop <ArrowRight size={16} /></Link>
        </div>
      ) : null}
      <div className="order-list account-order-list">
        {orders.map((order) => (
          <article className="account-surface account-order-card" key={order.id}>
            <header><div><span className="account-page-kicker">ORDER NUMBER</span><strong>{order.orderNumber}</strong></div><span className="account-order-status">{titleCaseStatus(order.status)}</span></header>
            <p className="account-order-date">Placed {new Date(order.placedAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}</p>
            {(order.items ?? []).map((item) => (
              <div className="account-order-item" key={item.id}><span>{item.productName} <small>× {item.quantity}</small></span><strong>{item.lineTotal != null ? money(item.lineTotal) : ""}</strong></div>
            ))}
            <footer><span>Total</span><strong>{money(order.total)}</strong></footer>
          </article>
        ))}
      </div>
    </section>
  );
}

export function AccountCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"available" | "special">("available");

  useEffect(() => {
    let active = true;
    api.coupons().then((items) => {
      if (active) setCoupons(items);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not load coupons");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const now = Date.now();
  const availableCoupons = coupons.filter((coupon) => coupon.isActive && new Date(coupon.startsAt).getTime() <= now && new Date(coupon.endsAt).getTime() >= now);

  return (
    <section className="account-page">
      <AccountPageHeading icon={Ticket} kicker="SAVINGS FOR YOU" title="Coupon" />
      <div className="account-tabs" role="tablist" aria-label="Coupons">
        <button type="button" className={activeTab === "available" ? "on" : ""} role="tab" aria-selected={activeTab === "available"} onClick={() => setActiveTab("available")}>All Vouchers</button>
        <button type="button" className={activeTab === "special" ? "on" : ""} role="tab" aria-selected={activeTab === "special"} onClick={() => setActiveTab("special")}>My Special Vouchers</button>
      </div>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {loading ? <RowsSkeleton rows={3} /> : activeTab === "special" || availableCoupons.length === 0 ? (
        <div className="account-surface customer-empty-state">
          <span><Ticket size={25} /></span>
          <h2>{activeTab === "special" ? "No special vouchers yet" : "No coupons available"}</h2>
          <p>Available offers will appear here when there’s something for your next order.</p>
        </div>
      ) : (
        <div className="account-coupon-grid">
          {availableCoupons.map((coupon) => {
            const percentage = coupon.type.toUpperCase().includes("PERCENT");
            return (
              <article className="account-surface account-coupon-card" key={coupon.id}>
                <span className="account-coupon-icon"><Ticket size={20} /></span>
                <div><span className="account-page-kicker">YOUR VOUCHER</span><strong>{percentage ? `${coupon.value}% OFF` : `${money(coupon.value)} OFF`}</strong></div>
                <code>{coupon.code}</code>
                <small>Valid until {new Date(coupon.endsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</small>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function AccountReviews() {
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  return (
    <section className="account-page">
      <AccountPageHeading icon={Star} kicker="YOUR FEEDBACK" title="Reviews" />
      <div className="account-tabs" role="tablist" aria-label="Reviews">
        <button type="button" className={activeTab === "pending" ? "on" : ""} role="tab" aria-selected={activeTab === "pending"} onClick={() => setActiveTab("pending")}>To Review</button>
        <button type="button" className={activeTab === "history" ? "on" : ""} role="tab" aria-selected={activeTab === "history"} onClick={() => setActiveTab("history")}>Review History</button>
      </div>
      <div className="account-surface customer-empty-state">
        <span><Star size={25} /></span>
        <h2>{activeTab === "pending" ? "No pending reviews" : "No reviews yet"}</h2>
        <p>{activeTab === "pending" ? "Delivered items that are ready for a review will appear here." : "Reviews you share about your purchases will appear here."}</p>
      </div>
    </section>
  );
}

export function AccountNotifications() {
  return (
    <section className="account-page">
      <AccountPageHeading icon={Bell} kicker="UPDATES" title="Notification" />
      <div className="account-surface customer-empty-state">
        <span><Bell size={25} /></span>
        <h2>All caught up</h2>
        <p>There are no notifications for you right now.</p>
      </div>
    </section>
  );
}

export function AccountReturns() {
  const [orders, setOrders] = useState<
    { id: string; orderNumber: string; status: string; items?: { id: string; productName: string }[] }[]
  >([]);
  const [returns, setReturns] = useState<{ id: string; status: string; reason: string; order?: { orderNumber: string } }[]>([]);
  const [returnOrder, setReturnOrder] = useState("");
  const [returnItem, setReturnItem] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    Promise.all([
      api.orders().then(setOrders).catch(() => setOrders([])),
      api.returns().then(setReturns).catch(() => setReturns([])),
    ]).finally(() => setLoading(false));
  }

  useEffect(load, []);
  const returnableOrders = orders.filter((order) => order.status === "DELIVERED" || order.status === "RETURN_REQUESTED");

  return (
    <section className="account-page">
      <AccountPageHeading icon={ArrowRight} kicker="AFTER-SALES SUPPORT" title="Returns" />
      {loading ? <RowsSkeleton rows={3} /> : null}
      {!loading && returns.length === 0 ? (
        <div className="account-surface customer-empty-state compact">
          <span><ArrowRight size={20} /></span>
          <div><h2>No return requests yet</h2><p>Eligible delivered orders can be selected below.</p></div>
        </div>
      ) : null}
      {!loading && returns.map((item) => (
        <article className="account-surface account-order-card" key={item.id}>
          <header><div><span className="account-page-kicker">RETURN REQUEST</span><strong>{item.order?.orderNumber ?? "Return"}</strong></div><span className="account-order-status">{titleCaseStatus(item.status)}</span></header>
          <p className="account-order-date">Reason: {titleCaseStatus(item.reason)}</p>
        </article>
      ))}
      {returnableOrders.length > 0 ? <form
        className="account-surface account-return-form"
        onSubmit={(event) => {
          event.preventDefault();
          setNote("");
          api.createReturn({
            orderId: returnOrder,
            type: "RETURN",
            reason: "CHANGED_MIND",
            ...(returnNote ? { note: returnNote } : {}),
            items: [{ orderItemId: returnItem, quantity: 1 }],
          }).then(() => {
            setReturnNote("");
            setNote("Return request sent");
            load();
          }).catch((reason: unknown) => setNote(reason instanceof Error ? reason.message : "Could not request the return"));
        }}
      >
        <header className="account-surface-heading"><h2>Start a return</h2><span>Choose an eligible order and item.</span></header>
        <div className="account-field-grid">
          <label className="field"><span>Order</span><select required value={returnOrder} onChange={(event) => { setReturnOrder(event.target.value); setReturnItem(""); }}>
            <option value="">Choose order</option>
            {returnableOrders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber}</option>)}
          </select></label>
          <label className="field"><span>Item</span><select required value={returnItem} onChange={(event) => setReturnItem(event.target.value)}>
            <option value="">Choose item</option>
            {(returnableOrders.find((order) => order.id === returnOrder)?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.productName}</option>)}
          </select></label>
          <label className="field account-field-wide"><span>Note (optional)</span><input value={returnNote} onChange={(event) => setReturnNote(event.target.value)} /></label>
        </div>
        <footer className="account-form-footer">
          {note ? <p className="account-form-note" role="status">{note}</p> : <span />}
          <button className="account-primary-action" type="submit">Request return <ArrowRight size={16} /></button>
        </footer>
      </form> : null}
    </section>
  );
}

export function CartPage() {
  const { cart, remove, setQuantity, busy, loading } = useCart();
  return (
    <section className="full-cart-page">
      <header className="full-cart-heading">
        <div>
          <span className="full-cart-kicker">YOUR SELECTION</span>
          <h1><ShoppingBag size={25} /> Shopping cart</h1>
          <p>Review your items before heading to checkout.</p>
        </div>
        {!loading && cart.items.length > 0 ? <span className="full-cart-count">{cart.summary.itemCount} {cart.summary.itemCount === 1 ? "item" : "items"}</span> : null}
      </header>
      {loading ? <div className="full-cart-loading"><RowsSkeleton rows={3} /></div> : null}
      {!loading && cart.items.length === 0 ? (
        <div className="full-cart-empty">
          <span><ShoppingBag size={30} /></span>
          <h2>Your cart is ready for something special</h2>
          <p>Browse the collection and add your favorites to get started.</p>
          <Link to="/shop" className="account-primary-action">Explore the shop <ArrowRight size={16} /></Link>
        </div>
      ) : null}
      {!loading && cart.items.length > 0 ? (
        <div className="full-cart-layout">
          <div className="full-cart-items">
            {cart.items.map((line) => (
              <article className="full-cart-item" key={line.id}>
                <Link className="full-cart-item-image" to={`/product/${line.variant.product.id}`}>
                  {line.imageUrl ? <img src={line.imageUrl} alt={line.variant.product.name} /> : <div className="photo-fallback" />}
                </Link>
                <div className="full-cart-item-details">
                  <div className="full-cart-item-top">
                    <div>
                      <span className="full-cart-item-label">IN YOUR CART</span>
                      <Link to={`/product/${line.variant.product.id}`} className="full-cart-product-name">{line.variant.product.name}</Link>
                      <div className="full-cart-variant">
                        {line.variant.optionLabel ? <span>{line.variant.optionLabel}</span> : null}
                        {line.variant.size ? <span>Size: {line.variant.size.name}</span> : null}
                        {line.variant.color ? <span>Color: {line.variant.color.name}</span> : null}
                        {line.variant.fabric ? <span>{line.variant.fabric.name}</span> : null}
                      </div>
                    </div>
                    <button type="button" className="full-cart-remove" disabled={busy} onClick={() => remove(line.id)} aria-label={`Remove ${line.variant.product.name}`}><Trash2 size={15} /><span>Remove</span></button>
                  </div>
                  <div className="full-cart-item-bottom">
                    <div className="full-cart-quantity-wrap">
                      <span>Quantity</span>
                      <div className="full-cart-quantity" aria-label="Quantity">
                      <button type="button" disabled={busy} onClick={() => setQuantity(line, line.quantity - 1)} aria-label="Decrease quantity">−</button>
                      <span>{line.quantity}</span>
                      <button type="button" disabled={busy} onClick={() => setQuantity(line, line.quantity + 1)} aria-label="Increase quantity">+</button>
                      </div>
                    </div>
                    <div className="full-cart-line-total"><span>Item total</span><strong>{money(line.lineTotal)}</strong></div>
                  </div>
                </div>
              </article>
            ))}
            <Link to="/shop" className="full-cart-continue"><ArrowLeft size={15} /> Continue shopping</Link>
          </div>
          <aside className="full-cart-summary">
            <span className="full-cart-summary-kicker">ORDER SUMMARY</span>
            <h2>Cart total</h2>
            <div><span>Items ({cart.summary.itemCount})</span><strong>{money(cart.summary.subtotal)}</strong></div>
            <div className="full-cart-subtotal"><span>Subtotal</span><strong>{money(cart.summary.subtotal)}</strong></div>
            <p>Delivery charges, if applicable, are calculated at checkout.</p>
            <Link to="/checkout" className="full-cart-checkout">Proceed to checkout <ArrowRight size={17} /></Link>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
