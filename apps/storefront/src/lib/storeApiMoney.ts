export type StoreApiMoney = {
  currency_code: string;
  currency_minor_unit: number;
  currency_decimal_separator?: string;
  currency_thousand_separator?: string;
};

export function storeApiAmount(value: string | null | undefined, money: StoreApiMoney): number {
  const amount = Number(value ?? "0") / 10 ** money.currency_minor_unit;
  return Number.isFinite(amount) ? amount : 0;
}

export function formatStoreApiMoney(
  value: string,
  money: StoreApiMoney,
  locale?: string,
): string {
  const minorUnit = money.currency_minor_unit;
  const amount = storeApiAmount(value, money);

  if (Number.isFinite(amount)) {
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: money.currency_code,
        minimumFractionDigits: minorUnit,
        maximumFractionDigits: minorUnit,
      }).format(amount);
    } catch {
      // Fall through to WooCommerce's separators when Intl lacks the currency.
    }
  }

  const digits = String(value || "0").padStart(minorUnit + 1, "0");
  const major = minorUnit ? digits.slice(0, -minorUnit) : digits;
  const minor = minorUnit ? digits.slice(-minorUnit) : "";
  const groupedMajor = major.replace(/\B(?=(\d{3})+(?!\d))/g, money.currency_thousand_separator || ",");
  const numeric = minor
    ? `${groupedMajor}${money.currency_decimal_separator || "."}${minor}`
    : groupedMajor;
  return `${money.currency_code} ${numeric}`;
}
