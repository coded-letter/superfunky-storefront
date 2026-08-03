import { Link, useLocation } from "react-router-dom";
import { CheckCircle2, Download, FileArchive, LifeBuoy, Sparkles, UserCircle2 } from "lucide-react";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { SummaryRow, type OrderLineItem } from "./shared";
import type { StoreApiCheckoutResult } from "../lib/wcStoreApi";

const DOWNLOAD_ITEMS: OrderLineItem[] = [
  { id: "dl-01", name: "Studio Lightroom Preset Pack", variant: "ZIP · 48 MB", quantity: 1, price: "€19.00" },
  { id: "dl-02", name: "Brand Identity Kit", variant: "PDF + AI · 112 MB", quantity: 1, price: "€39.00" },
];

const DOWNLOAD_META: Record<string, { fileType: string; available: boolean; expires: string; remaining: number }> = {
  "dl-01": { fileType: "ZIP", available: true, expires: "12 Mar 2027", remaining: 5 },
  "dl-02": { fileType: "PDF", available: true, expires: "Never", remaining: 999 },
};

/** Digital/virtual-only order confirmation screen — same "order successful" heading
 * as the physical variant, but swaps the shipping-address/delivery recap for a
 * "Your Downloads" card (per-item download button, file-type + availability pills,
 * expiry date, downloads-remaining count), mirroring the legacy prototype's
 * `order-success-digital-only.js`. No shipping address/method appears anywhere on
 * this page since virtual-only orders never collect one. */
export function OrderSuccessDigitalMockupPage() {
  const { state } = useLocation();
  const order = (state as { order?: StoreApiCheckoutResult } | null)?.order;
  const orderNumber = order?.order_number ?? `FC-2026-1043`;
  const customerName = [order?.billing_address?.first_name, order?.billing_address?.last_name].filter(Boolean).join(" ") || "Jordan";
  const nativeOrderUrl = order?.payment_result?.redirect_url;

  return (
    <section className="mx-auto grid max-w-3xl gap-6">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Checkout", href: "/checkout" }, { label: "Order confirmed" }]} />

      <div className="grid gap-4 rounded-3xl border border-zinc-200/80 bg-white p-8 text-center shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-900 sm:p-12">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-emerald-600 shadow-soft dark:bg-emerald-900/40 dark:text-emerald-300">
          <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
        </div>
        <div className="grid gap-2">
          <h1 className="m-0 font-display text-3xl font-bold text-zinc-900 dark:text-zinc-100">Order successful</h1>
          <p className="mx-auto m-0 max-w-xl text-zinc-500 dark:text-zinc-400">
            Thank you, {customerName || "there"} — your digital order <strong className="text-zinc-700 dark:text-zinc-200">#{orderNumber}</strong> is
            confirmed. Your downloads are ready below and a receipt has been sent to your email.
          </p>
        </div>

        <div className="mx-auto grid w-full gap-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-left dark:border-zinc-800 dark:bg-zinc-950/60">
          <div className="grid gap-2.5 border-b border-zinc-200 pb-3 dark:border-zinc-800">
            {DOWNLOAD_ITEMS.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">
                  {item.name}
                  <span className="text-zinc-400 dark:text-zinc-500"> ({item.variant})</span>
                </span>
                <span className="shrink-0 font-medium text-zinc-900 dark:text-zinc-100">{item.price}</span>
              </div>
            ))}
          </div>
          <SummaryRow label="Total paid" value="€58.00" isTotal />
        </div>

        <div className="mx-auto w-full rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-brand-50 p-5 text-left dark:border-emerald-500/20 dark:from-emerald-500/10 dark:to-brand-500/5">
          <p className="m-0 mb-4 flex items-center gap-2 font-display text-base font-bold text-zinc-900 dark:text-zinc-100">
            <FileArchive className="h-5 w-5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            Your Downloads
          </p>
          <p className="m-0 mb-4 text-xs text-zinc-500 dark:text-zinc-400">
            Files are also available anytime from your account's Downloads tab — no need to save this page.
          </p>
          <div className="grid gap-3">
            {DOWNLOAD_ITEMS.map((item) => {
              const meta = DOWNLOAD_META[item.id];
              return (
                <div
                  key={item.id}
                  className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="grid gap-1">
                      <p className="m-0 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {meta.fileType}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            meta.available
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                              : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
                          }`}
                        >
                          {meta.available ? "Available" : "Unavailable"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!meta.available}
                      title="Mockup only — no real file is attached to this order"
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-4 py-2 text-xs font-semibold text-white shadow-glow transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Download
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-100 pt-2.5 text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                    <span>Expires: {meta.expires}</span>
                    <span>Downloads remaining: {meta.remaining >= 999 ? "Unlimited" : meta.remaining}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            to="/shop"
            className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-900 no-underline transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Continue shopping
          </Link>
          {nativeOrderUrl ? (
            <a
              href={nativeOrderUrl}
              className="rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-900 no-underline transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-800"
            >
              Open native order page
            </a>
          ) : null}
          <Link
            to="/account#orders"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white no-underline shadow-glow transition hover:-translate-y-0.5"
          >
            <UserCircle2 className="h-4 w-4" aria-hidden="true" />
            View my orders
          </Link>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-brand-200 bg-brand-50/60 p-5 dark:border-brand-500/20 dark:bg-brand-500/5 sm:grid-cols-2 sm:items-center">
        <p className="m-0 flex items-center gap-2 text-sm font-semibold text-brand-700 dark:text-brand-300">
          <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
          Thanks for being a returning customer — here's 15% off your next order.
        </p>
        <p className="m-0 rounded-xl border border-dashed border-brand-300 bg-white px-4 py-2 text-center font-mono text-sm font-semibold text-brand-700 dark:border-brand-500/30 dark:bg-transparent dark:text-brand-300 sm:justify-self-end">
          WELCOME15
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
        <LifeBuoy className="h-4 w-4 shrink-0" aria-hidden="true" />
        Trouble accessing a download?
        <Link to="/account#orders" className="font-semibold text-brand-600 no-underline hover:underline dark:text-brand-400">
          Contact us
        </Link>
      </div>
    </section>
  );
}
