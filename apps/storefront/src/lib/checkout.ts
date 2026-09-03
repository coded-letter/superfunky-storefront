/** Checkout utilities — shipping, taxes, coupons, and related calculations. */

import { useCallback, useEffect, useRef, useState } from "react";
import type { CartLineItem } from "@funky/ui";
import { syncCartToBackend } from "./backendCart";
import { checkoutCartMatchesShippingAddress } from "./checkoutInitialization";
import { isBackendConfigured } from "@funky/sdk";
import {
  applyCoupon,
  calculateTaxes,
  getShippingMethods,
  removeCoupon,
  selectShippingMethod,
  updateCartCustomer,
  type StoreApiAddress,
  type StoreApiCart,
  type StoreApiCouponResponse,
  type StoreApiShippingOption,
} from "./wcStoreApi";
export {
  DEFAULT_FREE_SHIPPING_METHOD,
  findFreeShippingMethod,
  mapShippingOptionsToDisplayMethods,
} from "./shippingRates";
export type { DisplayShippingMethod } from "./shippingRates";

export interface CheckoutState {
  shippingMethods: StoreApiShippingOption[];
  selectedShippingMethodId: string | null;
  appliedCoupons: string[];
  taxTotal: string;
  taxLines: Array<{ name: string; price: string }>;
  isLoading: boolean;
  error: string | null;
}

export type StorefrontFreeShippingZone = {
  countryCode: string;
  zoneName?: string | null;
  minAmount?: number | null;
  requires?: string | null;
  currencyCode?: string | null;
};

export type ResolvedFreeShippingThreshold = {
  threshold: number | null;
  matchedCountryCode: string | null;
  usedFallbackCountry: boolean;
};

