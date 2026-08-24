import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus } from "lucide-react";
import type { ProductCardData } from "../catalog/ProductCard";
import { useT } from "../locale";
import { useCart } from "../state";
import { ResponsiveImage } from "../media";
import {
  getCartRecommendationHref,
  isCartRecommendationOptionAvailable,
  resolveCartRecommendationVariation,
} from "./cartRecommendation";

export type CartEmptyRecommendationsProps = {
  products: ProductCardData[];
  onNavigate: () => void;
};

function PromotedProductCard({
  product,
  onNavigate,
}: {
  product: ProductCardData;
  onNavigate: () => void;
}) {
  const t = useT();
  const { addItem } = useCart();
  const defaultVariation = product.variations?.find((variation) => variation.inStock);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    defaultVariation?.attributes ?? {},
  );
  const [justAdded, setJustAdded] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const selectedVariation = useMemo(
    () => resolveCartRecommendationVariation(product, selectedOptions),
    [product, selectedOptions],
  );

  useEffect(() => {
    if (!justAdded) return;
    const timer = window.setTimeout(() => setJustAdded(false), 2_000);
    return () => window.clearTimeout(timer);
  }, [justAdded]);

  const selectOption = (label: string, value: string) => {
    setSelectedOptions((currentOptions) => {
      const nextOptions = { ...currentOptions };
      if (value) nextOptions[label] = value;
      else delete nextOptions[label];
      return nextOptions;
    });
  };

  const isVariable = product.productType === "variable";
  const resolvedImageUrl = selectedVariation?.imageUrl || product.imageUrl;
  const resolvedPriceLabel = selectedVariation?.priceLabel || product.priceLabel;
  const resolvedPriceAmount = selectedVariation?.priceAmount ?? product.priceAmount;
  const hasPrice = resolvedPriceAmount !== undefined || resolvedPriceLabel.trim().length > 0;
  const canAddSimple =
    !isVariable
    && product.productType !== "external"
    && product.productType !== "grouped"
    && product.inStock !== false
    && hasPrice;
  const canAddVariation = isVariable && Boolean(selectedVariation) && hasPrice;
  const canAdd = canAddSimple || canAddVariation;

  const addToCart = () => {
    if (!canAdd) return;
    addItem(
      {
        id: selectedVariation?.id || product.id,
        backendProductId: product.databaseId,
        backendVariationId: selectedVariation?.databaseId,
        variationAttributes: selectedVariation?.attributes,
        variantLabel: selectedVariation
          ? Object.entries(selectedVariation.attributes)
              .map(([label, value]) => `${label}: ${value}`)
              .join(" · ")
          : undefined,
        name: product.name,
        imageUrl: resolvedImageUrl,
        priceLabel: resolvedPriceLabel,
        priceAmount: resolvedPriceAmount,
      },
      quantity,
    );
    setQuantity(1);
    setJustAdded(true);
  };

  const linkLabel = isVariable && product.inStock !== false
    ? t("product.choose_options")
    : t("product.cta.learn_more");

  return (
    <article className="flex w-full min-w-full max-w-72 shrink-0 snap-center flex-col rounded-2xl border border-zinc-100 bg-zinc-50/60 p-3 text-left dark:border-zinc-800/80 dark:bg-zinc-900/40">
      <Link
        to={getCartRecommendationHref(product)}
        onClick={onNavigate}
        className="flex items-center gap-3 no-underline"
      >
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
          {resolvedImageUrl ? (
            <ResponsiveImage
              src={resolvedImageUrl}
              alt=""
              sizes="4rem"
              className="h-full w-full object-cover"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {product.name}
          </p>
          {resolvedPriceLabel || product.priceRangeLabel ? (
            <p className="m-0 mt-0.5 text-sm font-bold text-brand-600 dark:text-brand-400">
              {resolvedPriceLabel || product.priceRangeLabel}
            </p>
          ) : null}
        </div>
      </Link>

      {isVariable && product.variationOptions?.length && defaultVariation ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {product.variationOptions.map((option) => (
            <label
              key={option.label}
              className="grid min-w-0 gap-1 text-[0.65rem] font-semibold text-zinc-500 dark:text-zinc-400"
            >
              <span className="truncate">{option.label}</span>
              <select
                value={selectedOptions[option.label] || ""}
                onChange={(event) => selectOption(option.label, event.target.value)}
                className="min-w-0 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              >
                <option value="">{t("product.select_options")}</option>
                {option.values.map((value) => {
                  const isAvailable = isCartRecommendationOptionAvailable(
                    product,
                    selectedOptions,
                    option.label,
                    value.label,
                  );
                  return (
                    <option key={value.label} value={value.label} disabled={!isAvailable}>
                      {value.label}
                    </option>
                  );
                })}
              </select>
            </label>
          ))}
        </div>
      ) : null}

      {canAdd ? (
        <div className="mt-3 flex items-center gap-2">
          <div className="inline-flex shrink-0 items-center rounded-full border border-zinc-200 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-950">
            <button
              type="button"
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              disabled={quantity === 1}
              aria-label={`Decrease quantity of ${product.name}`}
              className="inline-grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-35 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
            <span className="min-w-6 text-center text-xs font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((current) => Math.min(99, current + 1))}
              disabled={quantity === 99}
              aria-label={`Increase quantity of ${product.name}`}
              className="inline-grid h-7 w-7 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-35 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={addToCart}
            className="min-w-0 flex-1 rounded-full bg-brand-gradient px-3 py-2 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5"
          >
            {justAdded ? t("cart.added") : t("cart.add")}
          </button>
        </div>
      ) : (
        <Link
          to={getCartRecommendationHref(product)}
          onClick={onNavigate}
          className="mt-3 block rounded-full bg-brand-gradient px-4 py-2 text-center text-sm font-semibold text-white no-underline shadow-glow transition hover:-translate-y-0.5"
        >
          {linkLabel}
        </Link>
      )}
    </article>
  );
}

export function CartEmptyRecommendations({
  products,
  onNavigate,
}: CartEmptyRecommendationsProps) {
  const t = useT();
  if (!products.length) return null;

  return (
    <section className="mx-auto w-full max-w-xs overflow-hidden">
      <p className="m-0 mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
        {t("cart.you_might_like")}
      </p>
      <div className="flex w-full snap-x snap-mandatory items-start gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain px-4 pb-2">
        {products.map((product) => (
          <PromotedProductCard key={product.id} product={product} onNavigate={onNavigate} />
        ))}
      </div>
    </section>
  );
}
