import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
  { id: "BKASH", label: "bKash Personal" },
  { id: "NAGAD", label: "Nagad" },
  { id: "ROCKET", label: "Rocket" },
] as const;

type PayId = (typeof payments)[number]["id"];

const DHAKA_DELIVERY_FEE = 70;
const OUTSIDE_DHAKA_DELIVERY_FEE = 140;

const GUEST_CHECKOUT_ADDRESS_KEY = "bazergrid_guest_checkout_address";

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
  const { user } = useAuth();
  const { settings } = useStore();
  const { cart, refresh, loading: cartLoading, busy: cartBusy, setQuantity } = useCart();
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
  const [shipping, setShipping] = useState<number | null>(null);
  const [zone, setZone] = useState<string | null>(null);
  const [advancePaymentAmount, setAdvancePaymentAmount] = useState<number | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [discountLabel, setDiscountLabel] = useState("");
  const [quoteError, setQuoteError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [txn, setTxn] = useState("");
  const [paidNote, setPaidNote] = useState("");
  const [savedAddress, setSavedAddress] = useState<SavedAddress | null>(null);
  const [addressLoaded, setAddressLoaded] = useState(false);
  const [guestAddressSaved, setGuestAddressSaved] = useState(() => Boolean(readGuestCheckoutAddress()));
  const [addressEditing, setAddressEditing] = useState(() => !readGuestCheckoutAddress());
  const [addressNote, setAddressNote] = useState("");
  const [savingAddress, setSavingAddress] = useState(false);
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
      setAdvancePaymentAmount(null);
      setZone(null);
      setQuoteError("");
      setQuoteLoading(false);
      return;
    }
    let active = true;
    setShipping(null);
    setAdvancePaymentAmount(null);
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
            const deliveryFee = isDhakaCity ? DHAKA_DELIVERY_FEE : OUTSIDE_DHAKA_DELIVERY_FEE;
            setShipping(deliveryFee);
            setAdvancePaymentAmount(deliveryFee);
            setZone(isDhakaCity ? "ঢাকার ভিতরে" : "ঢাকার বাইরে");
            return;
          }
          const deliveryFee = Number(quote.shippingAmount);
          const advance = Number(quote.advancePaymentAmount ?? deliveryFee);
          if (
            !Number.isFinite(deliveryFee) ||
            deliveryFee < 0 ||
            !Number.isFinite(advance) ||
            advance < 0
          ) {
            throw new Error("ডেলিভারি চার্জের সঠিক হিসাব পাওয়া যায়নি।");
          }
          if (!active) return;
          setShipping(deliveryFee);
          setZone(quote.zoneName);
          setAdvancePaymentAmount(advance);
        })
        .catch((reason) => {
          if (!active) return;
          setShipping(null);
          setZone(null);
          setAdvancePaymentAmount(null);
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
      setError(quoteError || "জেলা নির্বাচন করে ডেলিভারি চার্জ হিসাব হওয়া পর্যন্ত অপেক্ষা করুন।");
      return;
    }
    if (method === "COD" && advancePaymentAmount == null) {
      setError("জেলা নির্বাচন করে ডেলিভারি চার্জ হিসাব হওয়া পর্যন্ত অপেক্ষা করুন।");
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
          setPaidNote("Order placed. This browser could not save your address for next time.");
        }
      }
      setOrder(placed);
      clearStaffReferralId();
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
      setPaidNote(order.codAdvance
        ? "লেনদেনের আইডি জমা হয়েছে। Admin অনুমোদন দিলে order confirmation ইমেইলে পাঠানো হবে।"
        : "লেনদেনের আইডি জমা হয়েছে। Admin অনুমোদন দিলে paid receipt ইমেইলে পাঠানো হবে।");
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

  async function payCodAdvance() {
    if (!order?.codAdvance || checkoutBusy) return;
    setCheckoutBusy(true);
    setPaidNote("");
    try {
      const checkout = await api.createCodAdvanceCheckout(
        user
          ? { orderId: order.id }
          : { orderNumber: order.orderNumber, phone: form.shippingPhone },
      );
      if (!checkout.url) {
        throw new Error("Advance payment checkout link is unavailable.");
      }
      window.location.assign(checkout.url);
    } catch (reason) {
      setPaidNote(reason instanceof Error ? reason.message : "অগ্রিম পেমেন্ট শুরু করা যায়নি। আবার চেষ্টা করুন।");
    } finally {
      setCheckoutBusy(false);
    }
  }

  const fee = shipping ?? 0;
  const estimatedCodAdvance = advancePaymentAmount ?? 0;
  const total = Math.max(cart.summary.subtotal - discount, 0) + fee;
  const advanceExceedsTotal = advancePaymentAmount != null && total < advancePaymentAmount;
  const selectedWallet = method === "BKASH" ? settings.bkashNumber : method === "NAGAD" ? settings.nagadNumber : method === "ROCKET" ? settings.rocketNumber : null;
  const wallet = order?.payTo || selectedWallet;

  if (order) {
    const advanceProvider = order.codAdvance?.method;
    const paymentProvider = advanceProvider ?? order.paymentMethod;
    const providerLabel = paymentProvider === "BKASH" ? "bKash Personal" : paymentProvider === "NAGAD" ? "Nagad" : paymentProvider === "ROCKET" ? "Rocket" : paymentProvider === "STRIPE" ? "Card" : "Cash on delivery";
    const payLabel = order.codAdvance ? `Cash on delivery + ${providerLabel} advance` : providerLabel;
    const manualPayment = paymentProvider === "BKASH" || paymentProvider === "NAGAD" || paymentProvider === "ROCKET";
    const paymentAmount = order.codAdvance?.amount ?? order.total;
    const paymentPending = order.status === "PENDING";
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
            {order.codAdvance ? (
              <>
                <div className="sub"><span>Delivery advance to pay online</span><span>{money(order.codAdvance.amount)}</span></div>
                <div className="sub"><span>Cash due on delivery after approval</span><span>{money(order.codAdvance.remainingAmount)}</span></div>
              </>
            ) : null}
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
              ? order.codAdvance
                ? "Your order will be confirmed after the delivery advance is verified."
                : "Your paid receipt will be emailed after the payment is approved."
              : order.emailed
                ? "A copy of this receipt was sent to your email."
                : "This order is saved here and in your account."}
          </p>
          <p className="receipt-links"><Link to="/account/orders">My orders</Link><Link to="/track">Track order</Link></p>
        </article>
        <aside className="pay-card panel receipt-payment">
          <p className="receipt-kicker">Payment</p>
          <h2>{payLabel}</h2>
          <p className="pay-amount">{money(paymentAmount)}</p>
          {order.codAdvance ? (
            <>
              <p>Advance payment is required before this COD order is confirmed. Pay it securely online, then pay the remaining balance in cash on delivery.</p>
              <button className="btn wide checkout-advance-pay" type="button" disabled={checkoutBusy} onClick={() => void payCodAdvance()}>
                <CreditCard size={18} />{checkoutBusy ? "পেমেন্ট পেজ খোলা হচ্ছে..." : "অগ্রিম চার্জ পেমেন্ট করুন"}
              </button>
            </>
          ) : null}
          {order.paymentMethod === "COD" && !order.codAdvance ? <p>Pay cash when the order arrives. The order is already in your account.</p> : null}
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
              <div className={`wallet-mark wallet-${paymentProvider.toLowerCase()}`} aria-hidden="true">
                {paymentProvider === "BKASH" ? "bK" : paymentProvider === "NAGAD" ? "N" : "R"}
              </div>
              <p className="merchant-kicker">ওয়ালেট পেমেন্ট</p>
              <h3>Pay with {providerLabel}</h3>
              <div className="merchant-amount">
                <div><span>যে পরিমাণ পাঠাবেন</span><strong>{money(paymentAmount)}</strong></div>
                <button type="button" onClick={() => copyPaymentValue(String(paymentAmount), "পরিমাণ")}>পরিমাণ কপি</button>
              </div>
              <div className="merchant-account">
                <div><span>মার্চেন্ট অ্যাকাউন্ট নম্বর</span><strong>{wallet || "অ্যাকাউন্ট নম্বর সেট করা হয়নি"}</strong></div>
                {wallet ? <button type="button" onClick={() => copyPaymentValue(wallet, "অ্যাকাউন্ট নম্বর")}>নম্বর কপি</button> : null}
              </div>
              <ol className="merchant-steps">
                <li>{providerLabel} app খুলে <strong>Send Money</strong> নির্বাচন করুন।</li>
                <li>উপরের মার্চেন্ট নম্বরে দেখানো ঠিক পরিমাণ টাকা পাঠান।</li>
                <li>SMS বা payment receipt-এ পাওয়া Transaction ID নিচের ঘরে লিখুন।</li>
              </ol>
              <label className="field merchant-transaction-field">
                <span>নিচের ঘরে Transaction ID লিখুন</span>
                <small className="merchant-transaction-hint">টাকা পাঠানোর পর SMS বা payment confirmation-এ যে ID পাবেন, সেটি লিখুন।</small>
                <input className="merchant-transaction-input" value={txn} onChange={(event) => setTxn(event.target.value)} required minLength={4} aria-label="Transaction ID লিখুন" placeholder="SMS-এর Transaction ID" />
              </label>
              <button className="btn wide" type="submit" disabled={!wallet}>লেনদেন আইডি জমা দিন</button>
              <p className="merchant-footnote">{order.codAdvance ? "Admin advance payment approve করলে order confirmation ইমেইলে আসবে। বাকি টাকা delivery-তে cash-এ দেবেন।" : "Admin payment approve করলে paid receipt ইমেইলে আসবে।"}</p>
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
        <header className="checkout-topbar">
          <div className="checkout-topbar-title">
            <h1>Checkout</h1>
          </div>
        </header>
        <section className="checkout-products" aria-label="কার্টের পণ্য">
          {cartLoading ? <RowsSkeleton rows={1} /> : null}
          {!cartLoading && cart.items.map((line) => {
            const variant = line.variant.optionLabel || [
              line.variant.size?.name,
              line.variant.color?.name,
              line.variant.fabric?.name,
            ].filter(Boolean).join(" | ");
            const quantityOptions = Array.from({ length: Math.min(5, line.availableQuantity) }, (_, index) => index + 1);
            if (!quantityOptions.includes(line.quantity)) quantityOptions.push(line.quantity);
            return (
              <article className="checkout-product" key={line.id}>
                <div className="checkout-product-image">
                  {line.imageUrl ? <img src={line.imageUrl} alt={line.variant.product.name} /> : <ShoppingBag size={34} />}
                </div>
                <div className="checkout-product-copy">
                  <strong>{line.variant.product.name}</strong>
                  <span>{variant || "স্ট্যান্ডার্ড"}</span>
                  <b>{money(line.unitPrice)}</b>
                </div>
                <label className="checkout-quantity">
                  <span>Qty:</span>
                  <select
                    value={line.quantity}
                    disabled={cartBusy}
                    aria-label={`${line.variant.product.name} quantity`}
                    onChange={(event) => void setQuantity(line, Number(event.target.value))}
                  >
                    {quantityOptions.map((quantity) => <option key={quantity} value={quantity}>{quantity}</option>)}
                  </select>
                </label>
              </article>
            );
          })}
        </section>
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
          {payments.map((option) => {
            const walletNumber = option.id === "BKASH" ? settings.bkashNumber : option.id === "NAGAD" ? settings.nagadNumber : option.id === "ROCKET" ? settings.rocketNumber : null;
            const configured = option.id === "COD" || Boolean(walletNumber);
            return (
              <label key={option.id} className={`pay-card${method === option.id ? " on" : ""}${configured ? "" : " disabled"}`}>
                <input type="radio" name="pay" checked={method === option.id} disabled={!configured} onChange={() => setMethod(option.id)} />
                <span className={`pay-card-illustration pay-card-illustration-${option.id.toLowerCase()}`} aria-hidden="true">
                  {option.id === "COD" ? (
                    <Banknote size={25} />
                  ) : (
                    <span className={`checkout-wallet-logo checkout-wallet-logo-${option.id.toLowerCase()}`}>
                      {option.id === "BKASH" ? "bKash" : option.id === "NAGAD" ? "Nagad" : "Rocket"}
                    </span>
                  )}
                </span>
                <strong>{option.label}</strong>
                <span className="pay-card-meta">
                  {!configured ? "অ্যাকাউন্ট সেট করা নেই" : null}
                  {option.id === "BKASH" && walletNumber ? `Personal · ${walletNumber}` : null}
                  {option.id === "NAGAD" && walletNumber ? walletNumber : null}
                  {option.id === "ROCKET" && walletNumber ? walletNumber : null}
                  {option.id === "COD" ? "আগে ডেলিভারি চার্জ, বাকি টাকা পণ্য হাতে পেয়ে দিন" : null}
                </span>
              </label>
            );
          })}
        </div>
        <p className="checkout-payment-note" role="status">
          {method === "COD"
            ? "অর্ডার নিশ্চিত করার আগে ডেলিভারি চার্জ অনলাইনে দিতে হবে। বাকি পণ্যের মূল্য ক্যাশ অন ডেলিভারিতে দেবেন।"
            : "অনলাইন পেমেন্টে অর্ডারের সম্পূর্ণ মূল্য পরিশোধ হবে।"}
        </p>
        {method === "COD" ? (
          <div className="checkout-cod-advance" aria-live="polite">
            <span className="checkout-advance-icon"><CreditCard size={22} /></span>
            <div>
              <strong>অগ্রিম ডেলিভারি চার্জ পেমেন্ট</strong>
              <small>
                {quoteLoading
                  ? "ডেলিভারি চার্জ হিসাব হচ্ছে..."
                  : advancePaymentAmount == null
                    ? "জেলা নির্বাচন করলে অগ্রিম চার্জ দেখানো হবে"
                    : `এখন ${money(advancePaymentAmount)} BDT অনলাইনে পরিশোধ করুন`}
              </small>
            </div>
            <b>{advancePaymentAmount == null ? "—" : money(advancePaymentAmount)}</b>
          </div>
        ) : null}
        {method === "COD" && advanceExceedsTotal ? (
          <p className="error">অর্ডারের মোট মূল্য অগ্রিম ডেলিভারি চার্জের চেয়ে বেশি হতে হবে।</p>
        ) : null}
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
            <span>
              {line.variant.product.name} × {line.quantity}
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
        {method === "COD" ? (
          <>
            <div className="sub checkout-summary-row">
              <span>অগ্রিম ডেলিভারি চার্জ</span>
              <span>{advancePaymentAmount == null ? "—" : money(estimatedCodAdvance)}</span>
            </div>
            <div className="sub checkout-summary-row">
              <span>ডেলিভারির সময় দিতে হবে</span>
              <span>{advancePaymentAmount == null ? "—" : money(Math.max(total - estimatedCodAdvance, 0))}</span>
            </div>
          </>
        ) : null}
        <div className="sub checkout-summary-total">
          <strong>{method === "COD" ? "এখন পরিশোধ করতে হবে" : "মোট"}</strong>
          <strong>{method === "COD" ? advancePaymentAmount == null ? "—" : money(estimatedCodAdvance) : money(total)}</strong>
        </div>
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
        <button className="btn wide checkout-place-order" type="submit" disabled={busy || cartLoading || cart.items.length === 0 || (Boolean(user) && !addressLoaded) || quoteLoading || shipping == null || (method === "COD" && (advancePaymentAmount == null || advanceExceedsTotal))}>
          <Check size={19} /><span>{busy ? "অর্ডার করা হচ্ছে..." : "অর্ডার নিশ্চিত করুন"}</span>
        </button>
        <div className="checkout-secure-note"><ShieldCheck size={16} /><span>আপনার তথ্য সম্পূর্ণ নিরাপদ ও সুরক্ষিত</span></div>
      </aside>
    </form>
  );
}
