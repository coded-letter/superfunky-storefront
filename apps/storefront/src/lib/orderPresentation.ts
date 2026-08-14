export type OrderTranslator = (
  key: string,
  replacements?: Record<string, string | number>,
) => string;

export function localizedOrderStatus(
  status: string,
  statusText: string | undefined,
  t: OrderTranslator,
): string {
  const key = `order_status.${status}`;
  const translated = t(key);
  return translated === key ? statusText || status.split("-").join(" ") : translated;
}
