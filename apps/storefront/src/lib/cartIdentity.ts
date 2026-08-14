export type BackendCartIdentity = {
  id: number;
  product_id?: number;
  variation_id?: number;
};

export function backendItemMatches(
  item: BackendCartIdentity,
  productId: number,
  variationId: number | null,
): boolean {
  const purchasableId = variationId ?? productId;
  if (item.id === purchasableId) return true;
  return (
    item.product_id === productId &&
    (variationId === null || item.variation_id === variationId)
  );
}
