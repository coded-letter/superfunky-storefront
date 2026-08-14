import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Link } from "react-router-dom";
import { useCart, useSoundUX, useToast } from "../state";
import { useCurrency } from "../locale";
import type { ProductCardData } from "./ProductCard";
import { ResponsiveImage } from "../media";
import { hasProductCardPrice } from "./productCardPrice";

export type ProductQuickViewModalProps = {
  product: ProductCardData;
  onClose: () => void;
};

/**
 * Lightweight "quick view" surfaced from a product card's hover CTA — shows the main
 * photo, price, rating, and an add-to-cart action without leaving the current page.
 * Not a full PDP: no reviews thread, no long description — just enough to decide
 * whether to click through or add straight to cart.
 */
export function ProductQuickViewModal({ product, onClose }: ProductQuickViewModalProps) {
  const { formatBaseAmount } = useCurrency();
  const { playAction } = useSoundUX();
  const { addItem, openDrawer } = useCart();
  const { showToast } = useToast();
  const previewImages = [product.imageUrl, ...(product.gallery ?? [])].filter(Boolean) as string[];
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const activeImageUrl = previewImages[activeImageIndex];
  const variationAmounts = product.variations?.flatMap(({ priceAmount }) => priceAmount === undefined ? [] : [priceAmount]) || [];
  const priceLabel = product.priceAmount !== undefined ? formatBaseAmount(product.priceAmount) : product.priceLabel;
  const compareAtPriceLabel = product.compareAtPriceAmount !== undefined ? formatBaseAmount(product.compareAtPriceAmount) : product.compareAtPriceLabel;
  const rangeLabel = variationAmounts.length
    ? `${formatBaseAmount(Math.min(...variationAmounts))} – ${formatBaseAmount(Math.max(...variationAmounts))}`
    : product.priceRangeLabel;
  const hasPrice = hasProductCardPrice({
    priceAmount: product.priceAmount,
    priceLabel,
    priceRangeLabel: rangeLabel,
    variationPriceAmounts: variationAmounts,
  });
  const showLearnMore = product.productType !== "external" && product.productType !== "grouped" && product.productType !== "variable" && !hasPrice;
  const ctaLabel =
    showLearnMore
      ? "Learn more"
      : product.productType === "external"
        ? product.externalUrl
          ? "Buy now"
          : "View product"
        : product.productType === "grouped"
          ? "View products"
          : product.productType === "variable"
            ? "Select options"
            : "Add to cart";

  // Lock page scroll while open, matching the image lightbox's behaviour.
  useEffect(() => {
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="sf-product-quick-view fixed inset-0 z-[60] flex items-center justify-center bg-zinc-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Quick view — ${product.name}`}
      onClick={onClose}
    >
      <div
        className="funky-product-quick-view relative grid max-h-[90vh] w-full max-w-3xl gap-0 overflow-y-auto rounded-3xl bg-white shadow-soft-lg dark:bg-zinc-900 sm:grid-cols-2"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close quick view"
          className="absolute right-3 top-3 z-10 inline-grid h-9 w-9 place-items-center rounded-full bg-white/90 text-zinc-700 shadow-soft backdrop-blur transition hover:bg-white dark:bg-zinc-950/80 dark:text-zinc-200"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>

        <div className="aspect-square overflow-hidden bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 sm:aspect-auto">
          {activeImageUrl ? (
            <ResponsiveImage
              src={activeImageUrl}
              alt={product.name}
              priority
              sizes="(min-width: 640px) 24rem, 100vw"
              className="h-full w-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="grid h-full w-full min-h-[16rem] place-items-center text-sm font-medium text-zinc-400 dark:text-zinc-500">Product image</div>
          )}
        </div>

        <div className="grid content-start gap-3 p-6 sm:p-8">
          {product.brand ? (
            <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">{product.brand}</span>
          ) : null}
          {product.category ? (
            <span className="text-[0.68rem] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">{product.category}</span>
          ) : null}

          <h3 className="m-0 pr-8 font-display text-xl font-bold text-zinc-900 dark:text-zinc-100">{product.name}</h3>

          {product.subtitle ? <p className="m-0 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">{product.subtitle}</p> : null}

          {(product.rating ?? product.reviewCount) ? (
            <div className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
              <QuickViewStarRating rating={product.rating ?? 0} />
              <span className="ml-0.5 font-medium text-zinc-700 dark:text-zinc-300">{(product.rating ?? 0).toFixed(1)}</span>
              <span>({product.reviewCount ?? 0})</span>
            </div>
          ) : null}

          {previewImages.length > 1 ? (
            <div className="flex gap-1.5">
              {previewImages.map((url, index) => (
                <button
                  key={url + index}
                  type="button"
                  onClick={() => setActiveImageIndex(index)}
                  aria-label={`Show photo ${index + 1}`}
                  aria-current={index === activeImageIndex}
                  className={`h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-zinc-100 transition dark:bg-zinc-800 ${
                    index === activeImageIndex ? "ring-2 ring-brand-500" : "opacity-70 hover:opacity-100"
                  }`}
                >
                  <ResponsiveImage src={url} alt="" sizes="3rem" className="h-full w-full object-cover" aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : null}

          <div className="mt-1 flex flex-wrap items-baseline gap-2">
            {rangeLabel ? (
              <strong className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{rangeLabel}</strong>
            ) : (
              <>
                <strong className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{priceLabel}</strong>
                {compareAtPriceLabel ? (
                  <span className="text-sm text-zinc-400 line-through dark:text-zinc-500">{compareAtPriceLabel}</span>
                ) : null}
              </>
            )}
          </div>

          <div className="mt-2 flex gap-2">
            {showLearnMore || product.productType === "variable" || product.productType === "grouped" || (product.productType === "external" && !product.externalUrl) ? (
              <Link
                to={product.href ?? `/shop/${encodeURIComponent(product.id)}`}
                onClick={onClose}
                className="flex-1 rounded-control bg-zinc-900 px-5 py-3 text-center text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-glow active:translate-y-0 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-brand-400"
              >
                {ctaLabel}
              </Link>
            ) : product.productType === "external" && product.externalUrl ? (
              <a
                href={product.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex-1 rounded-control bg-zinc-900 px-5 py-3 text-center text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-glow active:translate-y-0 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-brand-400"
              >
                {ctaLabel}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => {
                  playAction("add-to-cart");
                  addItem({
                    id: product.id,
                    backendProductId: product.databaseId,
                    name: product.name,
                    imageUrl: product.imageUrl,
                    priceLabel: rangeLabel ?? priceLabel,
                    priceAmount: product.priceAmount,
                  });
                  showToast({
                    title: "Added to cart",
                    description: product.name,
                    action: { label: "View cart", onClick: openDrawer },
                  });
                  onClose();
                }}
                className="flex-1 rounded-control bg-zinc-900 px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-glow active:translate-y-0 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-brand-400"
              >
                {ctaLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function QuickViewStarRating({ rating }: { rating: number }) {
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
