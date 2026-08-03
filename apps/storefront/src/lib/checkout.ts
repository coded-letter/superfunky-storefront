/** Checkout utilities — shipping, taxes, coupons, and related calculations. */

import { useEffect, useState } from "react";
import { isBackendConfigured } from "./env";
import {
  applyCoupon,
  calculateTaxes,
  getShippingMethods,
  removeCoupon,
  type StoreApiAddress,
  type StoreApiCouponResponse,
  type StoreApiShippingMethod,
  type StoreApiShippingOption,
} from "./wcStoreApi";

export interface CheckoutState {
  shippingMethods: StoreApiShippingOption[];
  selectedShippingMethodId: string | null;
  appliedCoupons: string[];
  taxTotal: string;
  taxLines: Array<{ name: string; price: string }>;
  isLoading: boolean;
  error: string | null;
}

export type DisplayShippingMethod = {
  id: string;
  label: string;
  eta: string;
  price: number;
  packageId?: number;
  rateId?: string;
  selected?: boolean;
  disabled?: boolean;
};

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
}> {
  if (!isBackendConfigured) {
    return { ok: false, error: "Backend not configured" };
  }

  const result = await removeCoupon(code);
  return result.ok ? { ok: true } : { ok: false, error: result.error };
}

/** Finds the first free-shipping eligible method from the available methods, if any. */
export function findFreeShippingMethod(
  methods: StoreApiShippingOption[]
): StoreApiShippingMethod | null {
  for (const pkg of methods) {
    for (const method of pkg.shipping_methods) {
      if (method.price === "0" || parseFloat(method.price) === 0) {
        return method;
      }
    }
  }
  return null;
}

/** Returns true if all cart items are virtual (non-shippable). */
export function isCartVirtual(cartItems: Array<{ virtual?: boolean }>): boolean {
  if (!cartItems.length) return false;
  return cartItems.every((item) => item.virtual === true);
}

/** Flattens Store API shipping packages into UI-friendly methods. */
export function mapShippingOptionsToDisplayMethods(
  backendOptions: StoreApiShippingOption[] | null | undefined,
  fallbackMethods: DisplayShippingMethod[] = [],
): DisplayShippingMethod[] {
  if (!backendOptions?.length) {
    return fallbackMethods;
  }

  const allMethods = backendOptions.flatMap((pkg) =>
    pkg.shipping_methods.map((method) => ({
      id: method.rate || method.id,
      label: method.name,
      eta: method.delivery_time || "Estimated delivery time",
      price: Number.parseFloat(method.price) || 0,
      packageId: pkg.package_id,
      rateId: method.rate || method.id,
      selected: method.selected === true,
      disabled: method.choice_disabled,
    })),
  );

  return allMethods.length > 0 ? allMethods : fallbackMethods;
}

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
