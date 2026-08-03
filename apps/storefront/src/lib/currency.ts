/** Live shop currency — replaces the old `VITE_CURRENCY_SYMBOL` env var. Sourced from
 * the WooCommerce Store API's cart totals (public, unauthenticated, always reflects
 * whatever currency the store is actually configured with in wp-admin — WPGraphQL's
 * `wcSettings`/`generalSettings` don't expose this publicly on this backend, confirmed
 * via live query, so the Store API is the right public source instead). Falls back to
 * a sensible default (EUR/€) while loading or when no backend is configured, matching
 * this codebase's existing graceful-fallback convention. */

import { useEffect, useState } from "react";
import { getCartTotals, type StoreApiCartTotals } from "./wcStoreApi";

export type ShopCurrency = {
  code: string;
  symbol: string;
  decimalSeparator: string;
  thousandSeparator: string;
  minorUnit: number;
  prefix: string;
  suffix: string;
};

const FALLBACK_CURRENCY: ShopCurrency = {
  code: "EUR",
  symbol: "€",
  decimalSeparator: ".",
  thousandSeparator: ",",
  minorUnit: 2,
  prefix: "€",
  suffix: "",
};

function fromTotals(totals: StoreApiCartTotals): ShopCurrency {
  return {
    code: totals.currency_code,
    symbol: totals.currency_symbol,
    decimalSeparator: totals.currency_decimal_separator,
    thousandSeparator: totals.currency_thousand_separator,
    minorUnit: totals.currency_minor_unit,
    prefix: totals.currency_prefix,
    suffix: totals.currency_suffix,
  };
}

let cachedCurrency: ShopCurrency | null = null;
let inFlight: Promise<ShopCurrency> | null = null;

function fetchShopCurrency(): Promise<ShopCurrency> {
  if (cachedCurrency) return Promise.resolve(cachedCurrency);
  if (inFlight) return inFlight;

  inFlight = getCartTotals().then((result) => {
    const currency = result.ok ? fromTotals(result.data.totals) : FALLBACK_CURRENCY;
    cachedCurrency = currency;
    return currency;
  });
  return inFlight;
}

/** Live shop currency, fetched once and cached for the session. Renders with the
 * fallback (€/EUR) immediately, then swaps to the real backend currency as soon as it
 * resolves — no loading spinner needed since checkout/cart totals still parse and
 * display fine with the fallback symbol in the meantime. */
export function useShopCurrency(): ShopCurrency {
  const [currency, setCurrency] = useState<ShopCurrency>(cachedCurrency ?? FALLBACK_CURRENCY);

  useEffect(() => {
    let cancelled = false;
    void fetchShopCurrency().then((resolved) => {
      if (!cancelled) setCurrency(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return currency;
}
