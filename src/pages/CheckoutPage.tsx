import { FormEvent, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Banknote, Check, CreditCard, FileText, House, Mail, MapPin, Percent, Pencil, Phone, ShieldCheck, ShoppingBag, UserRound } from "lucide-react";
import { ApiError, api } from "../api";
import { AddressLocationFields } from "../components/AddressLocationFields";
import { RowsSkeleton } from "../components/Skeleton";
import { money, titleCaseStatus } from "../format";
import { useAuth, useCart, useStore } from "../state";
import { clearStaffReferralId, readStaffReferralId } from "../staffReferral";
import type { OrderResult, SavedAddress } from "../types";

const payments = [
  { id: "COD", label: "ক্যাশ অন ডেলিভারি" },
] as const;

type PayId = (typeof payments)[number]["id"];

const DELIVERY_FEE = 130;
const DELIVERY_ADVANCE = 130;

const GUEST_CHECKOUT_ADDRESS_KEY = "bazergrid_guest_checkout_address";
const PLACED_ORDER_CACHE_KEY = "bazergrid_placed_order";

function readPlacedOrder(orderNumber: string | null): OrderResult | null {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(PLACED_ORDER_CACHE_KEY) ?? "null");
    if (
      typeof saved !== "object" || saved === null ||
      !("id" in saved) || typeof saved.id !== "string" ||
      !("orderNumber" in saved) || (orderNumber && saved.orderNumber !== orderNumber) ||
      !("total" in saved) || !("status" in saved)
    ) return null;
    return saved as OrderResult;
  } catch (reason) {
    console.warn("Saved order receipt could not be read", reason);
    return null;
  }
}

type GuestCheckoutAddress = {
  shippingFullName: string;
  shippingPhone: string;
  shippingLine1: string;
  shippingLine2: string;
  shippingCity: string;
  shippingState: string;
  shippingPostalCode: string;
  shippingCountry: string;
  email: string;
};

function readGuestCheckoutAddress(): GuestCheckoutAddress | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(GUEST_CHECKOUT_ADDRESS_KEY) ?? "null");
    if (
      typeof stored !== "object" ||
      stored === null ||
      !("shippingFullName" in stored) ||
      typeof stored.shippingFullName !== "string" ||
      !("shippingPhone" in stored) ||
      typeof stored.shippingPhone !== "string" ||
      !("shippingLine1" in stored) ||
      typeof stored.shippingLine1 !== "string" ||
      !("shippingCity" in stored) ||
      typeof stored.shippingCity !== "string" ||
      !("shippingPostalCode" in stored) ||
      typeof stored.shippingPostalCode !== "string"
    ) return null;

    return {
      shippingFullName: stored.shippingFullName,
      shippingPhone: stored.shippingPhone,
      shippingLine1: stored.shippingLine1,
      shippingLine2: "shippingLine2" in stored && typeof stored.shippingLine2 === "string" ? stored.shippingLine2 : "",
      shippingCity: stored.shippingCity,
      shippingState: "shippingState" in stored && typeof stored.shippingState === "string" ? stored.shippingState : "",
      shippingPostalCode: stored.shippingPostalCode,
      shippingCountry: "shippingCountry" in stored && typeof stored.shippingCountry === "string" ? stored.shippingCountry : "Bangladesh",
      email: "email" in stored && typeof stored.email === "string" ? stored.email : "",
    };
  } catch (reason) {
    console.warn("Saved guest checkout address could not be read", reason);
    return null;
  }
}

function writeGuestCheckoutAddress(address: GuestCheckoutAddress) {
  localStorage.setItem(GUEST_CHECKOUT_ADDRESS_KEY, JSON.stringify(address));
}

