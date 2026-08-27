import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { AlertTriangle, Banknote, Check, ChevronDown, Copy, CreditCard, PackageCheck, QrCode, ShieldCheck, Tag, Truck } from "lucide-react";
import { CurrencyMark, normalizeLanguagePath, useCart, useCurrency, useLanguage, useLayoutPreferences, useT } from "@funky/ui";
import { StandaloneApplicationNotice, useApplicationShortcode, useEmbeddedApplicationShortcode } from "../components/applicationShortcodes";
import { saveCheckoutEmail, saveNewsletterEmail, useAbandonedCartPublicConfig, useAbandonedCartTracking } from "../lib/abandonedCart";
import { syncCartToBackend } from "../lib/backendCart";
import { checkoutApplyCoupon, checkoutRemoveCoupon, DEFAULT_FREE_SHIPPING_METHOD, isDigitalOnlyCart, mapShippingOptionsToDisplayMethods, resolveFreeShippingThreshold, type DisplayShippingMethod, useCheckoutCart } from "../lib/checkout";
import { isBackendConfigured } from "@funky/sdk";
import { useStorefrontPath } from "../lib/storefrontPaths";
import { getStripe, getStripePublishableKey, isStripeConfigured } from "../lib/stripe";
import {
  completeBlikPayment,
  completeStripePayment,
  createBlikPaymentMethod,
  submitCheckoutWithAccount,
  toStripeBillingDetails,
  usePaymentGateways,
  type CheckoutBillingDetails,
  type CryptoAsset,
  type PaymentSubmissionResult,
} from "../lib/payments";
import {
  withDigitalCheckoutAddress,
  withDigitalStoreApiAddress,
} from "../lib/checkoutContext";
import { login, useIsUserLoggedIn } from "../lib/auth";
import { getStorefrontAccount } from "../lib/account";
import { claimCheckoutOrder } from "../lib/checkoutAccount";
import { createOrderConfirmation, saveOrderConfirmation } from "../lib/orderConfirmation";
import { storeApiAmount } from "../lib/storeApiMoney";
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
type AddressFormState = {
  firstName: string;
  lastName: string;
  company: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postcode: string;
  countryCode: string;
};
type CheckoutFieldErrors = Partial<Record<
  "firstName" | "lastName" | "address1" | "city" | "state" | "postcode" | "countryCode" | "phone" | "email" | "blikCode" | "accountUsername" | "accountPassword",
  string | undefined
>>;
type StripePaymentController = {
  createPaymentMethod: (
    billing: CheckoutBillingDetails,
  ) => Promise<{ paymentMethodId: string; selectedPaymentType: string }>;
};

