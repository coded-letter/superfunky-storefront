import type { StoreApiShippingMethod, StoreApiShippingOption } from "./wcStoreApi";

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

export const DEFAULT_FREE_SHIPPING_METHOD: DisplayShippingMethod = {
  id: "fallback-free-shipping",
  label: "Free shipping",
  eta: "Standard delivery",
  price: 0,
};

function packageRates(option: StoreApiShippingOption): StoreApiShippingMethod[] {
  return option.shipping_rates ?? option.shipping_methods ?? [];
}

/** Flattens the live rates from every WooCommerce shipping package. */
export function mapShippingOptionsToDisplayMethods(
  backendOptions: StoreApiShippingOption[] | null | undefined,
  fallbackMethods: DisplayShippingMethod[] = [],
  currencyMinorUnit = 0,
): DisplayShippingMethod[] {
  if (!backendOptions?.length) return fallbackMethods;

  const allMethods = backendOptions.flatMap((option) =>
    packageRates(option).flatMap((method) => {
      const rateId = method.rate_id || method.rate || method.id;
      if (!rateId) return [];

      return [{
        id: rateId,
        label: method.name,
        eta: method.delivery_time || method.description || "Estimated delivery time",
        price: (Number.parseFloat(method.price) || 0) / 10 ** currencyMinorUnit,
        packageId: option.package_id,
        rateId,
        selected: method.selected === true,
        disabled: method.choice_disabled === true,
      }];
    }),
  );

  return allMethods.length > 0 ? allMethods : fallbackMethods;
}

/** Finds the first zero-cost rate from the available WooCommerce packages. */
export function findFreeShippingMethod(
  options: StoreApiShippingOption[],
): StoreApiShippingMethod | null {
  for (const option of options) {
    for (const method of packageRates(option)) {
      if (Number.parseFloat(method.price) === 0) return method;
    }
  }
  return null;
}
