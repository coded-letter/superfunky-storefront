import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ExternalLink, Heart } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { ResponsiveImage } from "../media";
import { useCart, useSoundUX, useToast, useWishlist } from "../state";
import { savedListEntityId } from "../state/savedListSync";
import { calculateDiscountPercent, useCurrency, useT } from "../locale";
import { ProductQuickViewModal } from "./ProductQuickViewModal";
import { shouldShowProductLearnMore } from "./productCardCta";
import { hasProductCardPrice } from "./productCardPrice";
import { resolveVariationSwatchColor } from "./variationSwatch";
export { resolveVariationSwatchColor } from "./variationSwatch";

export type ProductCardVariant = "default" | "minimal" | "editorial" | "gallery" | "simple" | "variation" | "expandable";

/** Forces the preview image's crop instead of the variant's own default aspect — used
 * by the shop page's "Card layout preview" style switch so visitors can compare
 * Editorial (the variant's own 4/5 crop), a square 1:1 crop, or a wider 4:3 crop without
 * changing anything else about the card. `"auto"` (the default) defers to the variant. */
export type ProductCardImageAspect = "auto" | "1/1" | "4/3";

/** Mirrors WooCommerce's core product types closely enough to drive card CTA/pricing. */
export type ProductType = "simple" | "external" | "variable" | "grouped";

export type ProductCardVariationValue = {
  label: string;
  /** Any valid CSS color value, including hex codes and named colors. */
  swatchColor?: string;
  /** @deprecated Use `swatchColor`; retained for existing card data. */
  swatchHex?: string;
  /** Index into the card's combined image list (main image + `gallery`) this value
   * should switch the preview to when picked — lets a colour swatch "swap the photo". */
  imageIndex?: number;
};

export type ProductCardVariationOption = {
  label: string;
  values: ProductCardVariationValue[];
};

export type ProductCardVariation = {
  id: string;
  databaseId?: number;
  attributes: Record<string, string>;
  priceLabel: string;
  priceAmount?: number;
  compareAtPriceLabel?: string;
  compareAtPriceAmount?: number;
  imageUrl?: string;
  sku?: string;
  inStock: boolean;
  stockQuantity?: number | null;
  backordersAllowed?: boolean;
};

export type ProductCardData = {
  id: string;
  databaseId?: number;
  /** Mirrors WooCommerce's featured/star flag for promoted storefront placements. */
  featured?: boolean;
  /** Overrides the legacy `/shop/:slug` destination with the canonical product URI. */
  href?: string;
  name: string;
  subtitle?: string;
  /** Plain-text long product description used when long descriptions are configured first. */
  longDescription?: string;
  imageUrl?: string;
  /** Extra photos for the `gallery`/`variation` variants — thumbnails swap the main
   * preview image on click, mirroring a real PDP gallery. */
  gallery?: string[];
  brand?: string;
  brandHref?: string;
  category?: string;
  categoryHref?: string;
  priceLabel: string;
  priceAmount?: number;
  compareAtPriceLabel?: string;
  compareAtPriceAmount?: number;
  /** Pre-formatted price range (e.g. "€49.00 – €69.00") for variable products — takes
   * precedence over `priceLabel` wherever a card shows pricing. */
  priceRangeLabel?: string;
  rating?: number;
  reviewCount?: number;
  inStock?: boolean;
  stockQuantity?: number | null;
  backordersAllowed?: boolean;
  badge?: string;
  isNew?: boolean;
  /** WooCommerce product type — governs the CTA label/behaviour. Defaults to "simple". */
  productType?: ProductType;
  /** Required for `productType: "external"` — the CTA opens this in a new tab instead of adding to cart. */
  externalUrl?: string;
  /** Variation attributes (e.g. Colour, Size) shown under the price for the `variation` card variant. */
  variationOptions?: ProductCardVariationOption[];
  /** Purchasable WooCommerce variations used to resolve the selected card options into a concrete cart line. */
  variations?: ProductCardVariation[];
};

export type ProductCardProps = {
  product: ProductCardData;
  variant?: ProductCardVariant;
  allowPurchaseActions?: boolean;
  /** Optional `<img loading>` hint for the main preview image — pass `"eager"` for cards in
   * or near the current slider viewport, `"lazy"` for offscreen ones. Defaults to the
   * browser's native behaviour (no attribute) when omitted. */
  imageLoading?: "eager" | "lazy";
  /** Overrides the variant's default image crop — see `ProductCardImageAspect`. */
  imageAspect?: ProductCardImageAspect;
};

