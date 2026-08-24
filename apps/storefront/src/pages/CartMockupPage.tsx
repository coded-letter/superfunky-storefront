import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { ProductCard, ResponsiveImage, useCart, useCurrency, useLayoutPreferences } from "@funky/ui";
import { StandaloneApplicationNotice, useEmbeddedApplicationShortcode } from "../components/applicationShortcodes";
import { useAbandonedCartRecovery } from "../lib/abandonedCart";
import { DEFAULT_FREE_SHIPPING_METHOD, isCartVirtual, mapShippingOptionsToDisplayMethods, resolveFreeShippingThreshold, useCheckoutCart } from "../lib/checkout";
import { isBackendConfigured } from "@funky/sdk";
import { storeApiAmount } from "../lib/storeApiMoney";
import { useStorefrontPath } from "../lib/storefrontPaths";
import { FREE_SHIPPING_THRESHOLD, MOCK_PRODUCTS, OrderSummaryCard, primaryActionButtonClass } from "./shared";
import { type StoreApiAddress } from "../lib/wcStoreApi";
import { useCommerceData } from "../state/commerceData";
import { useNavigationData } from "../state/navigationData";

export function CartMockupPage() {
  const embedded = useEmbeddedApplicationShortcode();
  const recoveryState = useAbandonedCartRecovery();
  const recoveryNotice =
    recoveryState.status === "loading" ? (
      <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
        Restoring your saved cart…
      </div>
    ) : recoveryState.status === "partial" ? (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
        {recoveryState.message}
      </div>
    ) : recoveryState.status === "error" ? (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
        {recoveryState.message}
      </div>
    ) : null;
  if (!embedded) {
    return (
      <div className="grid gap-4">
        {recoveryNotice}
        <StandaloneApplicationNotice shortcode="cart" />
      </div>
    );
  }
  const { data: navigationData } = useNavigationData();
  const { data: commerceData } = useCommerceData();
  const { cartLayout: layout, cartSummaryPosition } = useLayoutPreferences();
  const shopPath = useStorefrontPath("shop", "/shop");
  const checkoutPath = useStorefrontPath("checkout", "/checkout");
  const { items, subtotalAmount, subtotalLabel, removeItem, updateQuantity } = useCart();
  const { formatBaseAmount } = useCurrency();
  const summarySticky = cartSummaryPosition === "sticky";
  
  // Country selector for previewing shipping costs and taxes in different locations
  const configuredCountries =
    navigationData?.storefrontConfig.shippingCountries
      ?.map((country) => ({ code: country.code, label: country.name }))
      ?.filter((country) => country.code && country.label) ?? [];
  const availableCountries = configuredCountries.length > 0 ? configuredCountries : [
    { code: "US", label: "United States" },
    { code: "CA", label: "Canada" },
    { code: "GB", label: "United Kingdom" },
    { code: "DE", label: "Germany" },
    { code: "FR", label: "France" },
    { code: "PL", label: "Poland" },
    { code: "ES", label: "Spain" },
    { code: "IT", label: "Italy" },
    { code: "AU", label: "Australia" },
    { code: "JP", label: "Japan" },
  ];
  const defaultCountryCode = navigationData?.storefrontConfig.defaultCustomerCountry || availableCountries[0]?.code || "PL";
  const freeShippingZones = navigationData?.storefrontConfig.freeShippingZones ?? [];
  
  const [selectedCountry, setSelectedCountry] = useState(defaultCountryCode);
  useEffect(() => {
    if (!selectedCountry && defaultCountryCode) {
      setSelectedCountry(defaultCountryCode);
    }
  }, [defaultCountryCode, selectedCountry]);
  
  // Mock billing address for tax calculation (in real scenario, this would come from user input)
  const mockAddress: StoreApiAddress = {
    first_name: "",
    last_name: "",
    address_1: "",
    city: "",
    postcode: "",
    country: selectedCountry,
  };
  const cartRevision = items.map((item) => `${item.id}:${item.quantity}`).join("|");
  
  const { cart: backendCart, methods: backendShippingMethods, totals: cartTotals } = useCheckoutCart(
    isBackendConfigured ? mockAddress : null,
    undefined,
    cartRevision,
    items,
  );
  const cartIsVirtual = isCartVirtual(items);
  const displayShippingMethods = mapShippingOptionsToDisplayMethods(
    backendShippingMethods,
    isBackendConfigured
      ? backendCart
        ? [DEFAULT_FREE_SHIPPING_METHOD]
        : []
      : [
          { id: "standard", label: "Standard shipping", eta: "3–5 business days", price: 7 },
          { id: "express", label: "Express shipping", eta: "1–2 business days", price: 14 },
        ],
    cartTotals?.currency_minor_unit ?? 0,
  );
  
  const selectedShipping = displayShippingMethods.find((method) => method.selected) ?? displayShippingMethods[0];
  const resolvedFreeShipping = resolveFreeShippingThreshold(
    freeShippingZones,
    selectedCountry,
    defaultCountryCode,
    FREE_SHIPPING_THRESHOLD,
  );
  const freeShippingThreshold = resolvedFreeShipping.threshold;
  const authoritativeSubtotal = cartTotals?.total_items !== undefined
    ? storeApiAmount(cartTotals.total_items, cartTotals)
    : subtotalAmount;
  const authoritativeSubtotalLabel = cartTotals ? formatBaseAmount(authoritativeSubtotal) : subtotalLabel;
  const freeShippingApplies =
    !cartIsVirtual &&
    (selectedShipping?.price === 0 || (freeShippingThreshold !== null && authoritativeSubtotal >= freeShippingThreshold));
  const shippingValue = cartTotals
    ? storeApiAmount(cartTotals.total_shipping, cartTotals)
    : items.length === 0 || cartIsVirtual
      ? 0
      : freeShippingApplies
        ? 0
        : selectedShipping?.price ?? 0;
  const taxValue = cartTotals
    ? storeApiAmount(cartTotals.total_tax, cartTotals)
    : authoritativeSubtotal * 0.1;
  const discountValue = cartTotals ? storeApiAmount(cartTotals.total_discount, cartTotals) : 0;
  const totalValue = cartTotals
    ? storeApiAmount(cartTotals.total_price, cartTotals)
    : authoritativeSubtotal - discountValue + shippingValue + taxValue;
  const remainingForFreeShipping = freeShippingThreshold !== null ? freeShippingThreshold - authoritativeSubtotal : null;

  if (items.length === 0) {
    const featuredProducts = isBackendConfigured
      ? commerceData?.products.slice(0, 4) ?? []
      : MOCK_PRODUCTS.slice(0, 4);
    return (
      <div className="grid gap-10">
        <div className="grid place-items-center gap-4 rounded-2xl border border-dashed border-zinc-200 bg-white/60 px-6 py-16 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <ShoppingBag className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="grid gap-1">
            <h1 className="m-0 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">Your cart is empty</h1>
            <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">Add products from the shop to see them here.</p>
          </div>
          <Link to={shopPath} className={`${primaryActionButtonClass} no-underline`}>
            Continue shopping
          </Link>
        </div>

        {featuredProducts.length ? (
          <div className="grid gap-4">
            <h2 className="m-0 font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">You might like</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} variant="default" />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {recoveryNotice}
      {layout === "editorial" ? (
        <div className="grid gap-8">
          <div className="grid gap-1">
            <h1 className="m-0 font-display text-3xl font-bold text-zinc-900 dark:text-zinc-100">Your cart</h1>
            <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">{items.length} item{items.length === 1 ? "" : "s"}, ready when you are.</p>
          </div>

          <div className="funky-cart-editorial-grid grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {(() => {
              const checkoutTile = (
                <article key="editorial-checkout-cta" className="funky-cart-checkout-tile group grid gap-3">
                  <Link
                    to={checkoutPath}
                    className="relative flex aspect-[4/5] flex-col items-start justify-end gap-3 overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white no-underline shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-soft-lg"
                  >
                    <span
                      className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl"
                      aria-hidden="true"
                    />
                    <ShoppingBag className="relative h-8 w-8" aria-hidden="true" />
                    <div className="relative grid gap-1">
                      <h2 className="m-0 font-display text-xl font-bold leading-tight">Ready to check out?</h2>
                      <p className="m-0 text-sm text-white/85">
                        {items.length} item{items.length === 1 ? "" : "s"} · {authoritativeSubtotalLabel} subtotal
                      </p>
                    </div>
                    <span className="relative inline-flex items-center gap-1.5 text-sm font-semibold">
                      Continue to checkout <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </Link>
                  <div className="h-[34px]" aria-hidden="true" />
                </article>
              );

              const cells: ReactNode[] = [];
              items.forEach((item, index) => {
                if (index === 3) cells.push(checkoutTile);
                cells.push(
                  <article key={item.id} className="funky-cart-item-card group grid gap-3">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-100 to-zinc-200 shadow-soft dark:from-zinc-800 dark:to-zinc-900">
                      {item.imageUrl ? (
                        <ResponsiveImage
                          src={item.imageUrl}
                          alt=""
                          sizes="(min-width: 768px) 25vw, 50vw"
                          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remove ${item.name} from cart`}
                        className="absolute right-3 top-3 inline-grid h-9 w-9 place-items-center rounded-full bg-white/90 text-zinc-500 shadow-soft backdrop-blur transition hover:bg-white hover:text-rose-500 dark:bg-zinc-950/80 dark:text-zinc-300"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/70 to-transparent p-4">
                        <div className="grid gap-0.5 text-white">
                          <h2 className="m-0 text-base font-semibold">{item.name}</h2>
                          {item.variantLabel ? <p className="m-0 text-xs text-white/70">{item.variantLabel}</p> : null}
                        </div>
                        <strong className="shrink-0 text-base font-bold text-white">{item.priceLabel}</strong>
                      </div>
                    </div>
                    <div className="inline-flex w-fit items-center gap-3 rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="text-zinc-400 transition hover:text-brand-600 dark:hover:text-brand-400"
                        aria-label={`Decrease quantity of ${item.name}`}
                      >
                        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                      <span>{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="text-zinc-400 transition hover:text-brand-600 dark:hover:text-brand-400"
                        aria-label={`Increase quantity of ${item.name}`}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </article>,
                );
              });
              if (items.length < 4) cells.push(checkoutTile);
              return cells;
            })()}
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="grid gap-5">
            <div className="grid gap-1">
              <h1 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">Your cart</h1>
              <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">{items.length} item{items.length === 1 ? "" : "s"}.</p>
            </div>
            <div className="grid gap-3">
              {items.map((item) => (
                <article
                  key={item.id}
                  className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-soft transition hover:shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="aspect-square w-[88px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900">
                    {item.imageUrl ? (
                      <ResponsiveImage src={item.imageUrl} alt="" sizes="5.5rem" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="grid gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid gap-0.5">
                        <h2 className="m-0 text-base font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</h2>
                        {item.variantLabel ? <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">{item.variantLabel}</p> : null}
                      </div>
                      <strong className="text-base font-bold text-zinc-900 dark:text-zinc-100">{item.priceLabel}</strong>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-3 rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="text-zinc-400 transition hover:text-brand-600 dark:hover:text-brand-400"
                          aria-label={`Decrease quantity of ${item.name}`}
                        >
                          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <span>{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="text-zinc-400 transition hover:text-brand-600 dark:hover:text-brand-400"
                          aria-label={`Increase quantity of ${item.name}`}
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-400 transition hover:text-rose-500"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <div className="grid gap-4">
            <OrderSummaryCard
             freeShippingNotice={
               !cartIsVirtual && remainingForFreeShipping !== null && remainingForFreeShipping > 0
                 ? { remainingLabel: formatBaseAmount(remainingForFreeShipping), href: shopPath }
                 : undefined
              }
              rows={[
               { label: "Subtotal", value: authoritativeSubtotalLabel },
               ...(discountValue > 0 ? [{ label: "Discount", value: `-${formatBaseAmount(discountValue)}` }] : []),
               { label: "Shipping", value: cartIsVirtual ? "Digital delivery" : shippingValue === 0 ? "Free" : formatBaseAmount(shippingValue) },
               { label: "Tax", value: formatBaseAmount(taxValue) },
              ]}
              afterRows={
                cartIsVirtual ? null : (
                  <label className="mb-2 grid gap-2 rounded-xl bg-zinc-50 px-3 py-3 text-sm font-medium text-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200">
                    <span>Shipping destination preview</span>
                    <select
                      value={selectedCountry}
                      onChange={(e) => setSelectedCountry(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-normal text-zinc-900 transition hover:border-zinc-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      aria-label="Preview shipping destination"
                    >
                      {availableCountries.map((country) => (
                        <option key={country.code} value={country.code}>
                          {country.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )
              }
              total={formatBaseAmount(totalValue)}
              ctaHref={checkoutPath}
              ctaLabel="Continue to checkout"
              position={summarySticky ? "sticky" : "static"}
            />
          </div>
        </div>
      )}
    </div>
  );
}