export function CheckoutPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedOrderNumber = searchParams.get("order");
  const { user } = useAuth();
  const { settings } = useStore();
  const { cart, refresh, loading: cartLoading } = useCart();
  const [form, setForm] = useState(() => ({
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
    ...readGuestCheckoutAddress(),
  }));
  const [method, setMethod] = useState<PayId>("COD");
  const [deliveryFeeTransactionId, setDeliveryFeeTransactionId] = useState("");
  const [shipping, setShipping] = useState<number | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [discountLabel, setDiscountLabel] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<OrderResult | null>(() =>
    requestedOrderNumber ? readPlacedOrder(requestedOrderNumber) : null,
  );
  const [savedAddress, setSavedAddress] = useState<SavedAddress | null>(null);
  const [addressLoaded, setAddressLoaded] = useState(false);
  const [guestAddressSaved, setGuestAddressSaved] = useState(() => Boolean(readGuestCheckoutAddress()));
  const [addressEditing, setAddressEditing] = useState(() => !readGuestCheckoutAddress());
  const [addressNote, setAddressNote] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
  useEffect(() => {
    if (requestedOrderNumber) {
      setOrder(readPlacedOrder(requestedOrderNumber));
      return;
    }
    if (cartLoading) return;
    if (cart.items.length > 0) {
      setOrder(null);
      return;
    }
    const lastOrder = readPlacedOrder(null);
    setOrder(lastOrder);
    if (lastOrder) setSearchParams({ order: lastOrder.orderNumber }, { replace: true });
  }, [requestedOrderNumber, cartLoading, cart.items.length, setSearchParams]);
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
        setAddressEditing(!address);
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
    setAddressLoaded(true);
    const guestAddress = readGuestCheckoutAddress();
    setGuestAddressSaved(Boolean(guestAddress));
    setAddressEditing(!guestAddress);
  }, [user]);

  useEffect(() => {
    const city = form.shippingCity.trim();
    if (city.length < 2 || cart.items.length === 0) {
      setShipping(null);
      setZone(null);
      setQuoteError("");
      setQuoteLoading(false);
      return;
    }
    let active = true;
    setShipping(null);
    setZone(null);
    setQuoteLoading(true);
    setQuoteError("");
    const timer = window.setTimeout(() => {
      api
        .quoteDelivery(city, cart.summary.subtotal)
        .then((quote) => {
          if (!quote.zoneId) {
            if (!active) return;
            const isDhakaCity = city.trim().toLocaleLowerCase() === "dhaka";
            setShipping(DELIVERY_FEE);
            setZone(isDhakaCity ? "ঢাকার ভিতরে" : "ঢাকার বাইরে");
            return;
          }
          const deliveryFee = Number(quote.shippingAmount);
          if (
            !Number.isFinite(deliveryFee) ||
            deliveryFee < 0
          ) {
            throw new Error("ডেলিভারি চার্জের সঠিক হিসাব পাওয়া যায়নি।");
          }
          if (!active) return;
          setShipping(deliveryFee);
          setZone(quote.zoneName);
        })
        .catch((reason) => {
          if (!active) return;
          setShipping(null);
          setZone(null);
          setQuoteError(reason instanceof Error ? reason.message : "ডেলিভারি চার্জ হিসাব করা যায়নি। আবার চেষ্টা করুন।");
        })
        .finally(() => {
          if (active) setQuoteLoading(false);
        });
    }, 400);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [form.shippingCity, cart.summary.subtotal, cart.items.length]);

  async function saveAddress() {
    setAddressNote("");
    const requiredValues = [
      form.shippingFullName,
      form.shippingPhone,
      form.shippingLine1,
      form.shippingCity,
      form.shippingState,
      form.shippingPostalCode,
      form.shippingCountry,
      ...(!user ? [form.email] : []),
    ];
    if (requiredValues.some((value) => !value.trim())) {
      setAddressNote("Please complete the required delivery details before saving.");
      return;
    }

    setSavingAddress(true);
    try {
      if (user) {
        const saved = await api.saveDefaultAddress({
          fullName: form.shippingFullName,
          phone: form.shippingPhone,
          line1: form.shippingLine1,
          line2: form.shippingLine2 || null,
          city: form.shippingCity,
          state: form.shippingState || null,
          postalCode: form.shippingPostalCode,
          country: form.shippingCountry,
        });
        setSavedAddress(saved);
      } else {
        writeGuestCheckoutAddress({
          shippingFullName: form.shippingFullName,
          shippingPhone: form.shippingPhone,
          shippingLine1: form.shippingLine1,
          shippingLine2: form.shippingLine2,
          shippingCity: form.shippingCity,
          shippingState: form.shippingState,
          shippingPostalCode: form.shippingPostalCode,
          shippingCountry: form.shippingCountry,
          email: form.email,
        });
        setGuestAddressSaved(true);
      }
      setAddressEditing(false);
      setAddressNote("Delivery address saved for your next order.");
    } catch (reason) {
      setAddressNote(reason instanceof Error ? reason.message : "Could not save your address.");
    } finally {
      setSavingAddress(false);
    }
  }

  function cancelAddressEdit() {
    setAddressNote("");
    if (user && savedAddress) {
      setForm((current) => ({
        ...current,
        shippingFullName: savedAddress.fullName,
        shippingPhone: savedAddress.phone,
        shippingLine1: savedAddress.line1,
        shippingLine2: savedAddress.line2 ?? "",
        shippingCity: savedAddress.city,
        shippingState: savedAddress.state ?? "",
        shippingPostalCode: savedAddress.postalCode,
        shippingCountry: savedAddress.country,
      }));
    } else if (!user) {
      const guestAddress = readGuestCheckoutAddress();
      if (guestAddress) setForm((current) => ({ ...current, ...guestAddress }));
    }
    setAddressEditing(false);
  }

  async function applyCode() {
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
    if (quoteLoading || shipping == null) {
      setError(quoteError || "ডেলিভারি চার্জ হিসাব হওয়া পর্যন্ত অপেক্ষা করুন।");
      return;
    }
    if (!settings.deliveryFeePaymentNumber) {
      setError("Admin-এর payment number এখনো সেট করা হয়নি।");
      return;
    }
    if (!/^[a-z0-9]{4,40}$/i.test(deliveryFeeTransactionId.trim())) {
      setError("১৩০ টাকা পাঠানোর পর সঠিক Transaction ID লিখুন।");
      return;
    }
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
        shippingDivision: form.shippingState || undefined,
        shippingDistrict: form.shippingCity,
        shippingPostalCode: form.shippingPostalCode,
        shippingCountry: form.shippingCountry,
        customerNote: form.customerNote || undefined,
        deliveryFeeTransactionId: deliveryFeeTransactionId.trim().toUpperCase(),
        email: user ? undefined : form.email,
        couponCode: user && form.couponCode.trim() ? form.couponCode.trim() : undefined,
        staffReferralId: readStaffReferralId() ?? undefined,
      });
      if (!user) {
        try {
          writeGuestCheckoutAddress({
            shippingFullName: form.shippingFullName,
            shippingPhone: form.shippingPhone,
            shippingLine1: form.shippingLine1,
            shippingLine2: form.shippingLine2,
            shippingCity: form.shippingCity,
            shippingState: form.shippingState,
            shippingPostalCode: form.shippingPostalCode,
            shippingCountry: form.shippingCountry,
            email: form.email,
          });
          setGuestAddressSaved(true);
        } catch (reason) {
          console.warn("Guest address could not be saved for next time", reason);
        }
      }
      try {
        sessionStorage.setItem(PLACED_ORDER_CACHE_KEY, JSON.stringify(placed));
      } catch (reason) {
        console.warn("Order receipt could not be saved for page reload", reason);
      }
      setOrder(placed);
      setSearchParams({ order: placed.orderNumber }, { replace: true });
      clearStaffReferralId();
      await refresh();
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : "Could not place the order");
    } finally {
      setBusy(false);
    }
  }

  const fee = shipping ?? 0;
  const total = Math.max(cart.summary.subtotal - discount, 0) + fee;

  if (order) {
    const paymentPending = order.status === "PENDING";
    const deliveryFeeDueBeforeDispatch = Number(order.deliveryAdvanceAmount ?? DELIVERY_ADVANCE);
    const cashDueToDeliveryPerson = Math.max(Number(order.total) - deliveryFeeDueBeforeDispatch, 0);
    return (
      <div className="receipt-board">
        <article className="receipt receipt-modern">
          <header className="receipt-header">
            <div>
              <p className="receipt-kicker">{settings.storeName}</p>
              <h1>{paymentPending ? "Order placed" : "Order receipt"}</h1>
            </div>
            <span className={paymentPending ? "receipt-status pending" : "receipt-status paid"}>
              {paymentPending ? "Admin review pending" : titleCaseStatus(order.status)}
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
            <div className="sub"><span>Delivery fee (pay before dispatch)</span><span>{money(deliveryFeeDueBeforeDispatch)}</span></div>
            <div className="sub"><span>Discount</span><span>{money(order.discountAmount ?? 0)}</span></div>
            <div className="sub"><span>Cash to delivery person after receiving product</span><span>{money(cashDueToDeliveryPerson)}</span></div>
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
              ? "অর্ডারটি admin review-এর অপেক্ষায় আছে। অনুমোদনের পর পণ্য delivery হবে; টাকা COD-তে দেবেন।"
              : order.emailed
                ? "A copy of this receipt was sent to your email."
                : "This order is saved here and in your account."}
          </p>
          <p className="receipt-links"><Link to="/account/orders">My orders</Link><Link to="/track">Track order</Link></p>
        </article>
        <aside className="pay-card panel receipt-payment">
          <p className="receipt-kicker">Payment</p>
          <h2>Cash on delivery</h2>
          <div className="merchant-amount">
            <div><span>Dispatch-এর আগে delivery fee</span><strong>{money(deliveryFeeDueBeforeDispatch)}</strong></div>
          </div>
          <div className="merchant-account">
            <div>
              <span>১৩০ টাকা পাঠানোর নম্বর</span>
              <strong>{settings.deliveryFeePaymentNumber || "Admin Settings-এ payment number সেট করা হয়নি"}</strong>
            </div>
          </div>
          <div className="merchant-amount">
            <div><span>পণ্য হাতে পেলে delivery person-কে দেবেন</span><strong>{money(cashDueToDeliveryPerson)}</strong></div>
          </div>
          <p>অর্ডারটি admin review-এর অপেক্ষায় আছে।</p>
        </aside>
      </div>
    );
  }

  return (
    <form className="checkout checkout-unique" onSubmit={place}>
      <div className="checkout-details">
        <header className="checkout-topbar">
          <div className="checkout-hero-copy">
            <span className="checkout-kicker">BAZERGRID · নিরাপদ চেকআউট</span>
            <h1>অর্ডার সম্পন্ন করুন</h1>
            <p>পণ্য, ডেলিভারি ঠিকানা ও পেমেন্টের তথ্য যাচাই করুন।</p>
          </div>
          <nav className="checkout-progress" aria-label="চেকআউটের ধাপ">
            <span className="complete"><i>✓</i> কার্ট</span>
            <b aria-hidden="true" />
            <span className="current"><i>২</i> ঠিকানা</span>
            <b aria-hidden="true" />
            <span><i>৩</i> পেমেন্ট</span>
          </nav>
        </header>
        <section className="checkout-form-section checkout-delivery-section">
        <div className="checkout-section-title"><span><MapPin size={17} /></span><div><strong>ডেলিভারি ঠিকানা</strong><small>আপনার সম্পূর্ণ ঠিকানা দিন</small></div></div>
        {user && !addressLoaded ? <RowsSkeleton rows={3} /> : null}
        {(!user || addressLoaded) && (addressEditing ? (
          <div className="checkout-address-editor">
            <div className="checkout-address-fields">
              <label className="field">
                <span className="checkout-field-label">আপনার নাম</span>
                <div className="checkout-input-wrap">
                  <UserRound size={18} aria-hidden="true" />
                  <input required autoComplete="name" placeholder="আপনার সম্পূর্ণ নাম লিখুন" value={form.shippingFullName} onChange={(event) => setForm({ ...form, shippingFullName: event.target.value })} />
                </div>
              </label>
              <label className="field">
                <span className="checkout-field-label">মোবাইল নম্বর</span>
                <div className="checkout-input-wrap">
                  <Phone size={18} aria-hidden="true" />
                  <input required minLength={7} autoComplete="tel" inputMode="tel" placeholder="01XXXXXXXXX" value={form.shippingPhone} onChange={(event) => setForm({ ...form, shippingPhone: event.target.value })} />
                </div>
              </label>
              {!user ? (
                <label className="field checkout-address-field-wide checkout-email-field">
                  <span className="checkout-field-label">ইমেইল</span>
                  <div className="checkout-input-wrap">
                    <Mail size={18} aria-hidden="true" />
                    <input required type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
                  </div>
                </label>
              ) : null}
            <div className="checkout-location-fields">
              <AddressLocationFields
                district={form.shippingCity}
                division={form.shippingState}
                banglaLabels
                requiredFields
                selectFields
                onChange={({ district, division }) => setForm((current) => ({
                  ...current,
                  shippingCity: district,
                  shippingState: division,
                }))}
              />
            </div>
            <label className="field checkout-address-field-wide">
              <span className="checkout-field-label">সম্পূর্ণ ঠিকানা</span>
              <div className="checkout-input-wrap">
                <House size={18} aria-hidden="true" />
                <textarea className="checkout-address-textarea" required autoComplete="street-address" placeholder="বাড়ি নম্বর, রোড নম্বর, এলাকা" value={form.shippingLine1} onChange={(event) => setForm({ ...form, shippingLine1: event.target.value })} />
              </div>
            </label>
            <label className="field checkout-address-field-wide">
              <span className="checkout-field-label">পোস্ট কোড</span>
              <div className="checkout-input-wrap">
                <FileText size={18} aria-hidden="true" />
                <input required autoComplete="postal-code" inputMode="numeric" placeholder="পোস্ট কোড" value={form.shippingPostalCode} onChange={(event) => setForm({ ...form, shippingPostalCode: event.target.value })} />
              </div>
            </label>
            <details className="checkout-extra-fields">
              <summary>অতিরিক্ত তথ্য (ঐচ্ছিক)</summary>
              <label className="field">
                <span className="checkout-field-label">ফ্ল্যাট/বাসার তথ্য</span>
                <div className="checkout-input-wrap">
                  <MapPin size={18} aria-hidden="true" />
                  <input placeholder="ফ্ল্যাট, বাসা বা তলার তথ্য" value={form.shippingLine2} onChange={(event) => setForm({ ...form, shippingLine2: event.target.value })} />
                </div>
              </label>
              <label className="field">
                <span className="checkout-field-label">ডেলিভারি নির্দেশনা</span>
                <div className="checkout-input-wrap checkout-textarea-wrap">
                  <FileText size={18} aria-hidden="true" />
                  <textarea placeholder="ডেলিভারি সম্পর্কে কোনো নির্দেশনা থাকলে লিখুন" value={form.customerNote} onChange={(event) => setForm({ ...form, customerNote: event.target.value })} />
                </div>
              </label>
            </details>
            </div>
            <div className="checkout-address-actions">
              <p className="checkout-address-note" role="status">{addressNote || "পরেরবার ব্যবহারের জন্য ঠিকানাটি সংরক্ষণ করুন।"}</p>
              <div>
                {user && savedAddress || !user && guestAddressSaved ? (
                  <button type="button" className="checkout-address-cancel" onClick={cancelAddressEdit}>বাতিল</button>
                ) : null}
                <button type="button" className="checkout-address-save" disabled={savingAddress} onClick={() => void saveAddress()}>
                  <Check size={15} />{savingAddress ? "সংরক্ষণ হচ্ছে..." : "ঠিকানা সংরক্ষণ"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="saved-address checkout-saved-address">
            <div className="checkout-saved-address-heading">
              <span><Check size={14} /> ঠিকানা সংরক্ষিত</span>
              <button type="button" onClick={() => { setAddressEditing(true); setAddressNote(""); }}><Pencil size={14} /> পরিবর্তন</button>
            </div>
            <p><strong>{form.shippingFullName}</strong> · {form.shippingPhone}</p>
            <p>{form.shippingLine1}{form.shippingLine2 ? `, ${form.shippingLine2}` : ""}</p>
            <p>{form.shippingCity}{form.shippingState ? `, ${form.shippingState}` : ""} {form.shippingPostalCode}</p>
            <p>{form.shippingCountry}</p>
            {addressNote ? <p className="checkout-address-note" role="status">{addressNote}</p> : null}
          </div>
        ))}
        </section>
        <section className="checkout-form-section checkout-payment-section">
        <div className="checkout-section-title checkout-payment-title"><span><CreditCard size={17} /></span><div><strong>পেমেন্ট মেথড নির্বাচন করুন</strong><small>আপনার পছন্দের পেমেন্ট পদ্ধতি বেছে নিন</small></div></div>
        <div className="pay-grid">
          {payments.map((option) => (
            <label key={option.id} className={`pay-card${method === option.id ? " on" : ""}`}>
              <input type="radio" name="pay" checked={method === option.id} onChange={() => setMethod(option.id)} />
              <span className={`pay-card-illustration pay-card-illustration-${option.id.toLowerCase()}`} aria-hidden="true"><Banknote size={25} /></span>
              <strong>{option.label}</strong>
              <span className="pay-card-meta">আগে ১৩০ টাকা পাঠান, বাকি টাকা পণ্য হাতে পেয়ে দিন</span>
            </label>
          ))}
        </div>
        <div className="checkout-cod-advance">
          <p className="checkout-advance-instructions">আগে {money(DELIVERY_ADVANCE)} টাকা এই নম্বরে Send Money করুন:</p>
          <strong className="checkout-advance-number">{settings.deliveryFeePaymentNumber || "Admin Settings-এ payment number সেট করা হয়নি"}</strong>
          <label className="field checkout-advance-transaction-field mt-3 block">
            <span className="checkout-advance-transaction-label">টাকা পাঠানোর Transaction ID (TrxID)</span>
            <input
              className="checkout-advance-transaction-input"
              required
              minLength={4}
              maxLength={40}
              pattern="[A-Za-z0-9]+"
              autoComplete="off"
              spellCheck={false}
              placeholder="SMS-এ পাওয়া TrxID লিখুন"
              value={deliveryFeeTransactionId}
              onChange={(event) => setDeliveryFeeTransactionId(event.target.value)}
            />
          </label>
          <small className="checkout-advance-help">TrxID admin যাচাই করার পর order confirm হবে। বাকি টাকা পণ্য হাতে পেয়ে delivery person-কে দেবেন।</small>
        </div>
        </section>
      </div>
      <aside className="summary-box checkout-summary">
        <header className="checkout-summary-heading">
          <span><ShoppingBag size={18} /></span>
          <div><small>অর্ডার</small><h2>অর্ডার সারসংক্ষেপ</h2></div>
          {!cartLoading && cart.items.length > 0 ? <b>{cart.summary.itemCount}</b> : null}
        </header>
        {cartLoading ? <RowsSkeleton rows={3} /> : null}
        {!cartLoading && cart.items.map((line) => (
          <div className="sub checkout-summary-item" key={line.id}>
            <span className="checkout-summary-product">
              <span className="checkout-summary-product-image" aria-hidden="true">
                {line.imageUrl ? <img src={line.imageUrl} alt="" /> : <ShoppingBag size={16} />}
              </span>
              <span className="checkout-summary-product-name">{line.variant.product.name} × {line.quantity}</span>
            </span>
            <span>{money(line.lineTotal)}</span>
          </div>
        ))}
        <div className="sub checkout-summary-row">
          <span>পণ্যের দাম</span>
          <span>{money(cart.summary.subtotal)}</span>
        </div>
        <div className="sub checkout-summary-row">
          <span>ডেলিভারি চার্জ {zone ? `(${zone})` : ""}</span>
          <span>{shipping == null ? "—" : money(fee)}</span>
        </div>
        {quoteError ? <p className="error checkout-delivery-error" role="alert">{quoteError}</p> : null}
        <div className="sub checkout-summary-row">
          <span>ডিসকাউন্ট {discountLabel}</span>
          <span>{money(discount)}</span>
        </div>
        <div className="sub checkout-summary-total">
          <strong>সর্বমোট</strong>
          <strong>{money(total)}</strong>
        </div>
        <div className="sub checkout-summary-row"><span>এখন পাঠাতে হবে (ডেলিভারি অগ্রিম)</span><span>{money(DELIVERY_ADVANCE)}</span></div>
        <div className="sub checkout-summary-row"><span>পণ্য হাতে পেয়ে দিতে হবে</span><span>{money(Math.max(total - DELIVERY_ADVANCE, 0))}</span></div>
        {user ? (
          <div className="news checkout-coupon">
            <div className="checkout-coupon-heading">
              <span><Percent size={14} /></span>
              <div><strong>প্রোমো কোড আছে?</strong><small>অর্ডারে ছাড় পেতে কোড দিন</small></div>
            </div>
            <input
              value={form.couponCode}
              placeholder="প্রোমো কোড"
              aria-label="প্রোমো কোড"
              onChange={(event) => setForm({ ...form, couponCode: event.target.value })}
            />
            <button type="button" onClick={() => void applyCode()}>প্রয়োগ</button>
          </div>
        ) : null}
        {error ? <p className="error checkout-error">{error}</p> : null}
        <button className="btn wide checkout-place-order" type="submit" disabled={busy || cartLoading || cart.items.length === 0 || (Boolean(user) && !addressLoaded) || quoteLoading || shipping == null}>
          <Check size={19} /><span>{busy ? "জমা হচ্ছে..." : "TrxID দিয়ে অর্ডার জমা দিন"}</span>
        </button>
        <div className="checkout-secure-note"><ShieldCheck size={16} /><span>আপনার তথ্য সম্পূর্ণ নিরাপদ ও সুরক্ষিত</span></div>
      </aside>
    </form>
  );
}