const ProductCardPreferencesContext = createContext({ quickViewEnabled: true });

export function ProductCardPreferencesProvider({
  children,
  quickViewEnabled = true,
}: {
  children: ReactNode;
  quickViewEnabled?: boolean;
}) {
  return (
    <ProductCardPreferencesContext.Provider value={{ quickViewEnabled }}>
      {children}
    </ProductCardPreferencesContext.Provider>
  );
}

export function ProductCard({
  product,
  variant = "default",
  allowPurchaseActions = true,
  imageLoading,
  imageAspect = "auto",
}: ProductCardProps) {
  const { formatBaseAmount } = useCurrency();
  const t = useT();
  const navigate = useNavigate();
  const { quickViewEnabled } = useContext(ProductCardPreferencesContext);
  const { has, toggle } = useWishlist();
  const { playAction } = useSoundUX();
  const { addItem, items, openDrawer } = useCart();
  const { showToast } = useToast();
  const wishlistId = savedListEntityId(product);
  const isWishlisted = has(wishlistId);
  const isVariation = variant === "variation";
  const isGallery = variant === "gallery" || isVariation;
  const isSimple = variant === "simple";
  const isExpandable = variant === "expandable";
  const imageWrapperClass =
    imageAspect === "1/1"
      ? "aspect-square"
      : imageAspect === "4/3"
        ? "aspect-[4/3]"
        : variant === "editorial"
          ? "aspect-[4/5]"
          : isExpandable
            ? "aspect-square"
          : variant === "minimal"
            ? "aspect-square"
            : "aspect-[4/5]";
  const imageSizingClass = isExpandable ? "object-cover p-4 pt-12" : "object-cover";

  const defaultVariation = product.variations?.find((variation) => variation.inStock) || product.variations?.[0];
  const previewImages = [
    product.imageUrl,
    ...(product.gallery ?? []),
    ...(product.variations?.flatMap((variation) => variation.imageUrl ? [variation.imageUrl] : []) ?? []),
  ].filter((imageUrl, index, images): imageUrl is string => Boolean(imageUrl) && images.indexOf(imageUrl) === index);
  const defaultImageIndex = defaultVariation?.imageUrl ? previewImages.indexOf(defaultVariation.imageUrl) : -1;
  const [activeImageIndex, setActiveImageIndex] = useState(defaultImageIndex >= 0 ? defaultImageIndex : 0);
  const activeImageUrl = previewImages[activeImageIndex];
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(() =>
    defaultVariation?.attributes ||
    Object.fromEntries(product.variationOptions?.map((option) => [option.label, option.values[0]?.label || ""]) || []),
  );
  const selectedVariation = useMemo(
    () =>
      product.variations?.find((variation) =>
        Object.entries(selectedOptions).every(([label, value]) => variation.attributes[label] === value),
      ),
    [product.variations, selectedOptions],
  );
  const selectedPriceAmount = selectedVariation?.priceAmount ?? product.priceAmount;
  const selectedStockQuantity = selectedVariation?.stockQuantity ?? product.stockQuantity;
  const selectedBackordersAllowed = selectedVariation?.backordersAllowed ?? product.backordersAllowed;
  const selectedCartId = selectedVariation?.id || product.id;
  const isAtStockLimit = !selectedBackordersAllowed
    && selectedStockQuantity != null
    && (items.find((item) => item.id === selectedCartId)?.quantity ?? 0) >= selectedStockQuantity;
  const selectedCompareAtPriceAmount = selectedVariation?.compareAtPriceAmount ?? product.compareAtPriceAmount;
  const selectedPriceLabel = selectedPriceAmount !== undefined ? formatBaseAmount(selectedPriceAmount) : selectedVariation?.priceLabel || product.priceLabel;
  const selectedCompareAtPriceLabel = selectedCompareAtPriceAmount !== undefined
    ? formatBaseAmount(selectedCompareAtPriceAmount)
    : selectedVariation?.compareAtPriceLabel || product.compareAtPriceLabel;
  const variationAmounts = product.variations?.flatMap(({ priceAmount }) => priceAmount === undefined ? [] : [priceAmount]) || [];
  const convertedRangeLabel = variationAmounts.length
    ? `${formatBaseAmount(Math.min(...variationAmounts))} – ${formatBaseAmount(Math.max(...variationAmounts))}`
    : product.priceRangeLabel;
  const hasPrice = hasProductCardPrice({
    priceAmount: selectedPriceAmount,
    priceLabel: selectedPriceLabel,
    priceRangeLabel: convertedRangeLabel,
    variationPriceAmounts: variationAmounts,
  });
  const showLearnMore = shouldShowProductLearnMore(product, hasPrice);

  const discountPercent = convertedRangeLabel && !selectedVariation
    ? null
    : calculateDiscountPercent(
        selectedPriceAmount ?? selectedPriceLabel,
        selectedCompareAtPriceAmount ?? selectedCompareAtPriceLabel,
      );
  const expandablePills = [
    {
      label: product.inStock === false ? t("product.status.sold_out") : t("product.status.available"),
      className: product.inStock === false
        ? "bg-rose-600/90 text-white"
        : "bg-emerald-500/90 text-white dark:bg-emerald-400/85 dark:text-zinc-950",
    },
    discountPercent || product.badge?.toLowerCase() === "sale"
      ? { label: discountPercent ? t("product.status.promotion_percent", { percent: discountPercent }) : t("product.status.promotion"), className: "bg-rose-500/90 text-white" }
      : null,
    product.badge && product.badge.toLowerCase() !== "sale"
      ? { label: product.badge, className: "bg-zinc-950/85 text-white dark:bg-white/90 dark:text-zinc-950" }
      : product.isNew
        ? { label: t("product.status.new"), className: "bg-brand-gradient text-white" }
        : null,
  ].filter((pill): pill is { label: string; className: string } => Boolean(pill)).slice(0, 3);

  const ctaLabel =
    showLearnMore
      ? t("product.cta.learn_more")
      : product.productType === "external"
        ? product.externalUrl
          ? t("product.buy_now")
          : t("product.cta.view_product")
        : product.productType === "grouped"
          ? t("product.cta.view_products")
          : product.productType === "variable" && !product.variations?.length
            ? t("product.choose_options")
            : t("product.add_to_cart");

  const selectVariationOption = (label: string, value: string, imageIndex?: number) => {
    const nextOptions = { ...selectedOptions, [label]: value };
    const exactMatch = product.variations?.find((variation) =>
      Object.entries(nextOptions).every(([optionLabel, optionValue]) => variation.attributes[optionLabel] === optionValue),
    );
    const fallbackMatch = product.variations?.find(
      (variation) => variation.attributes[label] === value && variation.inStock,
    ) || product.variations?.find((variation) => variation.attributes[label] === value);
    const resolvedVariation = exactMatch || fallbackMatch;

    setSelectedOptions(resolvedVariation?.attributes || nextOptions);
    if (resolvedVariation) {
      const variationImageIndex = resolvedVariation.imageUrl ? previewImages.indexOf(resolvedVariation.imageUrl) : -1;
      setActiveImageIndex(variationImageIndex >= 0 ? variationImageIndex : 0);
    } else if (imageIndex !== undefined) {
      setActiveImageIndex(imageIndex);
    }
  };

  const handleAddToCart = () => {
    if (isAtStockLimit) return;
    if (!hasPrice || product.productType === "external" || product.productType === "grouped") return;
    if (product.inStock === false) {
      showToast({
        title: t("product.out_of_stock"),
        description: product.name,
      });
      return;
    }
    if (product.productType === "variable" && !product.variations?.length) {
      if (quickViewEnabled) {
        setIsQuickViewOpen(true);
      } else {
        playAction("navigation");
        navigate(product.href || "/shop");
      }
      return;
    }
    if (product.productType === "variable" && (!selectedVariation || !selectedVariation.inStock)) {
      showToast({
        title: t("product.variation_unavailable.title"),
        description: t("product.variation_unavailable.description"),
      });
      return;
    }
    playAction("add-to-cart");
    addItem({
      id: selectedVariation?.id || product.id,
      backendProductId: product.databaseId,
      backendVariationId: selectedVariation?.databaseId,
      variationAttributes: selectedVariation?.attributes,
      name: product.name,
      variantLabel: selectedVariation
        ? Object.entries(selectedVariation.attributes).map(([label, value]) => `${label}: ${value}`).join(" · ")
        : undefined,
      imageUrl: selectedVariation?.imageUrl || product.imageUrl,
      priceLabel: selectedPriceLabel,
      priceAmount: selectedPriceAmount,
      stockQuantity: selectedStockQuantity,
      backordersAllowed: selectedBackordersAllowed,
    });
    showToast({
      title: t("product.added"),
      description: product.name,
      action: { label: t("cart.view_cart"), onClick: openDrawer },
    });
  };

  return (
    <article className={getCardClassName(variant)}>
      <div
        className={`group/media relative isolate overflow-hidden [transform:translateZ(0)] ${
          isExpandable
            ? "rounded-xl bg-white dark:bg-zinc-900"
            : "rounded-2xl bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900"
        } ${imageWrapperClass}`}
      >
        {product.href ? (
          <Link
            to={product.href}
            draggable={false}
            aria-label={t("product.cta.view_product_aria", { name: product.name })}
            onClick={() => playAction("navigation")}
            className="relative block h-full w-full overflow-hidden rounded-[inherit] no-underline"
          >
            {activeImageUrl ? (
              <ResponsiveImage
                src={activeImageUrl}
                alt={product.name}
                priority={imageLoading === "eager"}
                draggable={false}
                sizes="(min-width: 1280px) 20vw, (min-width: 768px) 33vw, 50vw"
                className={`absolute inset-0 block !h-full !w-full max-w-none rounded-[inherit] ${imageSizingClass}`}
              />
            ) : (
              <span className="grid h-full w-full place-items-center text-sm font-medium text-zinc-400 dark:text-zinc-500">
                {previewImages.length > 1 ? t("product.image_alt_indexed", { index: activeImageIndex + 1 }) : t("product.image_alt")}
              </span>
            )}
          </Link>
        ) : activeImageUrl ? (
          <ResponsiveImage
            src={activeImageUrl}
            alt={product.name}
            priority={imageLoading === "eager"}
            draggable={false}
            sizes="(min-width: 1280px) 20vw, (min-width: 768px) 33vw, 50vw"
            className={`absolute inset-0 block !h-full !w-full max-w-none rounded-[inherit] ${imageSizingClass}`}
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-sm font-medium text-zinc-400 dark:text-zinc-500">
            {previewImages.length > 1 ? t("product.image_alt_indexed", { index: activeImageIndex + 1 }) : t("product.image_alt")}
          </div>
        )}

        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/media:opacity-100" />

        {!isExpandable && (product.badge ?? product.isNew) ? (
          <span className="absolute left-3 top-3 rounded-full bg-brand-gradient px-3 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-white shadow-soft">
            {product.badge ?? t("product.status.new")}
          </span>
        ) : null}

        {isExpandable ? (
          <div className="absolute left-3 top-3 grid max-w-[calc(100%_-_4.5rem)] justify-items-start gap-2">
            {expandablePills.map((pill) => (
              <span
                key={pill.label}
                className={`max-w-full truncate rounded-full px-3 py-1 text-[0.65rem] font-semibold shadow-soft backdrop-blur ${pill.className}`}
              >
                {pill.label}
              </span>
            ))}
          </div>
        ) : null}

        {!isExpandable && discountPercent ? (
          <span
            className={`absolute left-3 rounded-full bg-rose-500 px-2.5 py-1 text-[0.65rem] font-bold text-white shadow-soft ${
              product.badge ?? product.isNew ? "top-11" : "top-3"
            }`}
            title={`${discountPercent}% off`}
          >
            −{discountPercent}%
          </span>
        ) : null}

        {!isSimple && allowPurchaseActions ? (
          <button
            type="button"
            aria-label={isWishlisted ? t("product.remove_wishlist") : t("product.add_wishlist")}
            aria-pressed={isWishlisted}
            onClick={() => toggle(wishlistId)}
            className={`absolute right-3 top-3 inline-grid h-9 w-9 place-items-center rounded-control shadow-soft backdrop-blur transition-all duration-300 hover:scale-110 ${
              isWishlisted
                ? "bg-rose-500 text-white opacity-100"
                : `bg-white/90 text-zinc-700 hover:text-rose-500 dark:bg-zinc-950/80 dark:text-zinc-200 ${
                    isExpandable ? "opacity-100" : "opacity-0 group-hover/media:opacity-100"
                  }`
            }`}
          >
            <Heart className="h-4 w-4" fill={isWishlisted ? "currentColor" : "none"} aria-hidden="true" />
          </button>
        ) : null}

        {quickViewEnabled && variant !== "minimal" && !isSimple && !isExpandable ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              event.preventDefault();
              setIsQuickViewOpen(true);
            }}
            className="absolute inset-x-3 bottom-3 translate-y-3 rounded-control bg-white/95 px-3 py-2 text-xs font-semibold text-zinc-900 opacity-0 shadow-soft backdrop-blur transition-all duration-300 group-hover/media:translate-y-0 group-hover/media:opacity-100 dark:bg-zinc-950/90 dark:text-zinc-100"
          >
            {t("product.cta.quick_view")}
          </button>
        ) : null}

        {isExpandable && product.rating ? (
          <div className="absolute bottom-3 left-3 flex items-center gap-2 rounded-full bg-zinc-950/85 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-soft backdrop-blur transition-all duration-300 group-hover/media:opacity-100 group-focus-within/media:opacity-100">
            <StarRating rating={product.rating} />
            <span>{product.rating.toFixed(1)}</span>
            {product.reviewCount ? <span className="text-white/70">({product.reviewCount})</span> : null}
          </div>
        ) : null}
      </div>

      {isGallery && previewImages.length > 1 ? (
        <div
          className="flex max-w-full snap-x snap-mandatory gap-1.5 overflow-x-auto overscroll-x-contain px-0.5 pb-1 pt-0.5"
          aria-label={t("product.cta.gallery_thumbnails_aria", { name: product.name })}
        >
          {previewImages.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setActiveImageIndex(index)}
              aria-label={t("product.cta.show_photo_aria", { index: index + 1 })}
              aria-current={index === activeImageIndex}
              className={`grid h-12 w-12 shrink-0 snap-start place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-zinc-100 to-zinc-200 text-[0.6rem] font-medium text-zinc-400 transition dark:from-zinc-800 dark:to-zinc-900 dark:text-zinc-500 ${
                index === activeImageIndex ? "ring-2 ring-brand-500" : "opacity-70 hover:opacity-100"
              }`}
            >
              {previewImages[index] ? (
                <ResponsiveImage src={previewImages[index]} alt="" sizes="3rem" className="block !h-full !w-full object-cover" aria-hidden="true" />
              ) : (
                <span className="grid h-full w-full place-items-center">{index + 1}</span>
              )}
            </button>
          ))}
        </div>
      ) : null}

      <div className="grid gap-1.5">
        {product.brand && !isSimple ? (
          product.brandHref ? (
            <Link
              to={product.brandHref}
              draggable={false}
              onClick={() => playAction("navigation")}
              className="w-fit text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 no-underline hover:text-brand-600 hover:underline dark:text-zinc-400 dark:hover:text-brand-400"
            >
              {product.brand}
            </Link>
          ) : (
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              {product.brand}
            </span>
          )
        ) : null}
        {product.category && !isSimple && !isExpandable ? (
          product.categoryHref ? (
            <Link
              to={product.categoryHref}
              draggable={false}
              onClick={() => playAction("navigation")}
              className="w-fit text-[0.68rem] font-semibold uppercase tracking-wider text-brand-600 no-underline hover:underline dark:text-brand-400"
            >
              {product.category}
            </Link>
          ) : (
            <span className="text-[0.68rem] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              {product.category}
            </span>
          )
        ) : null}

        <h3
          className={
            variant === "editorial"
              ? "m-0 line-clamp-2 h-[3.25rem] break-words font-display text-lg font-semibold leading-6 text-zinc-900 dark:text-zinc-100"
              : "m-0 line-clamp-2 h-[3.25rem] break-words text-base font-semibold leading-6 text-zinc-900 dark:text-zinc-100"
          }
        >
          {product.href ? (
            <Link
              to={product.href}
              onClick={() => playAction("navigation")}
              className="text-inherit no-underline transition hover:text-brand-600 dark:hover:text-brand-400"
            >
              {product.name}
            </Link>
          ) : product.name}
        </h3>

        {product.subtitle && !isSimple ? <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">{product.subtitle}</p> : null}

        {(product.rating ?? product.reviewCount) && !isSimple && !isExpandable ? (
          <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
            <StarRating rating={product.rating ?? 0} />
            <span className="ml-0.5 font-medium text-zinc-700 dark:text-zinc-300">{(product.rating ?? 0).toFixed(1)}</span>
            <span>({product.reviewCount ?? 0})</span>
          </div>
        ) : null}

        <div className="mt-0.5 flex flex-wrap items-baseline gap-2">
          {convertedRangeLabel && !selectedVariation ? (
            <strong className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{convertedRangeLabel}</strong>
          ) : (
            <>
              <strong className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{selectedPriceLabel}</strong>
              {selectedCompareAtPriceLabel ? (
                <span className="text-sm text-zinc-400 line-through dark:text-zinc-500">{selectedCompareAtPriceLabel}</span>
              ) : null}
            </>
          )}
        </div>

        {(isVariation || product.productType === "variable") && product.variationOptions?.length ? (
          <div className="grid gap-1.5 pt-0.5">
            {product.variationOptions.map((option) => (
              <div key={option.label} className="flex flex-wrap items-center gap-1.5">
                <span className="text-[0.68rem] font-medium text-zinc-400 dark:text-zinc-500">{option.label}:</span>
                {option.values.map((value) => {
                  const isSelected = selectedOptions[option.label] === value.label;
                  const swatchColor = resolveVariationSwatchColor(
                    option.label,
                    value.label,
                    value.swatchColor || value.swatchHex,
                  );
                  const isAvailable = !product.variations?.length || product.variations.some(
                    (variation) => variation.attributes[option.label] === value.label && variation.inStock,
                  );
                  return swatchColor ? (
                    <button
                      key={value.label}
                      type="button"
                      title={value.label}
                      aria-label={value.label}
                      aria-pressed={isSelected}
                      disabled={!isAvailable}
                      onClick={() => selectVariationOption(option.label, value.label, value.imageIndex)}
                      style={{ backgroundColor: swatchColor }}
                      className={`h-5 w-5 shrink-0 rounded-full border border-black/10 shadow-sm transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-35 dark:border-white/20 ${
                        isSelected ? "ring-2 ring-brand-500 ring-offset-2 dark:ring-offset-zinc-900" : ""
                      }`}
                    />
                  ) : (
                    <button
                      key={value.label}
                      type="button"
                      aria-pressed={isSelected}
                      disabled={!isAvailable}
                      onClick={() => selectVariationOption(option.label, value.label, value.imageIndex)}
                      className={`rounded-full border px-2 py-0.5 text-[0.68rem] font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${
                        isSelected
                          ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300"
                          : "border-zinc-200 text-zinc-600 hover:border-brand-300 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-brand-500 dark:hover:text-brand-300"
                      }`}
                    >
                      {value.label}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {!isSimple ? (
        <div className="mt-auto flex gap-2 pt-1">
          {product.productType === "external" && product.externalUrl ? (
            <a
              href={product.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => playAction("navigation")}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-control bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white no-underline shadow-soft transition hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-glow active:translate-y-0 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-brand-400"
            >
              {ctaLabel}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          ) : showLearnMore || product.productType === "external" || product.productType === "grouped" ? (
            <Link
              to={product.href || "/shop"}
              onClick={() => playAction("navigation")}
              className="flex flex-1 items-center justify-center rounded-control bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white no-underline shadow-soft transition hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-glow active:translate-y-0 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-brand-400"
            >
              {ctaLabel}
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isAtStockLimit}
              className="flex-1 rounded-control bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-glow active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-brand-400"
            >
              {ctaLabel}
            </button>
          )}
        </div>
      ) : null}

      {quickViewEnabled && isQuickViewOpen ? <ProductQuickViewModal product={product} onClose={() => setIsQuickViewOpen(false)} /> : null}
    </article>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-brand-500 dark:text-brand-400">
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = index < Math.round(rating);
        return (
          <svg
            key={index}
            viewBox="0 0 20 20"
            className="h-3.5 w-3.5"
            fill={filled ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.2"
            aria-hidden="true"
          >
            <path d="M10 1.6l2.5 5.2 5.7.8-4.1 4 1 5.7L10 14.7l-5.1 2.6 1-5.7-4.1-4 5.7-.8L10 1.6Z" />
          </svg>
        );
      })}
    </span>
  );
}

function getCardClassName(variant: ProductCardVariant): string {
  const base = `sf-product-card funky-product-card funky-product-card--${variant} group grid h-full gap-3 rounded-3xl transition-all duration-300`;

  if (variant === "minimal" || variant === "simple") {
    return `${base} bg-transparent p-1`;
  }

  if (variant === "editorial") {
    return `${base} border border-zinc-200/80 bg-white p-4 shadow-soft hover:-translate-y-1 hover:shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-900`;
  }

  if (variant === "expandable") {
    return `${base} rounded-xl border border-zinc-200 bg-white p-4 shadow-none hover:shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-900`;
  }

  return `${base} border border-zinc-200/80 bg-white p-4 shadow-soft hover:-translate-y-1 hover:shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-900`;
}
