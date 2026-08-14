const CRYPTO_CURRENCY_FORMAT: Record<string, { symbol: string; decimals: number }> = {
  BTC: { symbol: "₿", decimals: 8 },
  ETH: { symbol: "Ξ", decimals: 6 },
};

export function formatCurrencyAmount(
  amount: number,
  currencyCode: string,
  fallbackSymbol: string,
  locale: string,
): string {
  const code = currencyCode.toUpperCase();
  const crypto = CRYPTO_CURRENCY_FORMAT[code];
  if (crypto) {
    const formatted = amount.toFixed(crypto.decimals).replace(/\.?0+$/, "");
    return `${crypto.symbol}\u202F${formatted}`;
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: code,
    }).format(amount);
  } catch {
    return `${fallbackSymbol || code} ${amount.toFixed(2)}`;
  }
}

export function parseLocalizedPrice(value: string): number | null {
  const normalized = value
    .replace(/&(?:nbsp|#160|#x0*a0);/gi, "")
    .trim()
    .replace(/\s|\u00a0/g, "")
    .replace(/[^\d,.-]/g, "");
  if (!normalized) return null;
  const commaIndex = normalized.lastIndexOf(",");
  const dotIndex = normalized.lastIndexOf(".");
  let numeric = normalized;
  if (commaIndex >= 0 && dotIndex >= 0) {
    const decimalSeparator = commaIndex > dotIndex ? "," : ".";
    const thousandsSeparator = decimalSeparator === "," ? "." : ",";
    numeric = normalized.split(thousandsSeparator).join("").replace(decimalSeparator, ".");
  } else {
    const separator = commaIndex >= 0 ? "," : dotIndex >= 0 ? "." : "";
    if (separator) {
      const fractionalDigits = normalized.length - normalized.lastIndexOf(separator) - 1;
      numeric = fractionalDigits > 0 && fractionalDigits <= 2
        ? normalized.replace(separator, ".")
        : normalized.split(separator).join("");
    }
  }
  const amount = Number(numeric);
  return Number.isFinite(amount) ? amount : null;
}

export function calculateDiscountPercent(
  salePrice: number | string | null | undefined,
  regularPrice: number | string | null | undefined,
): number | null {
  const saleAmount = typeof salePrice === "number"
    ? salePrice
    : salePrice
      ? parseLocalizedPrice(salePrice)
      : null;
  const regularAmount = typeof regularPrice === "number"
    ? regularPrice
    : regularPrice
      ? parseLocalizedPrice(regularPrice)
      : null;

  if (
    saleAmount === null ||
    regularAmount === null ||
    !Number.isFinite(saleAmount) ||
    !Number.isFinite(regularAmount) ||
    saleAmount < 0 ||
    regularAmount <= saleAmount
  ) {
    return null;
  }

  return Math.round((1 - saleAmount / regularAmount) * 100);
}
