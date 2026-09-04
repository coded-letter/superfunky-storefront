import { Link, useLocation } from "react-router-dom";
import { CheckCircle2, LifeBuoy, MapPin, Sparkles, Truck, UserCircle2 } from "lucide-react";
import { useT } from "@funky/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { SummaryRow, type OrderLineItem } from "./shared";
import type { StoreApiCheckoutResult } from "../lib/wcStoreApi";
import { useStorefrontPath } from "../lib/storefrontPaths";

const ORDER_ITEMS: OrderLineItem[] = [
  { id: "sku-01", name: "Aurora Weekender Bag", variant: "Sandstone / One size", quantity: 1, price: "€128.00" },
  { id: "sku-02", name: "Nomad Wool Scarf", variant: "Charcoal", quantity: 2, price: "€39.00" },
  { id: "sku-03", name: "Studio Ceramic Mug", variant: "Glacier Blue", quantity: 1, price: "€21.00" },
];

/** Physical-order confirmation screen — order recap table, shipping address/method,
 * payment method used, and CTAs back into the shop/account. Mirrors the legacy
 * prototype's `order-success.js` visual structure, minus its Apollo/Stripe
 * payment-intent confirmation logic (not applicable to this backend-less mockup). */
export function OrderSuccessMockupPage() {
  const t = useT();
  const homePath = useStorefrontPath("home", "/");
  const checkoutPath = useStorefrontPath("checkout", "/checkout");
  const shopPath = useStorefrontPath("shop", "/shop");
  const accountPath = useStorefrontPath("account", "/account");
  const { state } = useLocation();
  const order = (state as { order?: StoreApiCheckoutResult } | null)?.order;
  const orderNumber = order?.order_number ?? `FC-2026-1042`;
  const customerName = [order?.billing_address?.first_name, order?.billing_address?.last_name].filter(Boolean).join(" ") || "Jordan";
  const shippingAddress = order?.shipping_address ?? order?.billing_address;
  const paymentLabel =
    order?.payment_method === "cod"
      ? t("order_success.payment.cod")
      : order?.payment_method === "cheque"
        ? t("order_success.payment.cheque")
        : order?.payment_method === "bacs"
          ? t("order_success.payment.bacs")
          : t("order_success.payment.card");
  const nativeOrderUrl = order?.payment_result?.redirect_url;

  return (
    <section className="mx-auto grid max-w-3xl gap-6">
      <Breadcrumbs items={[{ label: t("nav.home"), href: homePath }, { label: t("checkout.title"), href: checkoutPath }, { label: t("order_success.breadcrumb") }]} />

      <div className="grid gap-4 rounded-3xl border border-zinc-200/80 bg-white p-8 text-center shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-900 sm:p-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600 shadow-soft dark:bg-emerald-900/40 dark:text-emerald-300">
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </div>
        <div className="grid gap-2">
          <h1 className="m-0 font-display text-3xl font-bold text-zinc-900 dark:text-zinc-100">{t("order_success.heading")}</h1>
          <p className="mx-auto m-0 max-w-xl text-zinc-500 dark:text-zinc-400">
            {t("order_success.thank_you", { name: customerName || t("order_success.customer_fallback"), number: orderNumber })}
          </p>
        </div>

        <div className="mx-auto grid w-full gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-left dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="grid gap-2.5 border-b border-zinc-200 pb-3 dark:border-zinc-800">
            {ORDER_ITEMS.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">
                  {item.name}
                  <span className="text-zinc-400 dark:text-zinc-500"> ({item.variant})</span> × {item.quantity}
                </span>
                <span className="shrink-0 font-medium text-zinc-900 dark:text-zinc-100">{item.price}</span>
              </div>
            ))}
          </div>
          <SummaryRow label={t("order_success.row.shipping")} value="€6.50" />
          <SummaryRow label={t("order_success.row.discount_with_codes", { codes: "WELCOME10" })} value="−€22.70" />
          <SummaryRow label={t("order_success.row.total")} value="€211.80" isTotal />
        </div>

        <div className="mx-auto grid w-full gap-3 text-left sm:grid-cols-2">
          <div className="grid gap-1.5 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="m-0 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {t("order_success.shipping_to")}
            </p>
            <p className="m-0 text-sm text-zinc-700 dark:text-zinc-300">
              {shippingAddress?.first_name || order?.billing_address?.first_name || "Jordan"} {shippingAddress?.last_name || order?.billing_address?.last_name || "Reyes"}
              <br />
              {shippingAddress?.address_1 || "221B Harbor Lane, Unit 4"}
              {shippingAddress?.address_2 ? <><br />{shippingAddress.address_2}</> : null}
              <br />
              {shippingAddress?.city || "Rotterdam"}{shippingAddress?.postcode ? `, ${shippingAddress.postcode}` : ", 3011 AB"}{shippingAddress?.country ? `, ${shippingAddress.country}` : ", Netherlands"}
            </p>
          </div>
          <div className="grid gap-1.5 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="m-0 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              <Truck className="h-3.5 w-3.5" aria-hidden="true" />
              {t("order_success.delivery")}
            </p>
            <p className="m-0 text-sm text-zinc-700 dark:text-zinc-300">
              {paymentLabel}
              <br />
              {nativeOrderUrl ? t("order_success.native_note") : t("order_success.delivery_note")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to={shopPath}
            className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-900 no-underline transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {t("order_success.cta.shopping")}
          </Link>
          {nativeOrderUrl ? (
            <a
              href={nativeOrderUrl}
              className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-900 no-underline transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              {t("order_success.cta.native")}
            </a>
          ) : null}
          <Link
            to={`${accountPath}#orders`}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white no-underline shadow-glow transition hover:-translate-y-0.5"
          >
            <UserCircle2 className="h-4 w-4" aria-hidden="true" />
            {t("order_success.cta.track")}
          </Link>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-brand-200 bg-brand-50/60 p-5 dark:border-brand-500/20 dark:bg-brand-500/5 sm:grid-cols-2 sm:items-center">
        <p className="m-0 flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
          {t("order_success.promo")}
        </p>
        <p className="m-0 rounded-xl border border-dashed border-brand-300 bg-white px-4 py-2 text-center font-mono text-sm font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-transparent dark:text-brand-300 sm:justify-self-end">
          WELCOME15
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <LifeBuoy className="h-4 w-4 shrink-0" aria-hidden="true" />
        {t("order_success.support")}
        <Link to={`${accountPath}?section=orders`} className="font-semibold text-brand-600 no-underline hover:underline dark:text-brand-400">
          {t("order_success.contact")}
        </Link>
      </div>
    </section>
  );
}
