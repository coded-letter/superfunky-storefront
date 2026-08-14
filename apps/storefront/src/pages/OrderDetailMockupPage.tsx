import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Package, ArrowLeft, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { Seo, useLanguage, useT } from "@funky/ui";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { getPrivateOrderById } from "../lib/account";
import { localizedOrderStatus } from "../lib/orderPresentation";
import { useStorefrontPath } from "../lib/storefrontPaths";
import type { PrivateOrderResult } from "../lib/account";

function OrderStatus({ status, statusText }: { status: string; statusText: string }) {
  const t = useT();
  const label = localizedOrderStatus(status, statusText, t);
  const isPending = ["pending", "on-hold", "processing"].includes(status);
  const isCompleted = status === "completed";
  const isCancelled = ["cancelled", "failed", "refunded"].includes(status);
  if (isPending)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </span>
    );
  if (isCompleted)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </span>
    );
  if (isCancelled)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700 dark:bg-red-900/30 dark:text-red-300">
        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {label}
    </span>
  );
}

function OrderDetailView({ order, access, expiresAt }: PrivateOrderResult) {
  const t = useT();
  const { languageCode } = useLanguage();
  const homePath = useStorefrontPath("home", "/");
  const accountPath = useStorefrontPath("account", "/account");
  const dateLabel = order.date
    ? new Intl.DateTimeFormat(languageCode, { dateStyle: "long" }).format(new Date(order.date))
    : "—";

  return (
    <section className="mx-auto grid max-w-3xl gap-6">
      <Breadcrumbs
        items={[
          { label: t("nav.home"), href: homePath },
          { label: t("account.tab.orders"), href: `${accountPath}#orders` },
          { label: `#${order.number}` },
        ]}
      />

      <div className="grid gap-4 rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
        {access === "guest" && expiresAt ? (
          <p className="m-0 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
            {t("order_details.guest_expires", { date: new Intl.DateTimeFormat(languageCode, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(expiresAt)) })}
          </p>
        ) : null}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{dateLabel}</p>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("order_details.heading", { number: order.number })}
            </h1>
          </div>
          <OrderStatus status={order.status} statusText={order.statusText} />
        </div>

        <hr className="border-zinc-200 dark:border-zinc-700" />

        <div className="grid gap-2">
          {order.items?.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-100 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400">
                  <Package className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.name}</p>
                  {item.variation && (
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{item.variation}</p>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-medium">{item.total}</p>
                <p className="text-xs text-zinc-400">× {item.quantity}</p>
              </div>
            </div>
          ))}
        </div>

        <hr className="border-zinc-200 dark:border-zinc-700" />

        <div className="flex items-center justify-between text-base font-semibold">
          <span>{t("order_success.row.total")}</span>
          <span>{order.total}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          to={`${accountPath}#orders`}
          className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 shadow-soft transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("account.tab.orders")}
        </Link>
      </div>
    </section>
  );
}

export function OrderDetailMockupPage() {
  const t = useT();
  const { languageCode } = useLanguage();
  const accountPath = useStorefrontPath("account", "/account");
  const { id } = useParams();
  const orderId = id ? parseInt(id, 10) : NaN;
  const [result, setResult] = useState<PrivateOrderResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setError(null);
    setIsLoading(true);

    const request = Number.isInteger(orderId) && orderId > 0
      ? getPrivateOrderById(orderId)
      : Promise.resolve(null);
    request
      .then((nextResult) => {
        if (!cancelled) setResult(nextResult);
      })
      .catch((nextError: unknown) => {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError : new Error("Order unavailable"));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const noIndex = (
    <Seo
      title={t("order_details.private_title")}
      languageCode={languageCode}
      robots="noindex, nofollow, noarchive, nosnippet"
    />
  );
  if (isLoading) return <>{noIndex}<ContentLoadingState label={t("order_details.loading")} /></>;
  if (error || !result) {
    return (
      <>
        {noIndex}
        <section className="mx-auto grid max-w-lg gap-6 py-16 text-center">
          <p className="text-zinc-500">{t("order_details.unavailable")}</p>
          <Link to={accountPath} className="text-sm font-medium text-zinc-900 underline dark:text-zinc-100">
            {t("order_details.back_account")}
          </Link>
        </section>
      </>
    );
  }
  return <>{noIndex}<OrderDetailView {...result} /></>;
}