export function useCheckoutCart(
  billingAddress: StoreApiAddress | null,
  shippingAddress: StoreApiAddress | null = billingAddress,
  cartRevision = "",
  frontendCart: CartLineItem[] = [],
) {
  const [state, setState] = useState<{
    cart: StoreApiCart | null;
    loading: boolean;
    error: string | null;
    syncedCartRevision: string | null;
  }>({ cart: null, loading: false, error: null, syncedCartRevision: null });
  const addressKey = [billingAddress, shippingAddress]
    .map((address) => address
      ? [
          address.address_1,
          address.address_2 ?? "",
          address.city,
          address.state ?? "",
          address.postcode,
          address.country,
        ].join("|")
      : "")
    .join("::");
  const latestAddressesRef = useRef({ billingAddress, shippingAddress });
  latestAddressesRef.current = { billingAddress, shippingAddress };
  const lastRequestedAddressKeyRef = useRef(addressKey);

  useEffect(() => {
    if (!isBackendConfigured || !billingAddress || !shippingAddress) {
      setState({ cart: null, loading: false, error: null, syncedCartRevision: null });
      return;
    }

    let cancelled = false;
    lastRequestedAddressKeyRef.current = addressKey;
    setState((previous) => ({
      ...previous,
      loading: true,
      error: null,
      syncedCartRevision: null,
    }));
    void syncCartToBackend(frontendCart, {
      verifyForCheckout: true,
      ignoreSuspension: true,
    }).then(async (syncResult) => {
      if (cancelled) return;
      if (!syncResult.ok) {
        setState({
          cart: null,
          loading: false,
          error: syncResult.error,
          syncedCartRevision: null,
        });
        return;
      }
      if (syncResult.cart) {
        setState({
          cart: syncResult.cart,
          loading: true,
          error: null,
          syncedCartRevision: null,
        });
      }
      const latestAddresses = latestAddressesRef.current;
      if (!latestAddresses.billingAddress || !latestAddresses.shippingAddress) {
        setState((previous) => ({ ...previous, loading: false }));
        return;
      }
      if (
        syncResult.cart
        && checkoutCartMatchesShippingAddress(syncResult.cart, latestAddresses.shippingAddress)
      ) {
        setState({
          cart: syncResult.cart,
          loading: false,
          error: null,
          syncedCartRevision: cartRevision,
        });
        return;
      }
      const result = await updateCartCustomer(
        latestAddresses.billingAddress,
        latestAddresses.shippingAddress,
      );
      if (cancelled) return;
      if (!result.ok) {
        setState((previous) => ({
          ...previous,
          loading: false,
          error: result.error,
          syncedCartRevision: null,
        }));
        return;
      }
      setState({
        cart: result.data,
        loading: false,
        error: null,
        syncedCartRevision: cartRevision,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [cartRevision]);

  useEffect(() => {
    if (!isBackendConfigured || !billingAddress || !shippingAddress) {
      lastRequestedAddressKeyRef.current = addressKey;
      return;
    }
    if (lastRequestedAddressKeyRef.current === addressKey) return;

    lastRequestedAddressKeyRef.current = addressKey;
    let cancelled = false;
    setState((previous) => ({ ...previous, loading: true, error: null }));
    const timeoutId = window.setTimeout(() => {
      void updateCartCustomer(billingAddress, shippingAddress).then((result) => {
        if (cancelled) return;
        setState((previous) => result.ok
          ? { ...previous, cart: result.data, loading: false, error: null }
          : { ...previous, loading: false, error: result.error });
      });
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [addressKey, cartRevision]);

  const adoptCart = useCallback((cart: StoreApiCart) => {
    setState((previous) => ({ ...previous, cart, loading: false, error: null }));
  }, []);

  const selectMethod = useCallback(async (packageId: number, rateId: string) => {
    setState((previous) => ({ ...previous, loading: true, error: null }));
    const result = await selectShippingMethod({ package_id: packageId, rate_id: rateId });
    if (result.ok) {
      setState((previous) => ({ ...previous, cart: result.data, loading: false, error: null }));
    } else {
      setState((previous) => ({ ...previous, loading: false, error: result.error }));
    }
    return result;
  }, []);

  return {
    ...state,
    methods: state.cart?.shipping_rates ?? [],
    totals: state.cart?.totals ?? null,
    coupons: state.cart?.coupons ?? [],
    adoptCart,
    selectMethod,
  };
}

/** Hook for fetching available shipping methods based on address. */
export function useShippingMethods(address: StoreApiAddress | null) {
  const [state, setState] = useState<{
    methods: StoreApiShippingOption[];
    loading: boolean;
    error: string | null;
  }>({
    methods: [],
    loading: false,
    error: null,
  });
  const addressKey = address
    ? [
        address.first_name ?? "",
        address.last_name ?? "",
        address.address_1 ?? "",
        address.address_2 ?? "",
        address.city ?? "",
        address.state ?? "",
        address.postcode ?? "",
        address.country ?? "",
        address.email ?? "",
        address.phone ?? "",
      ].join("|")
    : "";

  useEffect(() => {
    if (!isBackendConfigured || !address) {
      setState({ methods: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));

    void getShippingMethods(address).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setState({ methods: result.data, loading: false, error: null });
      } else {
        setState({
          methods: [],
          loading: false,
          error: result.error,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [addressKey]);

  return state;
}

/** Hook for calculating taxes based on address. */
export function useTaxCalculation(address: StoreApiAddress | null) {
  const [state, setState] = useState<{
    taxTotal: string;
    taxLines: Array<{ name: string; price: string }>;
    loading: boolean;
    error: string | null;
  }>({
    taxTotal: "0",
    taxLines: [],
    loading: false,
    error: null,
  });
  const addressKey = address
    ? [
        address.first_name ?? "",
        address.last_name ?? "",
        address.address_1 ?? "",
        address.address_2 ?? "",
        address.city ?? "",
        address.state ?? "",
        address.postcode ?? "",
        address.country ?? "",
        address.email ?? "",
        address.phone ?? "",
      ].join("|")
    : "";

  useEffect(() => {
    if (!isBackendConfigured || !address) {
      setState({ taxTotal: "0", taxLines: [], loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));

    void calculateTaxes(address).then((result) => {
      if (cancelled) return;
      if (result.ok) {
        setState({
          taxTotal: result.data.tax_total,
          taxLines: result.data.tax_lines,
          loading: false,
          error: null,
        });
      } else {
        setState({
          taxTotal: "0",
          taxLines: [],
          loading: false,
          error: result.error,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [addressKey]);

  return state;
}

/** Applies a coupon code to the cart. */
export async function checkoutApplyCoupon(code: string): Promise<{
  ok: boolean;
  error?: string;
  totals?: StoreApiCouponResponse;
}> {
  if (!isBackendConfigured) {
    return { ok: false, error: "Backend not configured" };
  }

  const result = await applyCoupon(code);
  if (result.ok) {
    return { ok: true, totals: result.data };
  }
  return { ok: false, error: result.error };
}

/** Removes a coupon code from the cart. */
export async function checkoutRemoveCoupon(code: string): Promise<{
  ok: boolean;
  error?: string;
  totals?: StoreApiCouponResponse;
}> {
  if (!isBackendConfigured) {
    return { ok: false, error: "Backend not configured" };
  }

  const result = await removeCoupon(code);
  return result.ok ? { ok: true, totals: result.data } : { ok: false, error: result.error };
}

export { isCartVirtual, isDigitalOnlyCart } from "./cartShippingMode";

/** Resolves the applicable free-shipping threshold for a country, with store-default and
 * legacy-static fallbacks when runtime zone metadata is not yet available. */
export function resolveFreeShippingThreshold(
  zones: StorefrontFreeShippingZone[] | null | undefined,
  countryCode: string | null | undefined,
  fallbackCountryCode?: string | null,
  legacyFallbackThreshold?: number | null,
): ResolvedFreeShippingThreshold {
  const normalizedZones = (zones || []).filter((zone) => zone.countryCode).map((zone) => ({
    ...zone,
    countryCode: zone.countryCode.toUpperCase(),
  }));
  const requestedCountry = countryCode?.trim().toUpperCase() || null;
  const fallbackCountry = fallbackCountryCode?.trim().toUpperCase() || null;

  const mapZone = (zone: StorefrontFreeShippingZone | undefined, usedFallbackCountry: boolean): ResolvedFreeShippingThreshold => ({
    threshold:
      zone && Number.isFinite(zone.minAmount) && (zone.minAmount ?? 0) >= 0
        ? zone.minAmount ?? null
        : null,
    matchedCountryCode: zone?.countryCode || null,
    usedFallbackCountry,
  });

  if (requestedCountry) {
    const exact = normalizedZones.find((zone) => zone.countryCode === requestedCountry);
    if (exact) {
      return mapZone(exact, false);
    }
  }

  if (fallbackCountry) {
    const fallback = normalizedZones.find((zone) => zone.countryCode === fallbackCountry);
    if (fallback) {
      return mapZone(fallback, requestedCountry !== null && fallback.countryCode !== requestedCountry);
    }
  }

  if (normalizedZones.length === 0 && Number.isFinite(legacyFallbackThreshold)) {
    return {
      threshold: legacyFallbackThreshold ?? null,
      matchedCountryCode: fallbackCountry || requestedCountry,
      usedFallbackCountry: Boolean(fallbackCountry && fallbackCountry !== requestedCountry),
    };
  }

  return { threshold: null, matchedCountryCode: null, usedFallbackCountry: false };
}