const BLIK_WINDOW_SECONDS = 120;
const BLIK_RENDERED_HEIGHT_PX = 33.28;
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
  const t = useT();
  const embedded = useEmbeddedApplicationShortcode();
  if (!embedded) {
    return <StandaloneApplicationNotice shortcode="checkout" />;
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
  const abandonedCartConfig = useAbandonedCartPublicConfig();
  const config = useApplicationShortcode(["funkycommerce_checkout", "woocommerce_checkout"], {
    "allow-guest-checkout": "true",
  });
  const navigate = useNavigate();
  const cartPath = useStorefrontPath("cart", "/cart");
  const orderSuccessPath = useStorefrontPath("order-success", "/order-success");
  const { configuredLanguageCodes, languageCode, languageBackendCode } = useLanguage();
  const orderSuccessDigitalPath = normalizeLanguagePath(
    "/order-success/digital",
    languageCode,
    configuredLanguageCodes,
  );
  const { items, subtotalAmount, subtotalLabel, isHydrated: isCartHydrated, clear: clearCart } = useCart();
  const { baseCurrency, currencyCode, formatBaseAmount, selectedRate } = useCurrency();
  const isLoggedIn = useIsUserLoggedIn();
  const orderCompletedRef = useRef(false);
  useEffect(() => {
    if (!orderCompletedRef.current && isCartHydrated && items.length === 0) {
      navigate(cartPath, { replace: true });
    }
  }, [cartPath, isCartHydrated, items.length, navigate]);
  const configuredCountries =
    navigationData?.storefrontConfig.shippingCountries
      ?.map((country) => ({ code: country.code, label: country.name }))
      ?.filter((country) => country.code && country.label) ?? [];
  const checkoutCountries = configuredCountries.length > 0 ? configuredCountries : FALLBACK_COUNTRIES;
  const defaultCountryCode = navigationData?.storefrontConfig.defaultCustomerCountry || checkoutCountries[0]?.code || "PL";
  const freeShippingZones = navigationData?.storefrontConfig.freeShippingZones ?? [];
  const checkoutPresentation = navigationData?.storefrontConfig.checkout;
  const marketingConsentLabel = checkoutPresentation?.marketingLabel || t("checkout.marketing_consent");
  const couponCopy = useMemo(() => ({
    title: t("checkout.coupon.title"),
    label: t("checkout.coupon.label"),
    apply: t("checkout.coupon.apply"),
  }), [t]);

  const accountMode = checkoutPresentation?.accountMode
    ?? (config["allow-guest-checkout"] === "false" ? "required" : "optional");
  const requireAccountCreation = accountMode === "required" && !isLoggedIn;

  const [createAccount, setCreateAccount] = useState(requireAccountCreation);
  const [accountUsername, setAccountUsername] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  useEffect(() => {
    if (accountMode === "required") {
      setCreateAccount(true);
    } else if (accountMode === "guest") {
      setCreateAccount(false);
    }
  }, [accountMode]);
  const [abandonedCartConsentAccepted, setAbandonedCartConsentAccepted] = useState(false);
  const [shipToDifferentAddress, setShipToDifferentAddress] = useState(false);
  const [couponVisible, setCouponVisible] = useState(true);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupons, setAppliedCoupons] = useState<string[]>([]);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);

  const couponPosition: CouponPosition = checkoutCouponPosition;
  const hideOptionalBillingFields = checkoutHideOptionalBillingFields;
  const hideOptionalShippingFields = checkoutHideOptionalShippingFields;
  const showOrderNotes = checkoutShowOrderNotes;
  const showTermsCheckbox = checkoutShowTerms;
  const showPrivacyCheckbox = checkoutShowPrivacy;
  const paymentMethodsPosition: PaymentMethodsPosition = checkoutPaymentPosition;
  const summaryPosition: SummaryPosition = checkoutSummaryPosition;

  // Billing address fields kept in real controlled state (not the mockup's usual
  // uncontrolled `InputMock`s) because they're exactly what the WooCommerce Store
  // API's `checkout` route requires in `billing_address` to place a real order —
  // see `submitStripeCheckout`/`submitBlikCheckout` in `lib/payments.ts`.
  const [billingAddress, setBillingAddress] = useState<AddressFormState>({
    firstName: "",
    lastName: "",
    company: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    postcode: "",
    countryCode: defaultCountryCode,
  });
  const [deliveryAddress, setDeliveryAddress] = useState<AddressFormState>({
    firstName: "",
    lastName: "",
    company: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    postcode: "",
    countryCode: defaultCountryCode,
  });
  const [billingEmail, setBillingEmail] = useState("");
  const [billingPhone, setBillingPhone] = useState("");
  const [billingErrors, setBillingErrors] = useState<CheckoutFieldErrors>({});
  const [deliveryErrors, setDeliveryErrors] = useState<CheckoutFieldErrors>({});
  const [orderNotes, setOrderNotes] = useState("");

  const [orderSubmitting, setOrderSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const stripePaymentControllerRef = useRef<StripePaymentController | null>(null);
  const registerStripePaymentController = useCallback((controller: StripePaymentController | null) => {
    stripePaymentControllerRef.current = controller;
  }, []);

  const abandonedCartConsentRequired = abandonedCartConfig.loaded
    ? Boolean(abandonedCartConfig.config?.checkout.required)
    : false;
  const abandonedCartConsentLabel =
    abandonedCartConfig.config?.checkout.consentLabel ||
    (abandonedCartConfig.config?.checkout.mode === "legitimate_interest"
      ? "We will use your checkout email under legitimate interests to recover your cart."
      : "I consent to abandoned-cart recovery emails.");
  const abandonedCartTrackingConsent = abandonedCartConfig.loaded
    ? (abandonedCartConsentRequired ? abandonedCartConsentAccepted : true)
    : false;
  const { completeCapture: completeAbandonedCartCapture } = useAbandonedCartTracking(
    billingEmail,
    abandonedCartTrackingConsent,
    baseCurrency,
  );

  useEffect(() => {
    if (marketingConsent && billingEmail.trim()) saveNewsletterEmail(billingEmail);
  }, [marketingConsent, billingEmail]);

  // Autofill checkout form with logged-in user data
  useEffect(() => {
    if (!isLoggedIn || !isBackendConfigured) return;
    
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
          company: account.billingAddress?.company || prev.company,
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
  }, [isLoggedIn]);

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

  // BTC/ETH are checkout-currency options (see `CurrencyContext`'s crypto formatting),
  // not ISO-4217 codes Stripe (or any of the other fiat-rail gateways) can process.
  // When one of these is selected as the storefront currency, every fiat payment
  // method must fall back to inactive and only the crypto wallet method remains usable.
  const isCryptoOnlyCurrency = ["BTC", "ETH"].includes(currencyCode.trim().toUpperCase());

  useEffect(() => {
    if (!billingAddress.countryCode && defaultCountryCode) {
      setBillingAddress((previous) => ({ ...previous, countryCode: defaultCountryCode }));
    }
    if (!deliveryAddress.countryCode && defaultCountryCode) {
      setDeliveryAddress((previous) => ({ ...previous, countryCode: defaultCountryCode }));
    }
  }, [billingAddress.countryCode, defaultCountryCode, deliveryAddress.countryCode]);
  
  useEffect(() => {
    if (isCryptoOnlyCurrency) {
      if (paymentMethod !== "crypto") setPaymentMethod("crypto");
      return;
    }
    if (paymentMethod === "blik" && !isBlikAvailable) setPaymentMethod("stripe");
  }, [paymentMethod, isBlikAvailable, isCryptoOnlyCurrency]);
  useEffect(() => {
    if (paymentMethod === "crypto" && !isCryptoOnlyCurrency && isBackendConfigured && !isCryptoAvailable) setPaymentMethod("stripe");
  }, [paymentMethod, isCryptoAvailable, isCryptoOnlyCurrency]);
  useEffect(() => {
    if (isCryptoOnlyCurrency) return;
    if (paymentMethod === "bacs" && !isBacsAvailable) setPaymentMethod("stripe");
  }, [paymentMethod, isBacsAvailable, isCryptoOnlyCurrency]);
  useEffect(() => {
    if (isCryptoOnlyCurrency) return;
    if (paymentMethod === "cheque" && !isCheckAvailable) setPaymentMethod("stripe");
  }, [paymentMethod, isCheckAvailable, isCryptoOnlyCurrency]);
  // Every other gateway falls back to "stripe" when it becomes unavailable, so the
  // "Pay online" option must fall back to the next real gateway when the backend
  // reports its Stripe gateway isn't configured/enabled — otherwise the checkout is
  // stuck on a hidden, unselectable payment method.
  useEffect(() => {
    if (isCryptoOnlyCurrency || !isBackendConfigured || isStripeGatewayEnabled) return;
    if (paymentMethod !== "stripe" && paymentMethod !== "blik") return;
    if (isBacsAvailable) setPaymentMethod("bacs");
    else if (isCheckAvailable) setPaymentMethod("cheque");
    else if (isCodAvailable) setPaymentMethod("cod");
    else if (isCryptoAvailable) setPaymentMethod("crypto");
  }, [
    paymentMethod,
    isBackendConfigured,
    isStripeGatewayEnabled,
    isBacsAvailable,
    isCheckAvailable,
    isCodAvailable,
    isCryptoAvailable,
    isCryptoOnlyCurrency,
  ]);
  useEffect(() => {
    setCreateAccount(requireAccountCreation);
  }, [isLoggedIn, requireAccountCreation]);
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

  const rawBillingStoreAddress: StoreApiAddress | null = billingAddress.countryCode
    ? {
        first_name: billingAddress.firstName,
        last_name: billingAddress.lastName,
        company: billingAddress.company,
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
  const cartAppearsDigital =
    checkoutStoreMode === "digital" || isDigitalOnlyCart(null, items);
  const billingStoreAddress = rawBillingStoreAddress && cartAppearsDigital
    ? withDigitalStoreApiAddress(rawBillingStoreAddress)
    : rawBillingStoreAddress;
  const deliveryStoreAddress: StoreApiAddress | null =
    shipToDifferentAddress && deliveryAddress.countryCode
      ? {
          first_name: deliveryAddress.firstName,
          last_name: deliveryAddress.lastName,
          company: deliveryAddress.company,
          address_1: deliveryAddress.address1,
          address_2: deliveryAddress.address2,
          city: deliveryAddress.city,
          state: deliveryAddress.state,
          postcode: deliveryAddress.postcode,
          country: deliveryAddress.countryCode,
        }
      : billingStoreAddress;
  const cartRevision = items.map((item) => `${item.id}:${item.quantity}`).join("|");
  const {
    cart: checkoutCart,
    methods: backendShippingMethods,
    totals: checkoutTotals,
    coupons: backendCoupons,
    loading: shippingLoading,
    error: shippingError,
    syncedCartRevision,
    adoptCart: adoptCheckoutCart,
    selectMethod: selectCheckoutShippingMethod,
  } = useCheckoutCart(billingStoreAddress, deliveryStoreAddress, cartRevision, items);
  const shouldHideShipping = checkoutStoreMode === "digital" || isDigitalOnlyCart(checkoutCart, items);
  useEffect(() => {
    if (isCryptoOnlyCurrency) return;
    if (paymentMethod === "cod" && (shouldHideShipping || !isCodAvailable)) {
      setPaymentMethod(isBacsAvailable ? "bacs" : "stripe");
    }
  }, [paymentMethod, shouldHideShipping, isCodAvailable, isBacsAvailable, isCryptoOnlyCurrency]);
  const backendCouponKey = backendCoupons.map(({ code }) => code).join("|");
  useEffect(() => {
    setAppliedCoupons(backendCoupons.map(({ code }) => code));
  }, [backendCouponKey]);

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
      state: "state",
      postcode: "postcode",
      countryCode: "countryCode",
    };
    setBillingAddress((previous) => ({ ...previous, [field]: value }));
    const errorField = errorFieldMap[field];
    if (errorField) {
      setBillingErrors((previous) => ({ ...previous, [errorField]: undefined }));
    }
  }

  function updateDeliveryAddress<K extends keyof AddressFormState>(field: K, value: string) {
    const errorFieldMap: Partial<Record<keyof AddressFormState, keyof CheckoutFieldErrors>> = {
      firstName: "firstName",
      lastName: "lastName",
      address1: "address1",
      city: "city",
      state: "state",
      postcode: "postcode",
      countryCode: "countryCode",
    };
    setDeliveryAddress((previous) => ({ ...previous, [field]: value }));
    const errorField = errorFieldMap[field];
    if (errorField) {
      setDeliveryErrors((previous) => ({ ...previous, [errorField]: undefined }));
    }
  }

  async function handleApplyCoupon() {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError(null);
    const result = await checkoutApplyCoupon(couponCode.trim());
    setCouponLoading(false);
    if (result.ok && result.totals) {
      adoptCheckoutCart(result.totals);
      setAppliedCoupons((result.totals.coupons || []).map(({ code }) => code));
      setCouponCode("");
    } else {
      setCouponError(result.error || t("checkout.coupon.error"));
    }
  }

  async function handleRemoveCoupon(code: string) {
    const result = await checkoutRemoveCoupon(code);
    if (result.ok && result.totals) {
      adoptCheckoutCart(result.totals);
      setAppliedCoupons((result.totals.coupons || []).map((coupon) => coupon.code));
    }
  }

  async function handleShippingMethodChange(method: DisplayShippingMethod) {
    setShippingMethod(method.id);
    if (method.packageId === undefined || !method.rateId) return;
    const result = await selectCheckoutShippingMethod(method.packageId, method.rateId);
    if (!result.ok) setOrderError(result.error);
  }

  // Real order submission — every live WooCommerce gateway that the backend exposes
  // through the Store API can be submitted here. Crypto still remains preview-only
  // until the custom gateway is fully validated on the live backend.
  async function handlePlaceOrder(event: MouseEvent<HTMLAnchorElement>) {
    if (orderSubmitting) {
      event.preventDefault();
      return;
    }
    const canSubmitRealOrder =
      isBackendConfigured &&
      (
        (paymentMethod === "stripe" && !isCryptoOnlyCurrency && isStripeGatewayEnabled) ||
        (paymentMethod === "blik" && !isCryptoOnlyCurrency && isBlikAvailable && isStripeGatewayEnabled) ||
        (paymentMethod === "crypto" && isCryptoAvailable) ||
        (paymentMethod === "bacs" && !isCryptoOnlyCurrency && isBacsAvailable) ||
        (paymentMethod === "cod" && !isCryptoOnlyCurrency && isCodAvailable) ||
        (paymentMethod === "cheque" && !isCryptoOnlyCurrency && isCheckAvailable)
      );
    if (!canSubmitRealOrder) {
      if (isBackendConfigured) {
        event.preventDefault();
        setOrderError(
          paymentMethod === "crypto"
            ? t("checkout.payment.unavailable_backend")
            : isCryptoOnlyCurrency
              ? "Only the crypto wallet payment method is available while paying in BTC/ETH."
              : t("checkout.payment.method_unavailable"),
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
      customerNote: orderNotes,
      requiresShipping: !shouldHideShipping,
    });
    const shouldCreateAccount = !isLoggedIn && (createAccount || requireAccountCreation);
    const normalizedUsername = accountUsername.trim();
    const accountUsernameError = shouldCreateAccount
      ? validateFieldValue(accountUsername, {
          label: t("checkout.field.username"),
          min: 3,
          max: 60,
          required: true,
          type: "username",
        }, t)
      : undefined;
    const accountPasswordError = shouldCreateAccount
      ? validateFieldValue(accountPassword, {
          label: t("checkout.field.password"),
          min: 8,
          max: 72,
          required: true,
        }, t)
      : undefined;
    const nextBillingErrors = {
      firstName: localizeFieldError(checkoutValidation.errors.firstName, billingAddress.firstName, { label: t("checkout.field.first_name"), min: 1, max: 35, required: true }, t),
      lastName: localizeFieldError(checkoutValidation.errors.lastName, billingAddress.lastName, { label: t("checkout.field.last_name"), min: 1, max: 35, required: true }, t),
      address1: localizeFieldError(checkoutValidation.errors.address1, billingAddress.address1, { label: t("checkout.field.address1"), min: 4, max: 100, required: !shouldHideShipping }, t),
      city: localizeFieldError(checkoutValidation.errors.city, billingAddress.city, { label: t("checkout.field.city"), min: 1, max: 85, required: !shouldHideShipping }, t),
      state: localizeFieldError(checkoutValidation.errors.state, billingAddress.state, { label: t("checkout.field.state"), min: 1, max: 254, required: !shouldHideShipping }, t),
      postcode: localizeFieldError(checkoutValidation.errors.postcode, billingAddress.postcode, { label: t("checkout.field.postcode"), min: 2, max: 12, required: !shouldHideShipping }, t),
      countryCode: localizeFieldError(checkoutValidation.errors.country, billingAddress.countryCode, { label: t("checkout.field.country"), min: 2, max: 55, required: true }, t),
      phone: localizeFieldError(checkoutValidation.errors.phone, billingPhone, { label: t("checkout.field.phone"), min: 7, max: 20, required: true, type: "phone" }, t),
      email: localizeFieldError(checkoutValidation.errors.email, billingEmail, { label: t("checkout.field.email"), min: 6, max: 254, required: true, type: "email" }, t),
      blikCode:
        paymentMethod === "blik" && !/^\d{6}$/.test(blikCode.trim())
          ? t("checkout.payment.blik_error")
          : undefined,
      accountUsername: accountUsernameError,
      accountPassword: accountPasswordError,
    };
    setBillingErrors(nextBillingErrors);
    const deliveryValidation = shipToDifferentAddress && !shouldHideShipping
      ? validateCheckoutForm({
          firstName: deliveryAddress.firstName,
          lastName: deliveryAddress.lastName,
          country: deliveryAddress.countryCode,
          address1: deliveryAddress.address1,
          city: deliveryAddress.city,
          state: deliveryAddress.state,
          postcode: deliveryAddress.postcode,
          phone: billingPhone,
          email: billingEmail,
          requiresShipping: true,
        })
      : null;
    const nextDeliveryErrors: CheckoutFieldErrors = {
      firstName: localizeFieldError(deliveryValidation?.errors.firstName, deliveryAddress.firstName, { label: t("checkout.field.first_name"), min: 1, max: 35, required: true }, t),
      lastName: localizeFieldError(deliveryValidation?.errors.lastName, deliveryAddress.lastName, { label: t("checkout.field.last_name"), min: 1, max: 35, required: true }, t),
      address1: localizeFieldError(deliveryValidation?.errors.address1, deliveryAddress.address1, { label: t("checkout.field.address1"), min: 4, max: 100, required: true }, t),
      city: localizeFieldError(deliveryValidation?.errors.city, deliveryAddress.city, { label: t("checkout.field.city"), min: 1, max: 85, required: true }, t),
      state: localizeFieldError(deliveryValidation?.errors.state, deliveryAddress.state, { label: t("checkout.field.state"), min: 1, max: 254, required: true }, t),
      postcode: localizeFieldError(deliveryValidation?.errors.postcode, deliveryAddress.postcode, { label: t("checkout.field.postcode"), min: 2, max: 12, required: true }, t),
      countryCode: localizeFieldError(deliveryValidation?.errors.country, deliveryAddress.countryCode, { label: t("checkout.field.country"), min: 2, max: 55, required: true }, t),
    };
    setDeliveryErrors(nextDeliveryErrors);
    if (
      !checkoutValidation.isValid ||
      deliveryValidation?.isValid === false ||
      nextBillingErrors.blikCode ||
      accountUsernameError ||
      accountPasswordError
    ) {
      setOrderError(
        accountUsernameError || accountPasswordError
          ? accountUsernameError || accountPasswordError || t("checkout.error.billing_required")
          : nextBillingErrors.blikCode
            ? nextBillingErrors.blikCode
          : deliveryValidation?.isValid === false
            ? "Complete the required shipping details before placing the order."
            : t("checkout.error.billing_required"),
      );
      return;
    }
    if (!shouldHideShipping && isBackendConfigured && (shippingLoading || !selectedShipping)) {
      setOrderError(
        shippingLoading
          ? t("checkout.shipping_loading")
          : "No shipping method is available for this address.",
      );
      return;
    }

    const billing: CheckoutBillingDetails = {
      firstName: billingAddress.firstName,
      lastName: billingAddress.lastName,
      company: billingAddress.company || undefined,
      addressLine1: billingAddress.address1,
      addressLine2: billingAddress.address2 || undefined,
      city: billingAddress.city,
      state: billingAddress.state || undefined,
      postcode: billingAddress.postcode,
      countryCode: billingAddress.countryCode,
      email: billingEmail,
      phone: billingPhone,
    };
    const paymentBilling = shouldHideShipping
      ? withDigitalCheckoutAddress(billing)
      : billing;
    const shippingDetails: CheckoutBillingDetails | undefined =
      shipToDifferentAddress && !shouldHideShipping
        ? {
            firstName: deliveryAddress.firstName,
            lastName: deliveryAddress.lastName,
            company: deliveryAddress.company || undefined,
            addressLine1: deliveryAddress.address1,
            addressLine2: deliveryAddress.address2 || undefined,
            city: deliveryAddress.city,
            state: deliveryAddress.state || undefined,
            postcode: deliveryAddress.postcode,
            countryCode: deliveryAddress.countryCode,
            email: billingEmail,
            phone: billingPhone,
          }
        : undefined;
    const requireAuthenticatedUser = isLoggedIn;

    setOrderSubmitting(true);
    if (syncedCartRevision !== cartRevision) {
      const syncResult = await syncCartToBackend(items, { verifyForCheckout: true });
      if (!syncResult.ok) {
        setOrderSubmitting(false);
        setOrderError(syncResult.error);
        return;
      }
    }

    let stripePaymentMethodId: string | undefined;
    let stripePaymentType: string | undefined;
    if (paymentMethod === "stripe") {
      const controller = stripePaymentControllerRef.current;
      if (!controller) {
        setOrderSubmitting(false);
        setOrderError("The Stripe payment form is still loading. Please wait a moment and try again.");
        return;
      }
      try {
        const preparedPayment = await controller.createPaymentMethod(billing);
        stripePaymentMethodId = preparedPayment.paymentMethodId;
        stripePaymentType = preparedPayment.selectedPaymentType;
      } catch (error) {
        setOrderSubmitting(false);
        setOrderError(error instanceof Error ? error.message : "Stripe could not validate the payment details.");
        return;
      }
    } else if (paymentMethod === "blik") {
      const preparedPayment = await createBlikPaymentMethod(billing);
      if (!preparedPayment.ok) {
        setOrderSubmitting(false);
        setOrderError(preparedPayment.error);
        return;
      }
      stripePaymentMethodId = preparedPayment.paymentMethodId;
      stripePaymentType = "blik";
    }

    const gateway = paymentMethod === "blik"
      ? "stripe_blik"
      : paymentMethod === "crypto"
        ? "funkycommerce_crypto"
        : paymentMethod;
    let result: PaymentSubmissionResult = await submitCheckoutWithAccount(paymentBilling, gateway, {
      createAccount: shouldCreateAccount,
      accountUsername: shouldCreateAccount ? normalizedUsername : undefined,
      customerPassword: shouldCreateAccount ? accountPassword : undefined,
      subscribeToNewsletter: marketingConsent,
      marketingConsentLabel,
      requireAuthenticatedUser,
      language: languageCode,
      backendLanguage: languageBackendCode,
      selectedCurrency: currencyCode,
      customerNote: orderNotes,
      shippingAddress: shippingDetails,
      digitalOrder: shouldHideShipping,
      cryptoAssetCode: paymentMethod === "crypto" ? cryptoCoin.toUpperCase() : undefined,
      blikCode: paymentMethod === "blik" ? blikCode : undefined,
      stripePaymentMethodId,
      stripePaymentType,
    });

    let accountLoginError: string | undefined;
    if (shouldCreateAccount) {
      try {
        const auth = await login(normalizedUsername, accountPassword);
        if (result.order) {
          const customerId = await claimCheckoutOrder(result.order, billingEmail, auth.authToken);
          result = { ...result, order: { ...result.order, customer_id: customerId } };
        }
      } catch (error) {
        accountLoginError = error instanceof Error ? error.message : "Automatic account setup failed.";
      }
    }

    if (result.ok && paymentMethod === "stripe") {
      result = await completeStripePayment(result.order);
    } else if (result.ok && paymentMethod === "blik") {
      result = await completeBlikPayment(result.order, billingEmail);
    }
    setOrderSubmitting(false);

    if (result.ok) {
      const confirmation = createOrderConfirmation({
        mode: shouldHideShipping ? "digital" : "physical",
        order: result.order,
        billingEmail: billingEmail.trim(),
        currency: checkoutCart?.totals.currency_code || currencyCode,
        accountLoginError,
        items,
        formatAmount: formatBaseAmount,
        subtotal: authoritativeSubtotal,
        discount: discountValue,
        shipping: shippingValue,
        tax: taxValue,
        total: totalValue,
        coupons: appliedCoupons,
        shippingMethod: shouldHideShipping ? undefined : selectedShipping?.label,
      });
      completeAbandonedCartCapture();
      saveOrderConfirmation(confirmation);
      orderCompletedRef.current = true;
      clearCart();
      navigate(shouldHideShipping ? orderSuccessDigitalPath : orderSuccessPath, {
        state: { order: result.order, confirmation },
      });
    } else {
      setOrderError(
        result.order
          ? `Order #${result.order.order_number || result.order.order_id} was created, but payment failed: ${result.error} You can retry payment without losing your cart.`
          : result.error,
      );
    }
  }

  const displayShippingMethods = mapShippingOptionsToDisplayMethods(
    backendShippingMethods,
    isBackendConfigured
      ? checkoutCart && !shippingError
        ? [DEFAULT_FREE_SHIPPING_METHOD]
        : []
      : FALLBACK_SHIPPING_METHODS,
    checkoutTotals?.currency_minor_unit ?? 0,
  );
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
  const authoritativeSubtotal = checkoutTotals?.total_items !== undefined
    ? storeApiAmount(checkoutTotals.total_items, checkoutTotals)
    : subtotalAmount;
  const authoritativeSubtotalLabel = checkoutTotals ? formatBaseAmount(authoritativeSubtotal) : subtotalLabel;
  const resolvedFreeShipping = resolveFreeShippingThreshold(
    freeShippingZones,
    shipToDifferentAddress ? deliveryAddress.countryCode : billingAddress.countryCode,
    defaultCountryCode,
    FREE_SHIPPING_THRESHOLD,
  );
  const freeShippingThreshold = resolvedFreeShipping.threshold;
  const freeShippingApplies =
    !shouldHideShipping &&
    (
      items.length === 0 ||
      selectedShipping?.price === 0 ||
      (!isBackendConfigured && freeShippingThreshold !== null && authoritativeSubtotal >= freeShippingThreshold)
    );
  const fallbackShippingValue = shouldHideShipping ? 0 : freeShippingApplies ? 0 : selectedShipping?.price ?? 0;
  const remainingForFreeShipping = freeShippingThreshold !== null ? freeShippingThreshold - authoritativeSubtotal : null;
  const shippingValue = checkoutTotals
    ? storeApiAmount(checkoutTotals.total_shipping, checkoutTotals)
    : fallbackShippingValue;
  const taxValue = checkoutTotals
    ? storeApiAmount(checkoutTotals.total_tax, checkoutTotals)
    : isBackendConfigured
      ? 0
      : authoritativeSubtotal * 0.1;
  const discountValue = checkoutTotals
    ? storeApiAmount(checkoutTotals.total_discount, checkoutTotals)
    : 0;
  const totalValue = checkoutTotals
    ? storeApiAmount(checkoutTotals.total_price, checkoutTotals)
    : authoritativeSubtotal - discountValue + shippingValue + taxValue;

  const summaryRows = [
    { label: t("checkout.subtotal"), value: authoritativeSubtotalLabel },
    ...(discountValue > 0 ? [{ label: t("checkout.discount"), value: `-${formatBaseAmount(discountValue)}` }] : []),
    {
      label: t("checkout.shipping"),
      value: shouldHideShipping ? t("cart.digital_delivery") : shippingValue === 0 ? t("checkout.free") : formatBaseAmount(shippingValue),
    },
    {
      label: t("checkout.tax"),
      value: isBackendConfigured && !checkoutTotals ? "—" : formatBaseAmount(taxValue),
    },
  ];

  const couponSection = (
    <CheckoutSection title={couponCopy.title} collapsible defaultOpen={couponVisible} onToggle={setCouponVisible}>
      <div
        data-checkout-coupon-row
        className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
      >
        <div data-checkout-coupon-input className="min-w-0 w-full max-w-full box-border">
          <InputMock
            label={couponCopy.label}
            placeholder={couponCopy.label}
            value={couponCode}
            onChange={(value) => {
              setCouponCode(value);
              setCouponError(null);
            }}
          />
        </div>
        <button
          data-checkout-coupon-submit
          type="button"
          onClick={handleApplyCoupon}
          disabled={couponLoading || !couponCode.trim()}
          className="min-h-11 min-w-0 w-full max-w-full box-border whitespace-normal rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold leading-snug text-zinc-700 transition hover:border-brand-400 hover:text-brand-600 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-brand-500 dark:hover:text-brand-300"
        >
          {couponLoading ? t("checkout.coupon.applying") : couponCopy.apply}
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
                {t("checkout.coupon.applied", { code })}
              </span>
              <button
                type="button"
                onClick={() => handleRemoveCoupon(code)}
                className="text-xs font-semibold text-emerald-600 underline hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-100"
              >
                {t("checkout.coupon.remove")}
              </button>
            </p>
          ))}
        </div>
      ) : null}
    </CheckoutSection>
  );

  const paymentSection = (
    <CheckoutSection title={t("checkout.payment.title")}>
      <div className="grid gap-2.5">
        {!isBackendConfigured || isStripeGatewayEnabled ? (
          <>
            <PaymentOption
              icon={<CreditCard className="h-5 w-5" aria-hidden="true" />}
              label={t("checkout.payment.online")}
              description={t("checkout.payment.online_desc")}
              checked={paymentMethod === "stripe"}
              onSelect={() => setPaymentMethod("stripe")}
              disabled={isCryptoOnlyCurrency}
              disabledReason="Not available while paying in BTC/ETH — use the crypto wallet method instead."
            />
            {paymentMethod === "stripe" && !isCryptoOnlyCurrency ? (
              <StripeCardElement
                amount={totalValue * selectedRate}
                currency={currencyCode.toLowerCase()}
                onControllerChange={registerStripePaymentController}
              />
            ) : null}
          </>
        ) : null}

        {isBlikAvailable ? (
          <>
            <PaymentOption
              icon={
                <img
                  data-checkout-blik-icon
                  src="/icons/payment/blik.svg"
                  alt=""
                  aria-hidden="true"
                  width={95}
                  height={40}
                  className="block w-auto max-w-full object-contain"
                  style={{
                    blockSize: `${BLIK_RENDERED_HEIGHT_PX}px`,
                    inlineSize: "auto",
                    maxInlineSize: "100%",
                    aspectRatio: "95 / 40",
                    objectFit: "contain",
                  }}
                />
              }
              label={t("checkout.payment.blik")}
              description={t("checkout.payment.blik_desc")}
              checked={paymentMethod === "blik"}
              onSelect={() => setPaymentMethod("blik")}
              disabled={isCryptoOnlyCurrency}
              disabledReason="Not available while paying in BTC/ETH — use the crypto wallet method instead."
            />
            {paymentMethod === "blik" && !isCryptoOnlyCurrency ? (
              <div className="grid gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <InputMock
                  label={t("checkout.payment.blik_label")}
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
                    : t("checkout.payment.blik_expired")}
                </p>
              </div>
            ) : null}
          </>
        ) : null}

        {!isBackendConfigured || isCryptoAvailable ? (
          <>
            <PaymentOption
              icon={<CurrencyMark code="BTC" size={20} />}
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
              label={t("checkout.payment.bacs")}
              description={t("checkout.payment.bacs_desc")}
              checked={paymentMethod === "bacs"}
              onSelect={() => setPaymentMethod("bacs")}
              disabled={isCryptoOnlyCurrency}
              disabledReason="Not available while paying in BTC/ETH — use the crypto wallet method instead."
            />
            {paymentMethod === "bacs" && !isCryptoOnlyCurrency ? (
              <div className="grid gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <p className="m-0 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
                  {t("checkout.payment.instructions")}
                </p>
                <p className="m-0 text-sm text-zinc-600 dark:text-zinc-400">
                  The live store backend accepts bank-transfer orders. After placing the order, customers continue to the
                  order confirmation screen and email for the configured transfer details.
                </p>
              </div>
            ) : null}
          </>
        ) : null}

        <PaymentOption
          icon={<Banknote className="h-5 w-5" aria-hidden="true" />}
          label={t("checkout.payment.cod")}
          description={t("checkout.payment.cod_desc")}
          checked={paymentMethod === "cod"}
          onSelect={() => setPaymentMethod("cod")}
          disabled={shouldHideShipping || !isCodAvailable || isCryptoOnlyCurrency}
          disabledReason={
            isCryptoOnlyCurrency
              ? "Not available while paying in BTC/ETH — use the crypto wallet method instead."
              : shouldHideShipping
                ? t("checkout.payment.unavailable_digital")
                : t("checkout.payment.unavailable")
          }
        />

        {isCheckAvailable ? (
          <PaymentOption
            icon={<Banknote className="h-5 w-5" aria-hidden="true" />}
            label={t("checkout.payment.cheque")}
            description={t("checkout.payment.cheque_desc")}
            checked={paymentMethod === "cheque"}
            onSelect={() => setPaymentMethod("cheque")}
            disabled={shouldHideShipping || isCryptoOnlyCurrency}
            disabledReason={
              isCryptoOnlyCurrency
                ? "Not available while paying in BTC/ETH — use the crypto wallet method instead."
                : t("checkout.payment.unavailable_digital")
            }
          />
        ) : null}
        
        {paymentMethod === "cheque" && !isCryptoOnlyCurrency ? (
          <div className="grid gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="m-0 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
              {t("checkout.payment.instructions")}
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
        {checkoutPresentation?.trustMessage || t("checkout.payment.ssl")}
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
                {checkoutPresentation?.heading || t("checkout.title")}
              </h1>
              {checkoutPresentation?.intro ? <p className="mb-0 mt-2 text-sm text-zinc-500 dark:text-zinc-400">{checkoutPresentation.intro}</p> : null}
            </div>

            {couponPosition === "top" ? couponSection : null}

            <CheckoutSection title={t("checkout.billing.title")}>
              <div className="grid min-w-0 gap-4 md:grid-cols-2 [&>*]:min-w-0">
                <InputMock
                label={t("checkout.field.first_name")}
                required
                value={billingAddress.firstName}
                onChange={(value) => updateBillingAddress("firstName", value)}
                name="billingFirstName"
                autoComplete="given-name"
                error={billingErrors.firstName}
              />
              <InputMock
                label={t("checkout.field.last_name")}
                required
                value={billingAddress.lastName}
                onChange={(value) => updateBillingAddress("lastName", value)}
                name="billingLastName"
                autoComplete="family-name"
                error={billingErrors.lastName}
              />
              {!hideOptionalBillingFields ? (
                <InputMock
                  label={t("checkout.field.company")}
                  value={billingAddress.company}
                  onChange={(value) => updateBillingAddress("company", value)}
                  name="billingCompany"
                  autoComplete="organization"
                />
              ) : null}
              <CountrySelect
                label={t("checkout.field.country")}
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
                  label={t("checkout.field.address1")}
                  required
                  helperText={t("checkout.field.address1_helper")}
                  value={billingAddress.address1}
                  onChange={(value) => updateBillingAddress("address1", value)}
                  name="billingAddressLine1"
                  autoComplete="address-line1"
                  error={billingErrors.address1}
                />
                {!hideOptionalBillingFields ? (
                  <InputMock
                    label={t("checkout.field.address2")}
                    helperText={t("checkout.field.optional")}
                    value={billingAddress.address2}
                    onChange={(value) => updateBillingAddress("address2", value)}
                    name="billingAddressLine2"
                    autoComplete="address-line2"
                  />
                ) : null}
                <div className="grid gap-4 md:grid-cols-3">
                  <InputMock
                    label={t("checkout.field.city")}
                    required
                    value={billingAddress.city}
                    onChange={(value) => updateBillingAddress("city", value)}
                    name="billingCity"
                    autoComplete="address-level2"
                    error={billingErrors.city}
                  />
                  <InputMock
                    label={t("checkout.field.state")}
                    required
                    value={billingAddress.state}
                    onChange={(value) => updateBillingAddress("state", value)}
                    name="billingState"
                    autoComplete="address-level1"
                    error={billingErrors.state}
                  />
                  <InputMock
                    label={t("checkout.field.postcode")}
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
                label={t("checkout.field.phone")}
                type="tel"
                required
                value={billingPhone}
                onChange={(value) => {
                  setBillingPhone(value);
                  setBillingErrors((previous) => ({
                    ...previous,
                    phone: value.trim().length > 0 && !isValidPhone(value) ? t("checkout.field.phone_error") : undefined,
                  }));
                }}
                name="billingPhone"
                autoComplete="tel"
                inputMode="tel"
                error={billingErrors.phone}
              />
              <InputMock
                label={t("checkout.field.email")}
                type="email"
                required
                value={billingEmail}
                onChange={(value) => {
                  setBillingEmail(value);
                  saveCheckoutEmail(value);
                  setBillingErrors((previous) => ({
                    ...previous,
                    email: value.trim().length > 0 && !isValidEmail(value) ? t("checkout.field.email_error") : undefined,
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
                {t("checkout.digital_notice")}
              </p>
            </div>
          ) : null}

          {couponPosition === "inline" ? couponSection : null}

          {!isLoggedIn && accountMode === "optional" ? (
            <CheckoutSection title={t("checkout.account.title")}>
              <label className="flex items-center gap-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={createAccount}
                  onChange={(event) => setCreateAccount(event.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-950"
                />
                {t("checkout.account.create")}
              </label>
              {createAccount ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <InputMock
                    label={t("checkout.field.username")}
                    required
                    value={accountUsername}
                    onChange={(value) => {
                      setAccountUsername(value);
                      setBillingErrors((previous) => ({ ...previous, accountUsername: undefined }));
                    }}
                    name="accountUsername"
                    autoComplete="username"
                    error={billingErrors.accountUsername}
                  />
                  <InputMock
                    label={t("checkout.field.password")}
                    type="password"
                    required
                    value={accountPassword}
                    onChange={(value) => {
                      setAccountPassword(value);
                      setBillingErrors((previous) => ({ ...previous, accountPassword: undefined }));
                    }}
                    name="accountPassword"
                    autoComplete="new-password"
                    error={billingErrors.accountPassword}
                  />
                </div>
              ) : null}
              <label className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(event) => setMarketingConsent(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-brand-600 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <span>{marketingConsentLabel}</span>
              </label>
            </CheckoutSection>
          ) : !isLoggedIn && accountMode === "required" ? (
            <CheckoutSection title={t("checkout.account.title")}>
              <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">{t("checkout.guest_notice")}</p>
              <div className="grid gap-4 md:grid-cols-2">
                <InputMock
                  label={t("checkout.field.username")}
                  required
                  value={accountUsername}
                  onChange={(value) => {
                    setAccountUsername(value);
                    setBillingErrors((previous) => ({ ...previous, accountUsername: undefined }));
                  }}
                  name="accountUsername"
                  autoComplete="username"
                  error={billingErrors.accountUsername}
                />
                <InputMock
                  label={t("checkout.field.password")}
                  type="password"
                  required
                  value={accountPassword}
                  onChange={(value) => {
                    setAccountPassword(value);
                    setBillingErrors((previous) => ({ ...previous, accountPassword: undefined }));
                  }}
                  name="accountPassword"
                  autoComplete="new-password"
                  error={billingErrors.accountPassword}
                />
              </div>
              <label className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(event) => setMarketingConsent(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-brand-600 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <span>{marketingConsentLabel}</span>
              </label>
            </CheckoutSection>
          ) : (
            <CheckoutSection title="Updates">
              <label className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={marketingConsent}
                  onChange={(event) => setMarketingConsent(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-brand-600 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <span>{marketingConsentLabel}</span>
              </label>
            </CheckoutSection>
          )}

          <CheckoutSection title="Cart recovery">
            {abandonedCartConsentRequired ? (
              <label className="flex items-start gap-2.5 text-sm text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={abandonedCartConsentAccepted}
                  onChange={(event) => setAbandonedCartConsentAccepted(event.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-brand-600 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-950"
                />
                <span>{abandonedCartConsentLabel}</span>
              </label>
            ) : (
              <p className="m-0 text-sm text-zinc-600 dark:text-zinc-400">{abandonedCartConsentLabel}</p>
            )}
            <p className="m-0 text-xs text-zinc-400 dark:text-zinc-500">
              Your checkout details are used only to recover this cart and complete your order.
            </p>
          </CheckoutSection>

          {!shouldHideShipping ? (
            <CheckoutSection title={t("checkout.delivery.title")}>
              <label className="flex items-center gap-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                <input
                  type="checkbox"
                  checked={shipToDifferentAddress}
                  onChange={(event) => setShipToDifferentAddress(event.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-400 dark:border-zinc-700 dark:bg-zinc-950"
                />
                {t("checkout.ship_to_different")}
              </label>
              {shipToDifferentAddress ? (
                <div className="grid gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                  <div className="grid gap-4 md:grid-cols-2">
                    <InputMock
                      label={t("checkout.field.first_name")}
                      required
                      value={deliveryAddress.firstName}
                      onChange={(value) => updateDeliveryAddress("firstName", value)}
                      name="shippingFirstName"
                      autoComplete="shipping given-name"
                      error={deliveryErrors.firstName}
                    />
                    <InputMock
                      label={t("checkout.field.last_name")}
                      required
                      value={deliveryAddress.lastName}
                      onChange={(value) => updateDeliveryAddress("lastName", value)}
                      name="shippingLastName"
                      autoComplete="shipping family-name"
                      error={deliveryErrors.lastName}
                    />
                  </div>
                  {!hideOptionalShippingFields ? (
                    <InputMock
                      label={t("checkout.field.company")}
                      value={deliveryAddress.company}
                      onChange={(value) => updateDeliveryAddress("company", value)}
                      name="shippingCompany"
                      autoComplete="shipping organization"
                    />
                  ) : null}
                  <CountrySelect
                    label={t("checkout.field.country")}
                    required
                    value={deliveryAddress.countryCode}
                    onChange={(value) => updateDeliveryAddress("countryCode", value)}
                    options={checkoutCountries}
                    name="shippingCountry"
                    autoComplete="shipping country"
                    error={deliveryErrors.countryCode}
                  />
                  <InputMock
                    label={t("checkout.field.address1")}
                    required
                    value={deliveryAddress.address1}
                    onChange={(value) => updateDeliveryAddress("address1", value)}
                    name="shippingAddressLine1"
                    autoComplete="shipping address-line1"
                    error={deliveryErrors.address1}
                  />
                  {!hideOptionalShippingFields ? (
                    <InputMock
                      label={t("checkout.field.address2")}
                      helperText={t("checkout.field.optional")}
                      value={deliveryAddress.address2}
                      onChange={(value) => updateDeliveryAddress("address2", value)}
                      name="shippingAddressLine2"
                      autoComplete="shipping address-line2"
                    />
                  ) : null}
                  <div className="grid gap-4 md:grid-cols-3">
                    <InputMock
                      label={t("checkout.field.city")}
                      required
                      value={deliveryAddress.city}
                      onChange={(value) => updateDeliveryAddress("city", value)}
                      name="shippingCity"
                      autoComplete="shipping address-level2"
                      error={deliveryErrors.city}
                    />
                    <InputMock
                      label={t("checkout.field.state")}
                      required
                      value={deliveryAddress.state}
                      onChange={(value) => updateDeliveryAddress("state", value)}
                      name="shippingState"
                      autoComplete="shipping address-level1"
                      error={deliveryErrors.state}
                    />
                    <InputMock
                      label={t("checkout.field.postcode")}
                      required
                      value={deliveryAddress.postcode}
                      onChange={(value) => updateDeliveryAddress("postcode", value)}
                      name="shippingPostcode"
                      autoComplete="shipping postal-code"
                      error={deliveryErrors.postcode}
                    />
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2.5 pt-2">
                <span className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{t("checkout.shipping_method")}</span>
                {shippingLoading ? (
                  <p className="m-0 text-xs text-zinc-500 dark:text-zinc-400">{t("checkout.shipping_loading")}</p>
                ) : null}
                {shippingError ? (
                  <p className="m-0 text-xs text-amber-600 dark:text-amber-400">
                    {shippingError}
                  </p>
                ) : null}
                {!shippingLoading && !shippingError && displayShippingMethods.length === 0 ? (
                  <p className="m-0 text-xs text-amber-600 dark:text-amber-400">
                    No shipping methods are available for this address.
                  </p>
                ) : null}
                {displayShippingMethods.map((method) => {
                  const isFreeForMethod = method.price === 0 || (!isBackendConfigured && freeShippingApplies);
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
                          onChange={() => void handleShippingMethodChange(method)}
                          disabled={method.disabled}
                          className="accent-brand-600"
                        />
                        <span>
                          {method.label}
                          <span className="ml-2 font-normal text-zinc-400 dark:text-zinc-500">{method.eta}</span>
                        </span>
                      </span>
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {isFreeForMethod ? t("checkout.free") : formatBaseAmount(method.price)}
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
                    {t("checkout.free_shipping_nudge")}
                  </span>
                </Link>
              ) : null}
            </CheckoutSection>
          ) : null}

          {showOrderNotes ? (
            <CheckoutSection title={t("checkout.order_notes.title")}>
              <InputMock
                label={t("checkout.order_notes.label")}
                helperText={t("checkout.order_notes.helper")}
                multiline
                rows={3}
                value={orderNotes}
                onChange={setOrderNotes}
                name="orderNotes"
                autoComplete="off"
              />
            </CheckoutSection>
          ) : null}

          {paymentMethodsPosition === "left" ? paymentSection : null}
          </section>

        <div className="grid gap-6">
          {paymentMethodsPosition === "right" ? paymentSection : null}

          <OrderSummaryCard
            title={t("checkout.summary.title")}
            lineItems={items.map((item) => ({
              id: item.id,
              name: item.name,
              variant: item.variantLabel ?? "",
              quantity: item.quantity,
              price: item.priceLabel,
            }))}
            freeShippingNotice={
              !shouldHideShipping && remainingForFreeShipping !== null && remainingForFreeShipping > 0
                ? { remainingLabel: formatBaseAmount(remainingForFreeShipping), href: cartPath, actionLabel: t("checkout.back_to_cart") }
                : undefined
            }
            rows={summaryRows}
            total={formatBaseAmount(totalValue)}
            ctaHref={shouldHideShipping ? orderSuccessDigitalPath : orderSuccessPath}
            ctaLabel={checkoutPresentation?.submitLabel || t("checkout.cta")}
            ctaDisabled={
              (showTermsCheckbox && !agreedToTerms) ||
              (showPrivacyCheckbox && !agreedToPrivacy) ||
              (abandonedCartConsentRequired && !abandonedCartConsentAccepted)
            }
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
                      {renderLinkedLabel(t("checkout.terms"), t("checkout.terms_link"), "#terms")}
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
                      {renderLinkedLabel(t("checkout.privacy"), t("checkout.privacy_link"), "#privacy")}
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
  const t = useT();
  // Payment happens inline on this same page (no separate "Payment" step) — it's
  // selected and completed as part of "Checkout" below, right before confirmation.
  const steps = [t("checkout.step.cart"), t("checkout.step.checkout"), t("checkout.step.confirmation")];
  return (
    <nav aria-label={t("checkout.progress_aria")} className="flex items-center justify-center gap-2 sm:gap-4">
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
  const t = useT();
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200">
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
        className={`block min-w-0 w-full max-w-full box-border rounded-[var(--theme-radius)] border bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none transition focus:ring-4 dark:bg-zinc-950 dark:text-zinc-100 ${
          error
            ? "border-rose-400 focus:border-rose-500 focus:ring-rose-100 dark:border-rose-500/60 dark:focus:ring-rose-950"
            : "border-zinc-200 focus:border-brand-400 focus:ring-brand-100 dark:border-zinc-700 dark:focus:border-brand-500 dark:focus:ring-brand-950"
        }`}
      >
        <option value="">{t("checkout.field.country_placeholder")}</option>
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

type TranslateFn = (key: string, replacements?: Record<string, string | number>) => string;
type ValidationRule = {
  label: string;
  min: number;
  max: number;
  required?: boolean;
  type?: "email" | "phone" | "username";
};

function validateFieldValue(value: string, rule: ValidationRule, t: TranslateFn): string | undefined {
  const trimmed = value.trim();
  if (rule.required && trimmed.length === 0) return t("validation.required", { label: rule.label });
  if (!trimmed.length) return undefined;
  if (trimmed.length < rule.min) return t("validation.min_length", { label: rule.label, min: rule.min });
  if (trimmed.length > rule.max) return t("validation.max_length", { label: rule.label, max: rule.max });
  if (rule.type === "email" && !isValidEmail(trimmed)) return t("validation.email", { label: rule.label });
  if (rule.type === "phone" && !isValidPhone(trimmed)) return t("validation.phone", { label: rule.label });
  if (rule.type === "username" && !/^[a-zA-Z0-9_.-]+$/.test(trimmed)) return t("validation.username_chars", { label: rule.label });
  return undefined;
}

function localizeFieldError(rawError: string | undefined, value: string, rule: ValidationRule, t: TranslateFn): string | undefined {
  if (!rawError) return undefined;
  return validateFieldValue(value, rule, t) ?? rawError;
}

function renderLinkedLabel(text: string, linkText: string, href: string) {
  const [before, after] = splitAroundLink(text, linkText);
  return (
    <>
      {before}
      <a href={href} className="font-medium text-brand-600 underline underline-offset-2 dark:text-brand-400">
        {linkText}
      </a>
      {after}
    </>
  );
}

function splitAroundLink(text: string, linkText: string): [string, string] {
  const index = text.indexOf(linkText);
  if (index === -1) return [`${text} `, ""];
  return [text.slice(0, index), text.slice(index + linkText.length)];
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
      <span className="mt-0.5 shrink-0 text-zinc-500 dark:text-zinc-400">{icon}</span>
      <span className="grid gap-0.5">
        <span>{label}</span>
        <span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">{disabled ? disabledReason : description}</span>
      </span>
    </label>
  );
}

function StripePaymentElement({
  onControllerChange,
}: {
  onControllerChange: (controller: StripePaymentController | null) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const selectedPaymentType = useRef("card");

  useEffect(() => {
    if (!stripe || !elements) {
      onControllerChange(null);
      return;
    }

    onControllerChange({
      createPaymentMethod: async (billing) => {
        const submission = await elements.submit();
        if (submission.error) {
          throw new Error(submission.error.message || "Complete the Stripe payment form.");
        }

        const paymentMethod = await stripe.createPaymentMethod({
          elements,
          params: { billing_details: toStripeBillingDetails(billing) },
        });
        if (paymentMethod.error) {
          throw new Error(paymentMethod.error.message || "Stripe could not prepare the payment.");
        }
        return {
          paymentMethodId: paymentMethod.paymentMethod.id,
          selectedPaymentType: selectedPaymentType.current,
        };
      },
    });

    return () => onControllerChange(null);
  }, [elements, onControllerChange, stripe]);

  return (
    <PaymentElement
      onChange={(event) => {
        selectedPaymentType.current = event.value.type;
      }}
    />
  );
}

/** Deferred Stripe Payment Element wired to WooCommerce's UPE payment-data contract.
 * The WordPress Stripe plugin owns the secret key and creates the PaymentIntent only
 * after the browser has created a safe `pm_...` identifier through Stripe.js. */
function StripeCardElement({
  amount,
  currency,
  onControllerChange,
}: {
  amount: number;
  currency: string;
  onControllerChange: (controller: StripePaymentController | null) => void;
}) {
  const publishableKey = getStripePublishableKey();
  const stripePromise = useMemo(() => getStripe(), [publishableKey]);
  const elementOptions = useMemo(
    () => ({
      mode: "payment" as const,
      paymentMethodCreation: "manual" as const,
      amount: Math.max(Math.round(amount * 100), currency === "pln" ? 200 : 50),
      currency,
      paymentMethodTypes: ["card"],
      appearance: { theme: "stripe" as const },
    }),
    [amount, currency],
  );

  // BTC/ETH aren't ISO-4217 currencies — Stripe's Elements API rejects them outright.
  // Fall back gracefully instead of ever attempting to initialize with one.
  if (currency.toLowerCase() === "btc" || currency.toLowerCase() === "eth") {
    return (
      <div className="grid gap-2 rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        <p className="m-0 flex items-center gap-1.5 font-medium text-zinc-600 dark:text-zinc-300">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          Stripe doesn't support {currency.toUpperCase()}
        </p>
        <p className="m-0">
          Switch to the crypto wallet payment method, or change the storefront currency to a supported
          fiat currency to pay by card.
        </p>
      </div>
    );
  }

  if (!isStripeConfigured() || !stripePromise) {
    return (
      <div className="grid gap-2 rounded-xl border border-dashed border-zinc-300 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
        <p className="m-0 flex items-center gap-1.5 font-medium text-zinc-600 dark:text-zinc-300">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
          Stripe isn't connected yet
        </p>
        <p className="m-0">
          Configure the Stripe publishable key in the store settings or set{" "}
          <code className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">VITE_STRIPE_PUBLISHABLE_KEY</code>{" "}
          to render the secure card form.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <Elements stripe={stripePromise} options={elementOptions}>
        <StripePaymentElement onControllerChange={onControllerChange} />
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
      usdRate: typeof configuredAsset.fiatRate === "number" && configuredAsset.fiatRate > 0
        ? configuredAsset.fiatRate
        : 1,
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
