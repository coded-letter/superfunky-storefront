import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Elements, PaymentElement } from "@stripe/react-stripe-js";
import { AlertTriangle, Banknote, Bitcoin, Check, ChevronDown, Copy, CreditCard, PackageCheck, QrCode, ShieldCheck, Tag, Truck } from "lucide-react";
import { useCart, useCurrency, useLayoutPreferences } from "@funky/ui";
import { CustomerShortcodePage } from "../components/CustomerShortcodePage";
import { useApplicationShortcode, useEmbeddedApplicationShortcode } from "../components/applicationShortcodes";
import { saveCheckoutEmail, saveNewsletterEmail, useAbandonedCartTracking } from "../lib/abandonedCart";
import { syncCartToBackend } from "../lib/backendCart";
import { checkoutApplyCoupon, checkoutRemoveCoupon, isCartVirtual, mapShippingOptionsToDisplayMethods, resolveFreeShippingThreshold, type DisplayShippingMethod, useShippingMethods, useTaxCalculation } from "../lib/checkout";
import { isBackendConfigured } from "../lib/env";
import { useStorefrontPath } from "../lib/storefrontPaths";
import { getStripe, getStripePublishableKey, isStripeConfigured } from "../lib/stripe";
import { submitCheckoutWithAccount, usePaymentGateways, type CheckoutBillingDetails, type CryptoAsset } from "../lib/payments";
import { isUserLoggedIn } from "../lib/auth";
import { getStorefrontAccount } from "../lib/account";
import { isValidEmail, isValidPhone, validateCheckoutForm } from "../lib/validation";
import { FREE_SHIPPING_THRESHOLD, InputMock, OrderSummaryCard } from "./shared";
import { type StoreApiAddress } from "../lib/wcStoreApi";
import { useNavigationData } from "../state/navigationData";

/** WooCommerce-style allowed-countries shortlist — enough variety for the mockup
 * without pulling in the full ISO country list the legacy prototype loaded via GraphQL.
 * Values are ISO 3166-1 alpha-2 codes since that's what the WooCommerce Store API's
 * `checkout` endpoint requires for `billing_address.country`/`shipping_address.country`. */
const FALLBACK_COUNTRIES: { code: string; label: string }[] = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "IE", label: "Ireland" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "ES", label: "Spain" },
  { code: "IT", label: "Italy" },
  { code: "NL", label: "Netherlands" },
  { code: "PL", label: "Poland" },
  { code: "SE", label: "Sweden" },
  { code: "GR", label: "Greece" },
  { code: "PT", label: "Portugal" },
  { code: "CA", label: "Canada" },
  { code: "AU", label: "Australia" },
];

type PaymentMethod = "stripe" | "blik" | "crypto" | "cod" | "cheque" | "bacs";
type ShippingMethodId = string; // Backend methods can have arbitrary IDs; mocks use "standard" | "express"
type CryptoCoin = string;

const BLIK_WINDOW_SECONDS = 120;
// Mock exchange-rate lock window for crypto invoices (BTCPay/Coinbase Commerce-style
// checkouts typically quote a fixed rate for ~15 minutes before it needs refreshing).
const CRYPTO_RATE_WINDOW_SECONDS = 15 * 60;

// Fallback-only wallet addresses and USD conversion rates for local mockup mode when
// no backend-configured crypto assets are available yet.
const CRYPTO_COINS: Record<string, { label: string; ticker: string; network: string; address: string; usdRate: number; qrUrl?: string }> = {
  btc: {
    label: "Bitcoin",
    ticker: "BTC",
    network: "Bitcoin network",
    address: "bc1qmock0demo0wallet0address0funkycommerce",
    usdRate: 62_000,
  },
  eth: {
    label: "Ethereum",
    ticker: "ETH",
    network: "Ethereum (ERC-20)",
    address: "0xMOCK00DEMO00WALLET00ADDRESS00FUNKYCOMMERCE",
    usdRate: 3_200,
  },
};

