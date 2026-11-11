import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CreditCard, MapPin, Percent, ShieldCheck, ShoppingBag } from "lucide-react";
import { ApiError, api } from "../api";
import { RowsSkeleton } from "../components/Skeleton";
import { money, titleCaseStatus } from "../format";
import { useAuth, useCart, useStore } from "../state";
import type { OrderResult, SavedAddress } from "../types";

const payments = [
  { id: "COD", label: "Cash on delivery" },
  { id: "STRIPE", label: "Card" },
  { id: "BKASH", label: "bKash Personal" },
  { id: "NAGAD", label: "Nagad" },
  { id: "ROCKET", label: "Rocket" },
] as const;

type PayId = (typeof payments)[number]["id"];

export function CheckoutPage() {
  const { user } = useAuth();
  const { settings } = useStore();
  const { cart, refresh, loading: cartLoading } = useCart();
  const [form, setForm] = useState({
    shippingFullName: "",
    shippingPhone: "",
    shippingLine1: "",
    shippingLine2: "",
    shippingCity: "",
    shippingState: "",
    shippingPostalCode: "",
    shippingCountry: "Bangladesh",
    email: "",
    customerNote: "",
    couponCode: "",
  });
  const [method, setMethod] = useState<PayId>("COD");
  const [shipping, setShipping] = useState<number | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  const [discount, setDiscount] = useState(0);
  const [discountLabel, setDiscountLabel] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [txn, setTxn] = useState("");
  const [paidNote, setPaidNote] = useState("");
  const [savedAddress, setSavedAddress] = useState<SavedAddress | null>(null);
  const [addressLoaded, setAddressLoaded] = useState(false);

  useEffect(() => {
    if (user) {
      setAddressLoaded(false);
      setForm((current) => ({
        ...current,
        shippingFullName: current.shippingFullName || `${user.firstName} ${user.lastName}`.trim(),
        email: user.email,
        shippingPhone: current.shippingPhone || user.phone || "",
      }));

      let active = true;
      api.defaultAddress().then((address) => {
        if (!active) return;
        setSavedAddress(address);
        setAddressLoaded(true);
        if (!address) return;
        setForm((current) => ({
          ...current,
          shippingFullName: address.fullName,
          shippingPhone: address.phone,
          shippingLine1: address.line1,
          shippingLine2: address.line2 ?? "",
          shippingCity: address.city,
          shippingState: address.state ?? "",
          shippingPostalCode: address.postalCode,
          shippingCountry: address.country,
          email: user.email,
        }));
      }).catch(() => {
        if (!active) return;
        setSavedAddress(null);
        setAddressLoaded(true);
      });

      return () => {
        active = false;
      };
    }
  }, [user]);

  useEffect(() => {
    const city = form.shippingCity.trim();
    if (city.length < 2 || cart.items.length === 0) {
      setShipping(null);
      return;
    }
    const timer = window.setTimeout(() => {
      api
        .quoteDelivery(city, cart.summary.subtotal)
        .then((quote) => {
          setShipping(Number(quote.shippingAmount));
          setZone(quote.zoneName);
        })
        .catch(() => {
          setShipping(null);
          setZone(null);
        });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [form.shippingCity, cart.summary.subtotal, cart.items.length]);

  async function applyCode(event: FormEvent) {
    event.preventDefault();
    setQuoteError("");
    try {
      const code = form.couponCode.trim();
      if (user && code) {
        try {
          const applied = await api.applyCoupon(code);
          setDiscount(Number(applied.discount));
          setDiscountLabel(applied.code);
          return;
        } catch {
          /* a promotion code is quoted below */
        }
      }
      const quote = await api.quotePromotion(code || undefined);
      setDiscount(Number(quote.discount));
      setDiscountLabel(quote.applied?.label ?? "");
    } catch (reason) {
      setDiscount(0);
      setDiscountLabel("");
      setQuoteError(reason instanceof Error ? reason.message : "Code was not applied");
    }
  }

  async function place(event: FormEvent) {
    event.preventDefault();
    if (user && !addressLoaded) return;
    setError("");
    setBusy(true);
    try {
      if (user) {
        await api.saveDefaultAddress({
          fullName: form.shippingFullName,
          phone: form.shippingPhone,
          line1: form.shippingLine1,
          line2: form.shippingLine2 || null,
          city: form.shippingCity,
          state: form.shippingState || null,
          postalCode: form.shippingPostalCode,
          country: form.shippingCountry,
        });
      }
      await api.choosePayment(method);
      const placed = await api.placeOrder({
        shippingFullName: form.shippingFullName,
        shippingPhone: form.shippingPhone,
        shippingLine1: form.shippingLine1,
        shippingLine2: form.shippingLine2 || undefined,
        shippingCity: form.shippingCity,
        shippingState: form.shippingState || undefined,
        shippingPostalCode: form.shippingPostalCode,
        shippingCountry: form.shippingCountry,
        customerNote: form.customerNote || undefined,
        email: user ? undefined : form.email,
        couponCode: user && form.couponCode.trim() ? form.couponCode.trim() : undefined,
      });
      setOrder(placed);
      await refresh();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not place the order");
    } finally {
      setBusy(false);
    }
  }

  async function submitTxn(event: FormEvent) {
    event.preventDefault();
    if (!order) return;
    setPaidNote("");
    try {
      await api.submitManualPayment(
        user
          ? { orderId: order.id, transactionId: txn }
          : { orderNumber: order.orderNumber, phone: form.shippingPhone, transactionId: txn },
      );
      setPaidNote("লেনদেনের আইডি জমা হয়েছে। Admin অনুমোদন দিলে paid receipt ইমেইলে পাঠানো হবে।");
    } catch (reason) {
      setPaidNote(reason instanceof Error ? reason.message : "লেনদেনের আইডি জমা হয়নি। আবার চেষ্টা করুন।");
    }
  }

  async function copyPaymentValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setPaidNote(`${label} কপি হয়েছে`);
    } catch {
      setPaidNote(`${label} কপি হয়নি। নম্বরটি select করে copy করুন।`);
    }
  }

  const fee = shipping ?? 0;
  const total = Math.max(cart.summary.subtotal - discount, 0) + fee;
  const selectedWallet = method === "BKASH" ? settings.bkashNumber : method === "NAGAD" ? settings.nagadNumber : method === "ROCKET" ? settings.rocketNumber : null;
  const wallet = order?.payTo || selectedWallet;

  if (order) {
    const payLabel = order.paymentMethod === "BKASH" ? "bKash Personal" : order.paymentMethod === "NAGAD" ? "Nagad" : order.paymentMethod === "ROCKET" ? "Rocket" : order.paymentMethod === "STRIPE" ? "Card" : "Cash on delivery";
    const manualPayment = order.paymentMethod === "BKASH" || order.paymentMethod === "NAGAD" || order.paymentMethod === "ROCKET";
    const paymentPending = manualPayment && order.status !== "CONFIRMED";
    return (
      <div className="receipt-board">
        <article className="receipt receipt-modern">
          <header className="receipt-header">
            <div>
              <p className="receipt-kicker">{settings.storeName}</p>
              <h1>{paymentPending ? "Order placed" : "Order receipt"}</h1>
            </div>
            <span className={paymentPending ? "receipt-status pending" : "receipt-status paid"}>
              {paymentPending ? "Payment pending" : titleCaseStatus(order.status)}
            </span>
          </header>
          <div className="receipt-order-ref">
            <span>Order reference</span>
            <strong>{order.orderNumber}</strong>
          </div>
          <div className="receipt-lines">
            <p className="receipt-section-label">Items</p>
            {(order.items ?? []).map((item) => (
              <div className="sub" key={item.id}>
                <span>
                  {item.productName} × {item.quantity}
                  {item.size ? <small> {item.size}{item.color ? ` / ${item.color}` : ""}</small> : null}
                </span>
                <span>{money(item.lineTotal)}</span>
              </div>
            ))}
          </div>
          <div className="receipt-totals">
            <div className="sub"><span>Subtotal</span><span>{money(order.subtotal ?? order.total)}</span></div>
            <div className="sub"><span>Delivery</span><span>{money(order.shippingAmount ?? 0)}</span></div>
            <div className="sub"><span>Discount</span><span>{money(order.discountAmount ?? 0)}</span></div>
            <div className="sub receipt-total"><strong>Total</strong><strong>{money(order.total)}</strong></div>
          </div>
          <div className="receipt-delivery">
            <p className="receipt-section-label">Delivering to</p>
            <strong>{order.shippingFullName}</strong>
            <p>{order.shippingLine1}{order.shippingCity ? `, ${order.shippingCity}` : ""} {order.shippingPostalCode}</p>
            <p>{order.shippingPhone}</p>
          </div>
          <p className="receipt-email-note">
            {paymentPending
              ? "Your paid receipt will be emailed after the payment is approved."
              : order.emailed
                ? "A copy of this receipt was sent to your email."
                : "This order is saved here and in your account."}
          </p>
          <p className="receipt-links"><Link to="/account/orders">My orders</Link><Link to="/track">Track order</Link></p>
        </article>
        <aside className="pay-card panel receipt-payment">
          <p className="receipt-kicker">Payment</p>
          <h2>{payLabel}</h2>
          <p className="pay-amount">{money(order.total)}</p>
          {order.paymentMethod === "COD" ? <p>Pay cash when the order arrives. The order is already in your account.</p> : null}
          {order.paymentMethod === "STRIPE" ? (
            <button
              className="btn wide"
              type="button"
              onClick={() => {
                const open = (url: string | null | undefined) => {
                  if (url) window.location.assign(url);
                  else setPaidNote("Card checkout did not return a link");
                };
                if (order.checkoutUrl) {
                  open(order.checkoutUrl);
                  return;
                }
                api.createCheckout(order.id).then((checkout) => open(checkout.url)).catch((reason) => setPaidNote(reason instanceof Error ? reason.message : "Could not start card checkout"));
              }}
            >
              Pay by card
            </button>
          ) : null}
          {manualPayment ? (
            <form className="merchant-payment" onSubmit={submitTxn}>
              <div className={`wallet-mark wallet-${order.paymentMethod.toLowerCase()}`} aria-hidden="true">
                {order.paymentMethod === "BKASH" ? "bK" : order.paymentMethod === "NAGAD" ? "N" : "R"}
              </div>
              <p className="merchant-kicker">ওয়ালেট পেমেন্ট</p>
              <h3>Pay with {payLabel}</h3>
              <div className="merchant-amount">
                <div><span>যে পরিমাণ পাঠাবেন</span><strong>{money(order.total)}</strong></div>
                <button type="button" onClick={() => copyPaymentValue(String(order.total), "পরিমাণ")}>পরিমাণ কপি</button>
              </div>
              <div className="merchant-account">
                <div><span>মার্চেন্ট অ্যাকাউন্ট নম্বর</span><strong>{wallet || "অ্যাকাউন্ট নম্বর সেট করা হয়নি"}</strong></div>
                {wallet ? <button type="button" onClick={() => copyPaymentValue(wallet, "অ্যাকাউন্ট নম্বর")}>নম্বর কপি</button> : null}
              </div>
              <ol className="merchant-steps">
                <li>{payLabel} app খুলে <strong>Send Money</strong> নির্বাচন করুন।</li>
                <li>উপরের মার্চেন্ট নম্বরে দেখানো ঠিক পরিমাণ টাকা পাঠান।</li>
                <li>SMS বা payment receipt-এ পাওয়া Transaction ID নিচের ঘরে লিখুন।</li>
              </ol>
              <label className="field merchant-transaction-field">
                <span>নিচের ঘরে Transaction ID লিখুন</span>
                <small className="merchant-transaction-hint">টাকা পাঠানোর পর SMS বা payment confirmation-এ যে ID পাবেন, সেটি লিখুন।</small>
                <input className="merchant-transaction-input" value={txn} onChange={(event) => setTxn(event.target.value)} required minLength={4} aria-label="Transaction ID লিখুন" placeholder="SMS-এর Transaction ID" />
              </label>
              <button className="btn wide" type="submit" disabled={!wallet}>লেনদেন আইডি জমা দিন</button>
              <p className="merchant-footnote">Admin payment approve করলে paid receipt ইমেইলে আসবে।</p>
            </form>
          ) : null}
          {paidNote ? <p className="note">{paidNote}</p> : null}
        </aside>
      </div>
    );
  }

  return (
    <form className="checkout checkout-unique" onSubmit={place}>
      <div className="checkout-details">
        <header className="checkout-intro">
          <span className="checkout-kicker">ALMOST YOURS</span>
          <h1>Complete your order</h1>
          <p>Delivery details, payment, and you’re all set.</p>
          <div className="checkout-steps" aria-label="Checkout steps">
            <span className="current"><i>1</i> Delivery</span>
            <span className="step-connector" />
            <span><i>2</i> Payment</span>
            <span className="step-connector" />
            <span><i>3</i> Confirmation</span>
          </div>
        </header>
        <section className="checkout-form-section checkout-delivery-section">
        <div className="checkout-section-title"><span><MapPin size={17} /></span><div><strong>Delivery information</strong><small>Where should we send your order?</small></div></div>
        {user && !addressLoaded ? <RowsSkeleton rows={3} /> : null}
        {user && addressLoaded && savedAddress ? (
          <div className="saved-address">
            <p className="label">Delivery address</p>
            <p><strong>{savedAddress.fullName}</strong> · {savedAddress.phone}</p>
            <p>{savedAddress.line1}{savedAddress.line2 ? `, ${savedAddress.line2}` : ""}</p>
            <p>{savedAddress.city}{savedAddress.state ? `, ${savedAddress.state}` : ""} {savedAddress.postalCode}</p>
            <p>{savedAddress.country}</p>
            <p className="note"><Link to="/account">Change address in profile</Link></p>
          </div>
        ) : null}
        {user ? null : (
          <>
            <label className="field">
              <span>Full name</span>
              <input required placeholder="Enter your full name" value={form.shippingFullName} onChange={(event) => setForm({ ...form, shippingFullName: event.target.value })} />
            </label>
            <label className="field">
              <span>Phone</span>
              <input required minLength={7} placeholder="e.g. 01XXXXXXXXX" value={form.shippingPhone} onChange={(event) => setForm({ ...form, shippingPhone: event.target.value })} />
            </label>
          <label className="field">
            <span>Email</span>
            <input required type="email" placeholder="you@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </label>
          </>
        )}
        {(!user || (addressLoaded && !savedAddress)) ? (
          <>
            {user ? (
              <>
                <label className="field"><span>Full name</span><input required placeholder="Enter your full name" value={form.shippingFullName} onChange={(event) => setForm({ ...form, shippingFullName: event.target.value })} /></label>
                <label className="field"><span>Phone</span><input required minLength={7} placeholder="e.g. 01XXXXXXXXX" value={form.shippingPhone} onChange={(event) => setForm({ ...form, shippingPhone: event.target.value })} /></label>
              </>
            ) : null}
            <label className="field">
              <span>Address</span>
              <input required placeholder="House, road, area" value={form.shippingLine1} onChange={(event) => setForm({ ...form, shippingLine1: event.target.value })} />
            </label>
            <label className="field">
              <span>Address line 2</span>
              <input placeholder="Apartment, suite, floor (optional)" value={form.shippingLine2} onChange={(event) => setForm({ ...form, shippingLine2: event.target.value })} />
            </label>
            <label className="field">
              <span>City</span>
              <input required minLength={2} placeholder="Enter your city" value={form.shippingCity} onChange={(event) => setForm({ ...form, shippingCity: event.target.value })} />
            </label>
            <label className="field">
              <span>State</span>
              <input placeholder="State or division" value={form.shippingState} onChange={(event) => setForm({ ...form, shippingState: event.target.value })} />
            </label>
            <label className="field">
              <span>Postal code</span>
              <input required placeholder="Postal code" value={form.shippingPostalCode} onChange={(event) => setForm({ ...form, shippingPostalCode: event.target.value })} />
            </label>
            <label className="field">
              <span>Country</span>
              <input required placeholder="Country" value={form.shippingCountry} onChange={(event) => setForm({ ...form, shippingCountry: event.target.value })} />
            </label>
          </>
        ) : null}
        <label className="field">
          <span>Note</span>
          <textarea placeholder="Any delivery instructions? (optional)" value={form.customerNote} onChange={(event) => setForm({ ...form, customerNote: event.target.value })} />
        </label>
        </section>
        <section className="checkout-form-section checkout-payment-section">
        <div className="checkout-section-title checkout-payment-title"><span><CreditCard size={17} /></span><div><strong>Payment method</strong><small>Choose how you’d like to pay</small></div></div>
        <div className="pay-grid">
          {payments.map((option) => {
            const walletNumber = option.id === "BKASH" ? settings.bkashNumber : option.id === "NAGAD" ? settings.nagadNumber : option.id === "ROCKET" ? settings.rocketNumber : null;
            const configured = option.id === "COD" || option.id === "STRIPE" || Boolean(walletNumber);
            return (
              <label key={option.id} className={`pay-card${method === option.id ? " on" : ""}${configured ? "" : " disabled"}`}>
                <input type="radio" name="pay" checked={method === option.id} disabled={!configured} onChange={() => setMethod(option.id)} />
                <strong>{option.label}</strong>
                <span className="pay-card-meta">
                  {!configured ? "Unavailable · account not configured" : null}
                  {option.id === "BKASH" && walletNumber ? `Personal · ${walletNumber}` : null}
                  {option.id === "NAGAD" && walletNumber ? walletNumber : null}
                  {option.id === "ROCKET" && walletNumber ? walletNumber : null}
                  {option.id === "COD" ? "Pay at the door" : null}
                  {option.id === "STRIPE" ? "Credit or debit · Visa, Mastercard" : null}
                </span>
              </label>
            );
          })}
        </div>
        </section>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn wide checkout-place-order" type="submit" disabled={busy || cartLoading || cart.items.length === 0 || (Boolean(user) && !addressLoaded)}>
          <span>{busy ? "Placing order..." : "Place your order"}</span><ArrowRight size={17} />
        </button>
      </div>
      <aside className="summary-box checkout-summary">
        <header className="checkout-summary-heading">
          <span><ShoppingBag size={18} /></span>
          <div><small>YOUR ORDER</small><h2>Order summary</h2></div>
          {!cartLoading && cart.items.length > 0 ? <b>{cart.summary.itemCount}</b> : null}
        </header>
        {cartLoading ? <RowsSkeleton rows={3} /> : null}
        {!cartLoading && cart.items.map((line) => (
          <div className="sub checkout-summary-item" key={line.id}>
            <span>
              {line.variant.product.name} × {line.quantity}
            </span>
            <span>{money(line.lineTotal)}</span>
          </div>
        ))}
        <div className="sub checkout-summary-row">
          <span>Subtotal</span>
          <span>{money(cart.summary.subtotal)}</span>
        </div>
        <div className="sub checkout-summary-row">
          <span>Delivery {zone ? `(${zone})` : ""}</span>
          <span>{shipping == null ? "—" : money(fee)}</span>
        </div>
        <div className="sub checkout-summary-row">
          <span>Discount {discountLabel}</span>
          <span>{money(discount)}</span>
        </div>
        <div className="sub checkout-summary-total">
          <strong>Total</strong>
          <strong>{money(total)}</strong>
        </div>
        {user ? (
          <form onSubmit={applyCode} className="news checkout-coupon">
            <div className="checkout-coupon-heading">
              <span><Percent size={14} /></span>
              <div><strong>Have a promo code?</strong><small>Apply it to your order</small></div>
            </div>
            <input
              value={form.couponCode}
              placeholder="Code"
              aria-label="Discount code"
              onChange={(event) => setForm({ ...form, couponCode: event.target.value })}
            />
            <button type="submit">Apply</button>
          </form>
        ) : null}
        {quoteError ? <p className="error">{quoteError}</p> : null}
        <div className="checkout-secure-note"><ShieldCheck size={16} /><span>Secure checkout · Your information is protected</span></div>
      </aside>
    </form>
  );
}