function formatCountdown(secondsLeft: number): string {
  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

type CouponPosition = "inline" | "top";
type PaymentMethodsPosition = "left" | "right";
type SummaryPosition = "sticky" | "static";

const FALLBACK_SHIPPING_METHODS: DisplayShippingMethod[] = [
  { id: "standard", label: "Standard shipping", eta: "3–5 business days", price: 7 },
  { id: "express", label: "Express shipping", eta: "1–2 business days", price: 14 },
];

export function CheckoutMockupPage() {
  const embedded = useEmbeddedApplicationShortcode();
  if (!embedded) {
    return (
      <CustomerShortcodePage
        pageKey="checkout"
        defaultShortcode="checkout"
        defaultAttributes={{
          mode: "physical",
          "coupon-position": "inline",
          "payment-position": "left",
          "summary-position": "sticky",
          "hide-optional-billing-fields": "false",
          "hide-optional-shipping-fields": "false",
          "show-order-notes": "true",
          "show-terms": "true",
          "show-privacy": "true",
          "allow-guest-checkout": "true",
        }}
      />
    );
  }
  const { data: navigationData } = useNavigationData();
  const {
    checkoutStoreMode,
    checkoutCouponPosition,
    checkoutPaymentPosition,
    checkoutSummaryPosition,
    checkoutHideOptionalBillingFields,
    checkoutHideOptionalShippingFields,
    checkoutShowOrderNotes,
    checkoutShowTerms,
    checkoutShowPrivacy,
  } = useLayoutPreferences();
  const config = useApplicationShortcode(["funkycommerce_checkout", "woocommerce_checkout"], {
    mode: "physical",
    "coupon-position": "inline",
    "payment-position": "left",
    "summary-position": "sticky",
    "hide-optional-billing-fields": "false",
    "hide-optional-shipping-fields": "false",
    "show-order-notes": "true",
    "show-terms": "true",
    "show-privacy": "true",
    "allow-guest-checkout": "true",
  });
  const navigate = useNavigate();
  const cartPath = useStorefrontPath("cart", "/cart");
  const orderSuccessPath = useStorefrontPath("order-success", "/order-success");
  const orderSuccessDigitalPath = useStorefrontPath("order-success-digital", "/order-success/digital");
  const { items, subtotalAmount, subtotalLabel } = useCart();
  const { baseCurrency, currencyCode, formatBaseAmount, selectedRate } = useCurrency();
  const configuredCountries =
    navigationData?.storefrontConfig.shippingCountries
      ?.map((country) => ({ code: country.code, label: country.name }))
      ?.filter((country) => country.code && country.label) ?? [];
  const checkoutCountries = configuredCountries.length > 0 ? configuredCountries : FALLBACK_COUNTRIES;
  const defaultCountryCode = navigationData?.storefrontConfig.defaultCustomerCountry || checkoutCountries[0]?.code || "PL";
  const freeShippingZones = navigationData?.storefrontConfig.freeShippingZones ?? [];
  const checkoutPresentation = navigationData?.storefrontConfig.checkout;

  const virtualOnly = embedded ? config.mode === "digital" : checkoutStoreMode === "digital";
  
  // Detect if the actual cart contains only virtual products
  const actuallyVirtualOnly = isCartVirtual(items);
  // Use either the preview toggle or the actual detection
  const shouldHideShipping = virtualOnly || actuallyVirtualOnly;
  
  // Guest checkout setting from config (default: true, allow guests)
  const allowGuestCheckout = config["allow-guest-checkout"] !== "false";
  // If guest checkout is disabled, account creation is required
  const requireAccountCreation = !allowGuestCheckout;

  const [createAccount, setCreateAccount] = useState(requireAccountCreation);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [shipToDifferentAddress, setShipToDifferentAddress] = useState(false);
  const [couponVisible, setCouponVisible] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupons, setAppliedCoupons] = useState<string[]>([]);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);

  // Layout-studio-style page-local switches — content/positional options specific to
  // this page, not the site-wide chrome, so kept local rather than in
  // `LayoutPreferencesContext` (same pattern as the reading-list/wishlist/community
  // profile page-local view switches).
  const couponPosition: CouponPosition = embedded && config["coupon-position"] === "top" ? "top" : embedded ? "inline" : checkoutCouponPosition;
  const hideOptionalBillingFields = embedded ? config["hide-optional-billing-fields"] === "true" : checkoutHideOptionalBillingFields;
  const hideOptionalShippingFields = embedded ? config["hide-optional-shipping-fields"] === "true" : checkoutHideOptionalShippingFields;
  const showOrderNotes = embedded ? config["show-order-notes"] !== "false" : checkoutShowOrderNotes;
  const showTermsCheckbox = embedded ? config["show-terms"] !== "false" : checkoutShowTerms;
  const showPrivacyCheckbox = embedded ? config["show-privacy"] !== "false" : checkoutShowPrivacy;
  const paymentMethodsPosition: PaymentMethodsPosition = embedded && config["payment-position"] === "right" ? "right" : embedded ? "left" : checkoutPaymentPosition;
  const summaryPosition: SummaryPosition = embedded && config["summary-position"] === "static" ? "static" : embedded ? "sticky" : checkoutSummaryPosition;

  // Billing address fields kept in real controlled state (not the mockup's usual
  // uncontrolled `InputMock`s) because they're exactly what the WooCommerce Store
  // API's `checkout` route requires in `billing_address` to place a real order —
  // see `submitStripeCheckout`/`submitBlikCheckout` in `lib/payments.ts`.
  const [billingAddress, setBillingAddress] = useState({
    firstName: "",
    lastName: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    postcode: "",
    countryCode: defaultCountryCode,
  });
  const [billingEmail, setBillingEmail] = useState("");
  const [billingPhone, setBillingPhone] = useState("");
  const [billingErrors, setBillingErrors] = useState<Partial<Record<
    "firstName" | "lastName" | "address1" | "city" | "postcode" | "countryCode" | "phone" | "email" | "blikCode",
    string | undefined
  >>>({});

  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);

  const { completeCapture: completeAbandonedCartCapture } = useAbandonedCartTracking(
    billingEmail,
    agreedToPrivacy,
    baseCurrency,
  );

  useEffect(() => {
    if (marketingConsent && billingEmail.trim()) saveNewsletterEmail(billingEmail);
  }, [marketingConsent, billingEmail]);

  // Autofill checkout form with logged-in user data
  useEffect(() => {
    if (!isUserLoggedIn() || !isBackendConfigured) return;
    
    let cancelled = false;
    void getStorefrontAccount().then((account) => {
      if (!cancelled && account) {
        // Autofill email and phone
        setBillingEmail(account.email);
        setBillingPhone(account.billingAddress?.phone || "");
        
        // Autofill billing address
        setBillingAddress((prev) => ({
          ...prev,
          firstName: account.billingAddress?.firstName || account.firstName || prev.firstName,
          lastName: account.billingAddress?.lastName || account.lastName || prev.lastName,
          address1: account.billingAddress?.address1 || prev.address1,
          address2: account.billingAddress?.address2 || prev.address2,
          city: account.billingAddress?.city || prev.city,
          state: account.billingAddress?.state || prev.state,
          postcode: account.billingAddress?.postcode || prev.postcode,
          countryCode: account.billingAddress?.country?.toUpperCase() || prev.countryCode,
        }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const [shippingMethod, setShippingMethod] = useState<ShippingMethodId>("standard");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("stripe");
  const {
    isStripeGatewayEnabled,
    isBlikAvailable,
    isCryptoAvailable,
    cryptoGatewayTitle,
    cryptoGatewayDescription,
    cryptoAssets,
    isCodAvailable,
    isBacsAvailable,
    isCheckAvailable,
  } = usePaymentGateways(currencyCode);

  useEffect(() => {
    if (!billingAddress.countryCode && defaultCountryCode) {
      setBillingAddress((previous) => ({ ...previous, countryCode: defaultCountryCode }));
    }
  }, [billingAddress.countryCode, defaultCountryCode]);
  
  useEffect(() => {
    if (paymentMethod === "blik" && !isBlikAvailable) setPaymentMethod("stripe");
  }, [paymentMethod, isBlikAvailable]);
  useEffect(() => {
    if (paymentMethod === "crypto" && isBackendConfigured && !isCryptoAvailable) setPaymentMethod("stripe");
  }, [paymentMethod, isCryptoAvailable]);
  useEffect(() => {
    if (paymentMethod === "bacs" && !isBacsAvailable) setPaymentMethod("stripe");
  }, [paymentMethod, isBacsAvailable]);
  useEffect(() => {
    if (paymentMethod === "cheque" && !isCheckAvailable) setPaymentMethod("stripe");
  }, [paymentMethod, isCheckAvailable]);
  useEffect(() => {
    if (paymentMethod === "cod" && (shouldHideShipping || !isCodAvailable)) setPaymentMethod(isBacsAvailable ? "bacs" : "stripe");
  }, [paymentMethod, shouldHideShipping, isCodAvailable, isBacsAvailable]);
  useEffect(() => {
    if (requireAccountCreation) setCreateAccount(true);
  }, [requireAccountCreation]);
  const [blikCode, setBlikCode] = useState("");
  const [blikSecondsLeft, setBlikSecondsLeft] = useState(BLIK_WINDOW_SECONDS);
  const [cryptoCoin, setCryptoCoin] = useState<CryptoCoin>("btc");
  const [cryptoSecondsLeft, setCryptoSecondsLeft] = useState(CRYPTO_RATE_WINDOW_SECONDS);
  const [cryptoAddressCopied, setCryptoAddressCopied] = useState(false);
  useEffect(() => {
    const availableCoins = cryptoAssets.length > 0 ? cryptoAssets.map((asset) => asset.code.toLowerCase()) : Object.keys(CRYPTO_COINS);
    if (!availableCoins.includes(cryptoCoin)) {
      setCryptoCoin(availableCoins[0] ?? "btc");
    }
  }, [cryptoAssets, cryptoCoin]);

  // Fetch shipping methods from backend based on billing address
  const shippingAddress: StoreApiAddress | null = billingAddress.countryCode
    ? {
        first_name: billingAddress.firstName,
        last_name: billingAddress.lastName,
        address_1: billingAddress.address1,
        address_2: billingAddress.address2,
        city: billingAddress.city,
        state: billingAddress.state,
        postcode: billingAddress.postcode,
        country: billingAddress.countryCode,
        email: billingEmail,
        phone: billingPhone,
      }
    : null;

  const { methods: backendShippingMethods, loading: shippingLoading, error: shippingError } = useShippingMethods(shippingAddress);
  const { taxTotal, taxLines, loading: taxLoading } = useTaxCalculation(shippingAddress);

  // Real 2-minute BLIK authorization countdown: resets to 02:00 every time BLIK becomes
  // the selected method (including re-selecting it after switching away), and only ticks
  // while BLIK stays selected — switching to another payment option pauses/resets it so
  // the clock doesn't keep running in the background against a hidden panel.
  useEffect(() => {
    if (paymentMethod !== "blik") {
      setBlikSecondsLeft(BLIK_WINDOW_SECONDS);
      return;
    }

    setBlikSecondsLeft(BLIK_WINDOW_SECONDS);
    const intervalId = window.setInterval(() => {
      setBlikSecondsLeft((previous) => Math.max(previous - 1, 0));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [paymentMethod]);

  // Same idea as the BLIK countdown above, but for the crypto exchange-rate lock —
  // also resets when switching between BTC/ETH since each coin quotes its own rate.
  useEffect(() => {
    setCryptoAddressCopied(false);

    if (paymentMethod !== "crypto") {
      setCryptoSecondsLeft(CRYPTO_RATE_WINDOW_SECONDS);
      return;
    }

    setCryptoSecondsLeft(CRYPTO_RATE_WINDOW_SECONDS);
    const intervalId = window.setInterval(() => {
      setCryptoSecondsLeft((previous) => Math.max(previous - 1, 0));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [paymentMethod, cryptoCoin]);

  function handleCopyCryptoAddress() {
    const address = getCryptoCoinDetails(cryptoCoin, cryptoAssets).address;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(address).catch(() => {});
    }
    setCryptoAddressCopied(true);
    window.setTimeout(() => setCryptoAddressCopied(false), 2000);
  }

  function updateBillingAddress<K extends keyof typeof billingAddress>(field: K, value: string) {
    const errorFieldMap: Partial<Record<keyof typeof billingAddress, keyof typeof billingErrors>> = {
      firstName: "firstName",
      lastName: "lastName",
      address1: "address1",
      city: "city",
      postcode: "postcode",
      countryCode: "countryCode",
    };
    setBillingAddress((previous) => ({ ...previous, [field]: value }));
    const errorField = errorFieldMap[field];
    if (errorField) {
      setBillingErrors((previous) => ({ ...previous, [errorField]: undefined }));
    }
  }

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError(null);
    const result = await checkoutApplyCoupon(couponCode.trim());
    setCouponLoading(false);
    if (result.ok) {
      setAppliedCoupons((prev) => [...new Set([...prev, couponCode.trim()])]);
      setCouponCode("");
    } else {
      setCouponError(result.error || "Failed to apply coupon");
    }
  }

  async function handleRemoveCoupon(code: string) {
    const result = await checkoutRemoveCoupon(code);
    if (result.ok) {
      setAppliedCoupons((prev) => prev.filter((c) => c !== code));
    }
  }

  // Real order submission — every live WooCommerce gateway that the backend exposes
  // through the Store API can be submitted here. Crypto still remains preview-only
  // until the custom gateway is fully validated on the live backend.
  async function handlePlaceOrder(event: MouseEvent<HTMLAnchorElement>) {
    const canSubmitRealOrder =
      isBackendConfigured &&
      (
        (paymentMethod === "stripe" && isStripeGatewayEnabled) ||
        (paymentMethod === "blik" && isBlikAvailable && isStripeGatewayEnabled) ||
        (paymentMethod === "crypto" && isCryptoAvailable) ||
        (paymentMethod === "bacs" && isBacsAvailable) ||
        (paymentMethod === "cod" && isCodAvailable) ||
        (paymentMethod === "cheque" && isCheckAvailable)
      );
    if (!canSubmitRealOrder) {
      if (isBackendConfigured) {
        event.preventDefault();
        setOrderError(
          paymentMethod === "crypto"
            ? "Crypto checkout is not currently available on this backend."
            : "The selected payment method is not currently available.",
        );
      }
      return;
    }

    event.preventDefault();
    setOrderError(null);

    const checkoutValidation = validateCheckoutForm({
      firstName: billingAddress.firstName,
      lastName: billingAddress.lastName,
      country: billingAddress.countryCode,
      address1: billingAddress.address1,
      city: billingAddress.city,
      state: billingAddress.state,
      postcode: billingAddress.postcode,
      phone: billingPhone,
      email: billingEmail,
      requiresShipping: !shouldHideShipping,
    });
    const nextBillingErrors = {
      firstName: checkoutValidation.errors.firstName,
      lastName: checkoutValidation.errors.lastName,
      address1: checkoutValidation.errors.address1,
      city: checkoutValidation.errors.city,
      postcode: checkoutValidation.errors.postcode,
      countryCode: checkoutValidation.errors.country,
      phone: checkoutValidation.errors.phone,
      email: checkoutValidation.errors.email,
      blikCode:
        paymentMethod === "blik" && !/^\d{6}$/.test(blikCode.trim())
          ? "BLIK code must be 6 digits"
          : undefined,
    };
    setBillingErrors(nextBillingErrors);
    if (!checkoutValidation.isValid || nextBillingErrors.blikCode) {
      setOrderError(
        nextBillingErrors.blikCode
          ? nextBillingErrors.blikCode
          : "Complete the required billing details before placing the order.",
      );
      return;
    }

    const billing: CheckoutBillingDetails = {
      firstName: billingAddress.firstName,
      lastName: billingAddress.lastName,
      addressLine1: billingAddress.address1,
      addressLine2: billingAddress.address2 || undefined,
      city: billingAddress.city,
      state: billingAddress.state || undefined,
      postcode: billingAddress.postcode,
      countryCode: billingAddress.countryCode,
      email: billingEmail,
      phone: billingPhone,
    };

    setOrderSubmitting(true);
    const syncResult = await syncCartToBackend(items, { force: true, verifyForCheckout: true });
    if (!syncResult.ok) {
      setOrderSubmitting(false);
      setOrderError(syncResult.error);
      return;
    }
    
    // Determine which payment method to use and submit with account creation options
    let result;
    if (paymentMethod === "blik") {
      result = await submitCheckoutWithAccount(billing, "stripe_blik", {
        createAccount,
        subscribeToNewsletter: marketingConsent,
        blikCode,
      });
    } else if (paymentMethod === "bacs") {
      result = await submitCheckoutWithAccount(billing, "bacs", {
        createAccount,
        subscribeToNewsletter: marketingConsent,
      });
    } else if (paymentMethod === "crypto") {
      result = await submitCheckoutWithAccount(billing, "funkycommerce_crypto", {
        createAccount,
        subscribeToNewsletter: marketingConsent,
        cryptoAssetCode: cryptoCoin.toUpperCase(),
      });
    } else if (paymentMethod === "stripe") {
      result = await submitCheckoutWithAccount(billing, "stripe", {
        createAccount,
        subscribeToNewsletter: marketingConsent,
      });
    } else if (paymentMethod === "cod") {
      result = await submitCheckoutWithAccount(billing, "cod", {
        createAccount,
        subscribeToNewsletter: marketingConsent,
      });
    } else if (paymentMethod === "cheque") {
      result = await submitCheckoutWithAccount(billing, "cheque", {
        createAccount,
        subscribeToNewsletter: marketingConsent,
      });
    } else {
      result = { ok: false as const, error: "Selected payment method is unavailable." };
    }
    
    setOrderSubmitting(false);

    if (result.ok) {
      completeAbandonedCartCapture();
      navigate(shouldHideShipping ? orderSuccessDigitalPath : orderSuccessPath, {
        state: { order: result.order },
      });
    } else {
      setOrderError(result.error);
    }
  }

  const displayShippingMethods = mapShippingOptionsToDisplayMethods(backendShippingMethods, FALLBACK_SHIPPING_METHODS);
  useEffect(() => {
    const backendSelected = displayShippingMethods.find((method) => method.selected);
    if (backendSelected && shippingMethod !== backendSelected.id) {
      setShippingMethod(backendSelected.id);
      return;
    }
    if (displayShippingMethods.length > 0 && !displayShippingMethods.some((method) => method.id === shippingMethod)) {
      setShippingMethod(displayShippingMethods[0].id);
    }
  }, [displayShippingMethods, shippingMethod]);
  const selectedShipping = displayShippingMethods.find((method) => method.id === shippingMethod) ?? displayShippingMethods[0];
  const resolvedFreeShipping = resolveFreeShippingThreshold(
    freeShippingZones,
    billingAddress.countryCode,
    defaultCountryCode,
    FREE_SHIPPING_THRESHOLD,
  );
  const freeShippingThreshold = resolvedFreeShipping.threshold;
  const freeShippingApplies =
    !shouldHideShipping &&
    (items.length === 0 || selectedShipping.price === 0 || (freeShippingThreshold !== null && subtotalAmount >= freeShippingThreshold));
  const shippingValue = shouldHideShipping ? 0 : freeShippingApplies ? 0 : selectedShipping.price;
  const remainingForFreeShipping = freeShippingThreshold !== null ? freeShippingThreshold - subtotalAmount : null;
  
  // Use backend tax value (as a string, needs parsing) or fall back to mockup calculation
  const taxValueStr = taxTotal || "0";
  const taxValue = parseFloat(taxValueStr) || (subtotalAmount - 0) * 0.1; // Fallback to 10% mock
  
  // Backend handles coupons and discount totals — we track applied coupons for UI
  // In a real implementation, the discount would come from the backend cart totals
  const discountValue = appliedCoupons.length > 0 ? Math.min(subtotalAmount * 0.1, 25) : 0;
  const totalValue = subtotalAmount - discountValue + shippingValue + taxValue;

  const summaryRows = [
    { label: "Subtotal", value: subtotalLabel },
    ...(appliedCoupons.length > 0 ? [{ label: "Discount", value: `-${formatBaseAmount(discountValue)}` }] : []),
    {
      label: "Shipping",
      value: shouldHideShipping ? "Digital delivery" : shippingValue === 0 ? "Free" : formatBaseAmount(shippingValue),
    },
    { label: "Tax", value: formatBaseAmount(taxValue) },
  ];

  const couponSection = (
    <CheckoutSection title="Have a coupon?" collapsible defaultOpen={couponVisible} onToggle={setCouponVisible}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <InputMock
            label="Coupon code"
            value={couponCode}
            onChange={(value) => {
              setCouponCode(value);
              setCouponError(null);
            }}
          />
        </div>
        <button
          type="button"
          onClick={handleApplyCoupon}
          disabled={couponLoading || !couponCode.trim()}
          className="mt-6 shrink-0 rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:border-brand-400 hover:text-brand-600 disabled:opacity-50 disabled:cursor-not-allowed dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-brand-500 dark:hover:text-brand-300"
        >
          {couponLoading ? "Applying..." : "Apply code"}
        </button>
      </div>
      {couponError ? (
        <p className="m-0 flex items-center gap-1.5 text-sm font-medium text-rose-600 dark:text-rose-400">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          {couponError}
        </p>
      ) : null}
      {appliedCoupons.length > 0 ? (
        <div className="grid gap-2.5 pt-2">
          {appliedCoupons.map((code) => (
            <p key={code} className="m-0 flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <span className="flex items-center gap-1.5">
                <Tag className="h-4 w-4" aria-hidden="true" />
                Coupon "{code}" applied
              </span>
              <button
                type="button"
                onClick={() => handleRemoveCoupon(code)}
                className="text-xs font-semibold text-emerald-600 underline hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-100"
              >
                Remove
              </button>
            </p>
          ))}
        </div>
      ) : null}
    </CheckoutSection>
  );

  const paymentSection = (
    <CheckoutSection title="Payment method">
      <div className="grid gap-2.5">
        <PaymentOption
          icon={<CreditCard className="h-5 w-5" aria-hidden="true" />}
          label="Pay online"
          description="Cards and other Stripe-supported online payment methods."
          checked={paymentMethod === "stripe"}
          onSelect={() => setPaymentMethod("stripe")}
        />
        {paymentMethod === "stripe" ? <StripeCardElement amount={totalValue * selectedRate} currency={currencyCode.toLowerCase()} /> : null}

        {isBlikAvailable ? (
          <>
            <PaymentOption
              icon={<img src="/icons/payment/blik.svg" alt="" width={20} height={20} className="h-5 w-5 object-contain" />}
              label="BLIK"
              description="Pay instantly in PLN with a 6-digit BLIK code via Stripe."
              checked={paymentMethod === "blik"}
              onSelect={() => setPaymentMethod("blik")}
            />
            {paymentMethod === "blik" ? (
              <div className="grid gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <InputMock
                  label="BLIK code"
                  value={blikCode}
                  onChange={(value) => {
                    setBlikCode(value.replace(/\D/g, "").slice(0, 6));
                    setBillingErrors((previous) => ({ ...previous, blikCode: undefined }));
                  }}
                  name="blikCode"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  helperText={`6-digit code, valid for ${formatCountdown(BLIK_WINDOW_SECONDS)}`}
                  error={billingErrors.blikCode}
                />
                <p className="m-0 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-sm font-semibold tabular-nums ${
                      blikSecondsLeft <= 20
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                        : "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                    }`}
                  >
                    {formatCountdown(blikSecondsLeft)}
                  </span>
                  {blikSecondsLeft > 0
                    ? "left to authorize the payment in your banking app after placing the order."
                    : "Code expired — place the order again to get a fresh authorization window."}
                </p>
              </div>
            ) : null}
          </>
        ) : null}

        {!isBackendConfigured || isCryptoAvailable ? (
          <>
            <PaymentOption
              icon={<Bitcoin className="h-5 w-5" aria-hidden="true" />}
              label={cryptoGatewayTitle}
              description={cryptoGatewayDescription}
              checked={paymentMethod === "crypto"}
              onSelect={() => setPaymentMethod("crypto")}
            />
            {paymentMethod === "crypto" ? (
              <CryptoPaymentPanel
                gatewayTitle={cryptoGatewayTitle}
                assets={cryptoAssets}
                coin={cryptoCoin}
                onCoinChange={setCryptoCoin}
                amountValue={totalValue}
                secondsLeft={cryptoSecondsLeft}
                addressCopied={cryptoAddressCopied}
                onCopyAddress={handleCopyCryptoAddress}
              />
            ) : null}
          </>
        ) : null}

        {isBacsAvailable ? (
          <>
            <PaymentOption
              icon={<Banknote className="h-5 w-5" aria-hidden="true" />}
              label="Direct bank transfer"
              description="Pay from your bank using WooCommerce's BACS instructions after placing the order."
              checked={paymentMethod === "bacs"}
              onSelect={() => setPaymentMethod("bacs")}
            />
            {paymentMethod === "bacs" ? (
              <div className="grid gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <p className="m-0 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                  Payment instructions
                </p>
                <p className="m-0 text-sm text-zinc-600 dark:text-zinc-400">
                  The live WooCommerce backend accepts BACS orders. After placing the order, customers continue to the
                  native order-received screen and confirmation email for the bank transfer details configured in WooCommerce.
                </p>
              </div>
            ) : null}
          </>
        ) : null}

        <PaymentOption
          icon={<Banknote className="h-5 w-5" aria-hidden="true" />}
          label="Payment upon delivery"
          description="Pay in cash when your order arrives."
          checked={paymentMethod === "cod"}
          onSelect={() => setPaymentMethod("cod")}
          disabled={shouldHideShipping || !isCodAvailable}
          disabledReason={shouldHideShipping ? "Not available for digital orders" : "Not available at this time"}
        />

        {isCheckAvailable ? (
          <PaymentOption
            icon={<Banknote className="h-5 w-5" aria-hidden="true" />}
            label="Bank cheque"
            description="Mail a cheque — your order ships once it clears."
            checked={paymentMethod === "cheque"}
            onSelect={() => setPaymentMethod("cheque")}
            disabled={shouldHideShipping}
            disabledReason="Not available for digital orders"
          />
        ) : null}
        
        {paymentMethod === "cheque" ? (
          <div className="grid gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="m-0 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
              Payment instructions
            </p>
            <p className="m-0 text-sm text-zinc-600 dark:text-zinc-400">
              This backend accepts cheque orders, but it does not expose public cheque account fields over GraphQL.
              After placing the order, customers continue to the native order-received screen and confirmation email
              for payment instructions.
            </p>
          </div>
        ) : null}
      </div>

      <p className="m-0 flex items-center justify-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        {checkoutPresentation?.trustMessage || "Transactions secured with SSL encryption"}
      </p>
      {checkoutPresentation?.supportMessage ? (
        <p className="m-0 text-center text-xs text-zinc-400 dark:text-zinc-500">
          {checkoutPresentation.supportUrl ? (
            <a href={checkoutPresentation.supportUrl} className="underline underline-offset-2 hover:text-brand-600 dark:hover:text-brand-400">
              {checkoutPresentation.supportMessage}
            </a>
          ) : checkoutPresentation.supportMessage}
        </p>
      ) : null}
    </CheckoutSection>
  );
  return (
    <div className="grid gap-8">
      <CheckoutStepper currentStep={2} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="grid gap-5">
            <div>
              <h1 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {checkoutPresentation?.heading || "Checkout"}
              </h1>
              {checkoutPresentation?.intro ? <p className="mb-0 mt-2 text-sm text-zinc-500 dark:text-zinc-400">{checkoutPresentation.intro}</p> : null}
            </div>

            {couponPosition === "top" ? couponSection : null}

            <CheckoutSection title="Billing details">
              <div className="grid gap-4 md:grid-cols-2">
                <InputMock
                label="First name"
                required
                value={billingAddress.firstName}
                onChange={(value) => updateBillingAddress("firstName", value)}
                name="billingFirstName"
                autoComplete="given-name"
                error={billingErrors.firstName}
              />
              <InputMock
                label="Last name"
                required
                value={billingAddress.lastName}
                onChange={(value) => updateBillingAddress("lastName", value)}
                name="billingLastName"
                autoComplete="family-name"
                error={billingErrors.lastName}
              />
              {!hideOptionalBillingFields ? <InputMock label="Company name" helperText="Optional" name="billingCompany" autoComplete="organization" /> : null}
              <CountrySelect
                label="Country / region"
                required
                value={billingAddress.countryCode}
                onChange={(value) => updateBillingAddress("countryCode", value)}
                options={checkoutCountries}
                name="billingCountry"
                autoComplete="country"
                error={billingErrors.countryCode}
              />
            </div>
            {!shouldHideShipping ? (
              <div className="grid gap-4">
                <InputMock
                  label="Street address"
                  required
                  helperText="House number and street name"
                  value={billingAddress.address1}
                  onChange={(value) => updateBillingAddress("address1", value)}
                  name="billingAddressLine1"
                  autoComplete="address-line1"
                  error={billingErrors.address1}
                />
                {!hideOptionalBillingFields ? (
                  <InputMock
                    label="Apartment, suite, unit etc."
                    helperText="Optional"
                    value={billingAddress.address2}
                    onChange={(value) => updateBillingAddress("address2", value)}
                    name="billingAddressLine2"
                    autoComplete="address-line2"
                  />
                ) : null}
                <div className="grid gap-4 md:grid-cols-3">
                  <InputMock
                    label="Town / city"
                    required
                    value={billingAddress.city}
                    onChange={(value) => updateBillingAddress("city", value)}
                    name="billingCity"
                    autoComplete="address-level2"
                    error={billingErrors.city}
                  />
                  <InputMock
                    label="State / county"
                    required
                    value={billingAddress.state}
                    onChange={(value) => updateBillingAddress("state", value)}
                    name="billingState"
                    autoComplete="address-level1"
                  />
                  <InputMock
                    label="Postcode / ZIP"
                    required
                    value={billingAddress.postcode}
                    onChange={(value) => updateBillingAddress("postcode", value)}
                    name="billingPostcode"
                    autoComplete="postal-code"
                    error={billingErrors.postcode}
                  />
                </div>
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <InputMock
                label="Phone"
                type="tel"
                required
                value={billingPhone}
                onChange={(value) => {
                  setBillingPhone(value);
                  setBillingErrors((previous) => ({
                    ...previous,
                    phone: value.trim().length > 0 && !isValidPhone(value) ? "Phone is not a valid phone number" : undefined,
                  }));
                }}
                name="billingPhone"
                autoComplete="tel"
                inputMode="tel"
                error={billingErrors.phone}
              />
              <InputMock
                label="Email address"
                type="email"
                required
                value={billingEmail}
                onChange={(value) => {
                  setBillingEmail(value);
                  saveCheckoutEmail(value);
                  setBillingErrors((previous) => ({
                    ...previous,
                    email: value.trim().length > 0 && !isValidEmail(value) ? "Email is not a valid email address" : undefined,
                  }));
                }}
                name="billingEmail"
                autoComplete="email"
                inputMode="email"
                error={billingErrors.email}
              />
            </div>
          </CheckoutSection>

          {shouldHideShipping ? (
            <div className="flex items-start gap-3 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
              <PackageCheck className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
              <p className="m-0">
                <strong>Digital delivery.</strong> Your purchase is delivered instantly via the website after payment —
                no shipping address or shipping method needed.
              </p>
            </div>
          ) : null}

          {couponPosition === "inline" ? couponSection : null}

          {allowGuestCheckout ? (
            <CheckoutSection title="Account">
              <label className="flex items-center gap-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={createAccount}
                  onChange={(event) => setCreateAccount(event.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-950"
                />
                Create an account?
              </label>
              {createAccount ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <InputMock label="Username" required name="accountUsername" autoComplete="username" />
                  <InputMock label="Password" type="password" required name="accountPassword" autoComplete="new-password" />
                </div>
              ) : null}
              <label className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(event) => setMarketingConsent(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-brand-600 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <span>{checkoutPresentation?.marketingLabel || "Keep me posted about new drops, offers, and restocks by email."}</span>
              </label>
            </CheckoutSection>
          ) : (
            <CheckoutSection title="Account">
              <p className="m-0 text-sm text-zinc-600 dark:text-zinc-400">
                An account will be created with your email address during checkout.
              </p>
              <label className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(event) => setMarketingConsent(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-brand-600 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <span>{checkoutPresentation?.marketingLabel || "Keep me posted about new drops, offers, and restocks by email."}</span>
              </label>
            </CheckoutSection>
          )}

          {!shouldHideShipping ? (
            <CheckoutSection title="Delivery">
              <label className="flex items-center gap-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={shipToDifferentAddress}
                  onChange={(event) => setShipToDifferentAddress(event.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-950"
                />
                Ship to a different address?
              </label>
              {shipToDifferentAddress ? (
                <div className="grid gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="grid gap-4 md:grid-cols-2">
                    <InputMock label="First name" required />
                    <InputMock label="Last name" required />
                  </div>
                  {!hideOptionalShippingFields ? <InputMock label="Company name" helperText="Optional" /> : null}
                  <CountrySelect label="Country / region" required options={checkoutCountries} name="shippingCountry" autoComplete="shipping country" />
                  <InputMock label="Street address" required name="shippingAddressLine1" autoComplete="shipping address-line1" />
                  {!hideOptionalShippingFields ? <InputMock label="Apartment, suite, unit etc." helperText="Optional" name="shippingAddressLine2" autoComplete="shipping address-line2" /> : null}
                  <div className="grid gap-4 md:grid-cols-3">
                    <InputMock label="Town / city" required name="shippingCity" autoComplete="shipping address-level2" />
                    <InputMock label="State / county" required name="shippingState" autoComplete="shipping address-level1" />
                    <InputMock label="Postcode / ZIP" required name="shippingPostcode" autoComplete="shipping postal-code" />
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2.5 pt-2">
                <span className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Shipping method</span>
                {shippingLoading ? (
                  <p className="m-0 text-xs text-zinc-500 dark:text-zinc-400">Loading live shipping methods…</p>
                ) : null}
                {shippingError ? (
                  <p className="m-0 text-xs text-amber-600 dark:text-amber-400">
                    {shippingError}
                  </p>
                ) : null}
                {displayShippingMethods.map((method) => {
                const isFreeForMethod = freeShippingApplies || method.price === 0;
                return (
                    <label
                      key={method.id}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 transition hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 dark:border-zinc-700 dark:text-zinc-200 dark:has-[:checked]:bg-brand-950/40"
                    >
                      <span className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="shippingMethod"
                          checked={shippingMethod === method.id}
                          onChange={() => setShippingMethod(method.id)}
                          disabled={method.disabled}
                          className="accent-brand-600"
                        />
                        <span>
                          {method.label}
                          <span className="ml-2 font-normal text-zinc-400 dark:text-zinc-500">{method.eta}</span>
                        </span>
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {isFreeForMethod ? "Free" : formatBaseAmount(method.price)}
                      </span>
                    </label>
                  );
                })}
              </div>

              {remainingForFreeShipping !== null && remainingForFreeShipping > 0 ? (
                <Link
                  to={cartPath}
                  className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-xs font-medium text-brand-700 no-underline transition hover:bg-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20"
                >
                  <Truck className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>
                    <strong>{formatBaseAmount(remainingForFreeShipping)}</strong>{" "}
                    left to free standard shipping — back to cart
                  </span>
                </Link>
              ) : null}
            </CheckoutSection>
          ) : null}

          {showOrderNotes ? (
            <CheckoutSection title="Order notes">
              <InputMock label="Notes about your order" helperText="Optional — e.g. delivery instructions" multiline rows={3} name="orderNotes" autoComplete="off" />
            </CheckoutSection>
          ) : null}

          {paymentMethodsPosition === "left" ? paymentSection : null}
          </section>

        <div className="grid gap-6">
          {paymentMethodsPosition === "right" ? paymentSection : null}

          <OrderSummaryCard
            title="Review order"
            lineItems={items.map((item) => ({
              id: item.id,
              name: item.name,
              variant: item.variantLabel ?? "",
              quantity: item.quantity,
              price: item.priceLabel,
            }))}
            freeShippingNotice={
              !shouldHideShipping && remainingForFreeShipping !== null && remainingForFreeShipping > 0
                ? { remainingLabel: formatBaseAmount(remainingForFreeShipping), href: cartPath, actionLabel: "back to cart" }
                : undefined
            }
            rows={summaryRows}
            total={formatBaseAmount(totalValue)}
            ctaHref={shouldHideShipping ? orderSuccessDigitalPath : orderSuccessPath}
            ctaLabel={checkoutPresentation?.submitLabel || "Place order"}
            ctaDisabled={(showTermsCheckbox && !agreedToTerms) || (showPrivacyCheckbox && !agreedToPrivacy)}
            onCtaClick={handlePlaceOrder}
            ctaBusy={orderSubmitting}
            position={summaryPosition}
            beforeCta={
              <div className="mt-4 grid gap-2.5 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                {orderError ? (
                  <p className="m-0 flex items-start gap-1.5 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {orderError}
                  </p>
                ) : null}
                {showTermsCheckbox ? (
                  <label className="flex cursor-pointer items-start gap-2.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <input
                      type="checkbox"
                      checked={agreedToTerms}
                      onChange={(event) => setAgreedToTerms(event.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-brand-600 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <span>
                      I have read and agree to the website's{" "}
                      <a href="#terms" className="font-medium text-brand-600 underline underline-offset-2 dark:text-brand-400">
                        terms and conditions
                      </a>
                      <span aria-hidden="true"> *</span>
                    </span>
                  </label>
                ) : null}
                {showPrivacyCheckbox ? (
                  <label className="flex cursor-pointer items-start gap-2.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <input
                      type="checkbox"
                      checked={agreedToPrivacy}
                      onChange={(event) => setAgreedToPrivacy(event.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-brand-600 focus:ring-brand-500 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <span>
                      I consent to my personal data being processed as described in the{" "}
                      <a href="#privacy" className="font-medium text-brand-600 underline underline-offset-2 dark:text-brand-400">
                        privacy policy
                      </a>
                      <span aria-hidden="true"> *</span>
                    </span>
                  </label>
                ) : null}
                {checkoutPresentation?.termsMessage ? (
                  <p className="m-0 text-[11px] leading-5 text-zinc-400 dark:text-zinc-500">{checkoutPresentation.termsMessage}</p>
                ) : null}
              </div>
            }
          />
        </div>
      </div>
    </div>
  );
}

function CheckoutStepper({ currentStep }: { currentStep: number }) {
  // Payment happens inline on this same page (no separate "Payment" step) — it's
  // selected and completed as part of "Checkout" below, right before confirmation.
  const steps = ["Cart", "Checkout", "Confirmation"];
  return (
    <nav aria-label="Checkout progress" className="flex items-center justify-center gap-2 sm:gap-4">
      {steps.map((step, index) => {
        const stepNumber = index + 1;
        const isComplete = stepNumber < currentStep;
        const isActive = stepNumber === currentStep;
        return (
          <div key={step} className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2">
              <span
                className={[
                  "inline-grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition",
                  isComplete
                    ? "bg-brand-gradient text-white"
                    : isActive
                      ? "border-2 border-brand-500 text-brand-600 dark:text-brand-400"
                      : "border border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500",
                ].join(" ")}
              >
                {isComplete ? "✓" : stepNumber}
              </span>
              <span
                className={[
                  "hidden text-sm font-medium sm:inline",
                  isActive || isComplete ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400 dark:text-zinc-500",
                ].join(" ")}
              >
                {step}
              </span>
            </div>
            {stepNumber < steps.length ? (
              <span className={`h-px w-6 sm:w-12 ${isComplete ? "bg-brand-500" : "bg-zinc-200 dark:bg-zinc-800"}`} aria-hidden="true" />
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

function CheckoutSection({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
  onToggle,
}: {
  title: string;
  children: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isOpen = collapsible ? open : true;

  return (
    <section className="grid gap-4 rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-soft dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      {collapsible ? (
        <button
          type="button"
          onClick={() => {
            const next = !open;
            setOpen(next);
            onToggle?.(next);
          }}
          className="flex items-center justify-between gap-2 text-left"
        >
          <span className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      ) : (
        <h2 className="m-0 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</h2>
      )}
      {isOpen ? children : null}
    </section>
  );
}

function CountrySelect({
  label,
  required = false,
  value,
  onChange,
  options = FALLBACK_COUNTRIES,
  name,
  autoComplete,
  error,
}: {
  label: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  options?: { code: string; label: string }[];
  name?: string;
  autoComplete?: string;
  error?: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
      <span>
        {label}
        {required ? <span className="ml-0.5 text-rose-500">*</span> : null}
      </span>
      <select
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        name={name}
        autoComplete={autoComplete}
        required={required}
        aria-invalid={Boolean(error)}
        className={`rounded-xl border bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:ring-4 dark:bg-zinc-950 dark:text-zinc-100 ${
          error
            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100 dark:border-rose-500/60 dark:focus:ring-rose-950"
            : "border-zinc-200 focus:border-brand-400 focus:ring-brand-100 dark:border-zinc-700 dark:focus:border-brand-500 dark:focus:ring-brand-950"
        }`}
      >
        <option value="">Select a country…</option>
        {options.map((country) => (
          <option key={country.code} value={country.code}>
            {country.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">{error}</span> : null}
    </label>
  );
}

function PaymentOption({
  icon,
  label,
  description,
  checked,
  onSelect,
  disabled = false,
  disabledReason,
}: {
  icon: ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onSelect: () => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <label
      className={[
        "flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition",
        disabled
          ? "cursor-not-allowed border-zinc-100 text-zinc-350 opacity-60 dark:border-zinc-800/60 dark:text-zinc-600"
          : "cursor-pointer border-zinc-200 text-zinc-700 hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50 dark:border-zinc-700 dark:text-zinc-200 dark:has-[:checked]:bg-brand-950/40",
      ].join(" ")}
    >
      <input
        type="radio"
        name="paymentMethod"
        checked={checked}
        onChange={onSelect}
        disabled={disabled}
        className="mt-1 accent-brand-600"
      />
      <span className="mt-0.5 text-zinc-500 dark:text-zinc-400">{icon}</span>
      <span className="grid gap-0.5">
        <span>{label}</span>
        <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">{disabled ? disabledReason : description}</span>
      </span>
    </label>
  );
}

/** Real `@stripe/react-stripe-js` Payment Element — no hardcoded card/expiry/CVC
 * inputs. Uses Stripe's "deferred" Elements mode (`mode: "payment"` + `amount` +
 * `currency`, no `clientSecret` needed up front) so the actual card UI can render
 * without a backend having created a PaymentIntent yet — only *confirming* the
 * payment would require one, and this mockup has no backend to do that. If no
 * publishable key is configured, falls back to a setup notice instead of a broken
 * or blank form. */
function StripeCardElement({ amount, currency }: { amount: number; currency: string }) {
  const publishableKey = getStripePublishableKey();
  const stripePromise = useMemo(() => getStripe(), [publishableKey]);

  if (!isStripeConfigured() || !stripePromise) {
    return (
      <div className="grid gap-2 rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        <p className="m-0 flex items-center gap-1.5 font-medium text-zinc-600 dark:text-zinc-300">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          Stripe isn't connected yet
        </p>
        <p className="m-0">
          Configure the Stripe publishable key in WooCommerce or set{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">VITE_STRIPE_PUBLISHABLE_KEY</code>{" "}
          to render the real Stripe card form here once a backend can create payment intents.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <Elements
        stripe={stripePromise}
        options={{
          mode: "payment",
          amount: Math.max(Math.round(amount * 100), 50),
          currency,
          appearance: { theme: "stripe" },
        }}
      >
        <PaymentElement />
      </Elements>
      <p className="m-0 flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Powered by Stripe — card details are never stored on our servers.
      </p>
    </div>
  );
}

function getCryptoCoinDetails(coin: string, assets: CryptoAsset[]) {
  const configuredAsset = assets.find((asset) => asset.code.toLowerCase() === coin.toLowerCase());
  if (configuredAsset) {
    return {
      label: configuredAsset.label,
      ticker: configuredAsset.code.toUpperCase(),
      network: configuredAsset.network,
      address: configuredAsset.wallet,
      usdRate: configuredAsset.fiatRate > 0 ? configuredAsset.fiatRate : 1,
      qrUrl: configuredAsset.qrUrl ?? undefined,
    };
  }

  return CRYPTO_COINS[coin] ?? CRYPTO_COINS.btc;
}

/** Preview-only crypto invoice panel — now mirrors the configured gateway wallets when
 * the backend exposes them, while keeping local fallback data for pure mockup mode. */
function CryptoPaymentPanel({
  gatewayTitle,
  assets,
  coin,
  onCoinChange,
  amountValue,
  secondsLeft,
  addressCopied,
  onCopyAddress,
}: {
  gatewayTitle: string;
  assets: CryptoAsset[];
  coin: CryptoCoin;
  onCoinChange: (coin: CryptoCoin) => void;
  amountValue: number;
  secondsLeft: number;
  addressCopied: boolean;
  onCopyAddress: () => void;
}) {
  const details = getCryptoCoinDetails(coin, assets);
  const availableCoins = assets.length > 0 ? assets.map((asset) => asset.code.toLowerCase()) : Object.keys(CRYPTO_COINS);
  const cryptoAmount = (amountValue / details.usdRate).toFixed(6);

  return (
    <div className="grid gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="grid gap-1">
        <p className="m-0 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{gatewayTitle}</p>
        <p className="m-0 text-xs text-zinc-500 dark:text-zinc-400">Use the configured store wallet below to complete the transfer.</p>
      </div>
      <div className="inline-flex w-fit gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-800/60">
        {availableCoins.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => onCoinChange(id)}
            aria-pressed={coin === id}
            className={[
              "rounded-full px-3 py-1 text-xs font-semibold transition",
              coin === id
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-900 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200",
            ].join(" ")}
          >
            {getCryptoCoinDetails(id, assets).ticker}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-[auto,1fr] sm:items-center">
        {details.qrUrl ? (
          <img
            src={details.qrUrl}
            alt={`${details.label} payment QR code`}
            width={112}
            height={112}
            className="h-28 w-28 rounded-xl border border-zinc-200 object-cover dark:border-zinc-800"
            loading="lazy"
          />
        ) : (
          <div
            className="grid h-28 w-28 shrink-0 place-items-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-600"
            aria-hidden="true"
          >
            <QrCode className="h-12 w-12" />
          </div>
        )}

        <div className="grid gap-1">
          <p className="m-0 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Send exactly</p>
          <p className="m-0 font-mono text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
            {cryptoAmount} {details.ticker}
          </p>
          <p className="m-0 text-xs text-zinc-500 dark:text-zinc-400">via the {details.network}</p>
        </div>
      </div>

      <div className="grid gap-1.5">
        <p className="m-0 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{details.label} address</p>
        <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
          <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs text-zinc-700 dark:text-zinc-300">
            {details.address}
          </code>
          <button
            type="button"
            onClick={onCopyAddress}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
          >
            {addressCopied ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}
            {addressCopied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <p className="m-0 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span
          className={`rounded-full px-2 py-0.5 font-mono text-sm font-semibold tabular-nums ${
            secondsLeft <= 60
              ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
              : "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
          }`}
        >
          {formatCountdown(secondsLeft)}
        </span>
        {secondsLeft > 0
          ? "left to send the payment at this locked exchange rate."
          : "Rate expired — switch coins or reselect crypto to lock a fresh quote."}
      </p>

      <p className="m-0 flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        The order stays on hold until the wallet transfer is verified by the store.
      </p>
    </div>
  );
}
