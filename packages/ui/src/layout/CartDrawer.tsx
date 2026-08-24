import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import type { ProductCardData } from "../catalog/ProductCard";
import { useT } from "../locale";
import { useCart, useSoundUX } from "../state";
import { ResponsiveImage } from "../media";

export type CartDrawerProps = {
  /** Shown as a "you might like" suggestion when the cart is empty — has no legacy
   * reference, so this pulls from whatever the app considers a good default pick. */
  featuredProduct?: ProductCardData;
  /** Whole empty-cart "you might like" promoted-product block on/off — independent of
   * whether a `featuredProduct` was actually passed in. `true` (default). */
  showPromotedProduct?: boolean;
};

/**
 * Compact slide-in cart panel — the primary "add to cart" feedback surface, replacing
 * a full-page redirect. Right-side panel on desktop, full-width bottom-anchored sheet
 * on mobile so it stays reachable with a thumb.
 */
export function CartDrawer({ featuredProduct, showPromotedProduct = true }: CartDrawerProps) {
  const t = useT();
  const { items, itemCount, subtotalLabel, isDrawerOpen, closeDrawer, addItem, removeItem, updateQuantity } = useCart();
  const { playAction } = useSoundUX();
  const [isVisible, setIsVisible] = useState(false);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!isDrawerOpen) return;
    playAction("modal-open");
    const frame = window.requestAnimationFrame(() => setIsVisible(true));
    return () => window.cancelAnimationFrame(frame);
  }, [isDrawerOpen, playAction]);

  useEffect(() => {
    if (!isDrawerOpen) return;

    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.documentElement.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDrawerOpen]);

  const handleClose = () => {
    setIsVisible(false);
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      closeDrawer();
      closeTimerRef.current = null;
    }, 260);
  };

  if (!isDrawerOpen) return null;

  return (
    <div
      role="presentation"
      onClick={handleClose}
      className={`sf-cart-drawer fixed inset-0 z-[70] flex justify-end bg-zinc-950/60 backdrop-blur-sm transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("cart.aria")}
        onClick={(event) => event.stopPropagation()}
        className={`funky-cart-drawer flex h-full w-full max-w-full flex-col bg-white shadow-soft-lg transition-transform duration-300 ease-out dark:bg-zinc-950 sm:max-w-md ${
          isVisible ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-y-0 sm:translate-x-full"
        } mt-auto max-h-[92dvh] rounded-t-3xl sm:mt-0 sm:h-full sm:max-h-none sm:rounded-none sm:border-l sm:border-zinc-200 sm:dark:border-zinc-800`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="m-0 flex items-center gap-2 font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">
            <ShoppingBag className="h-5 w-5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            {t("cart.title")}
            {itemCount > 0 ? (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                {itemCount}
              </span>
            ) : null}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label={t("cart.close")}
            className="inline-grid h-9 w-9 shrink-0 place-items-center rounded-full border border-zinc-200 text-zinc-500 transition hover:border-brand-300 hover:text-brand-600 dark:border-zinc-800 dark:text-zinc-400 dark:hover:border-brand-500 dark:hover:text-brand-300"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <EmptyCartState featuredProduct={featuredProduct} showPromotedProduct={showPromotedProduct} onNavigate={handleClose} onAddToCart={addItem} />
          ) : (
            <ul className="m-0 grid list-none gap-4 p-0">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 rounded-2xl border border-zinc-100 bg-zinc-50/60 p-3 dark:border-zinc-800/80 dark:bg-zinc-900/40"
                >
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
                    {item.imageUrl ? (
                      <ResponsiveImage src={item.imageUrl} alt="" sizes="5rem" className="h-full w-full object-cover" />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <p className="m-0 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</p>
                      {item.variantLabel ? (
                        <p className="m-0 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{item.variantLabel}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex items-center gap-1 rounded-full border border-zinc-200 p-0.5 dark:border-zinc-700">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          aria-label={`Decrease quantity of ${item.name}`}
                          className="inline-grid h-6 w-6 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        >
                          <Minus className="h-3 w-3" aria-hidden="true" />
                        </button>
                        <span className="min-w-[1.5rem] text-center text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          aria-label={`Increase quantity of ${item.name}`}
                          className="inline-grid h-6 w-6 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        >
                          <Plus className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </div>
                      <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{item.priceLabel}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label={`Remove ${item.name} from cart`}
                    className="h-fit shrink-0 rounded-full p-1.5 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 ? (
          <div className="shrink-0 space-y-3 border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">{t("cart.subtotal")}</span>
              <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">{subtotalLabel}</span>
            </div>
            <p className="m-0 text-xs text-zinc-500 dark:text-zinc-400">{t("cart.shipping_notice")}</p>
            <div className="flex gap-2">
              <Link
                to="/cart"
                onClick={handleClose}
                className="flex-1 rounded-full border border-zinc-200 px-4 py-2.5 text-center text-sm font-semibold text-zinc-700 no-underline transition hover:border-brand-300 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-brand-500 dark:hover:text-brand-300"
              >
                {t("cart.view_cart")}
              </Link>
              <Link
                to="/checkout"
                onClick={handleClose}
                className="flex-1 rounded-full bg-brand-gradient px-4 py-2.5 text-center text-sm font-semibold text-white no-underline shadow-glow transition hover:-translate-y-0.5"
              >
                {t("cart.checkout")}
              </Link>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function EmptyCartState({
  featuredProduct,
  showPromotedProduct = true,
  onNavigate,
  onAddToCart,
}: {
  featuredProduct?: ProductCardData;
  showPromotedProduct?: boolean;
  onNavigate: () => void;
  onAddToCart: (item: { id: string; name: string; imageUrl?: string; priceLabel: string }, quantity?: number) => void;
}) {
  const t = useT();
  const [justAdded, setJustAdded] = useState(false);

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 py-6 text-center">
      <div className="grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
        <ShoppingBag className="h-7 w-7" aria-hidden="true" />
      </div>
      <div className="space-y-1.5">
        <p className="m-0 font-display text-lg font-bold text-zinc-900 dark:text-zinc-100">{t("cart.empty.heading")}</p>
        <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">{t("cart.empty.body")}</p>
      </div>

      {showPromotedProduct && featuredProduct ? (
        <div className="w-full rounded-2xl border border-zinc-100 bg-zinc-50/60 p-4 text-left dark:border-zinc-800/80 dark:bg-zinc-900/40">
          <p className="m-0 mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
            {t("cart.you_might_like")}
          </p>
          <Link
            to={`/shop/${featuredProduct.id}`}
            onClick={onNavigate}
            className="flex items-center gap-3 no-underline"
          >
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-800">
              {featuredProduct.imageUrl ? (
                <ResponsiveImage src={featuredProduct.imageUrl} alt="" sizes="4rem" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <p className="m-0 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{featuredProduct.name}</p>
              <p className="m-0 mt-0.5 text-sm font-bold text-brand-600 dark:text-brand-400">
                {featuredProduct.priceRangeLabel ?? featuredProduct.priceLabel}
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => {
              onAddToCart({
                id: featuredProduct.id,
                name: featuredProduct.name,
                imageUrl: featuredProduct.imageUrl,
                priceLabel: featuredProduct.priceRangeLabel ?? featuredProduct.priceLabel,
              });
              setJustAdded(true);
              window.setTimeout(() => setJustAdded(false), 2000);
            }}
            className="mt-3 w-full rounded-full bg-brand-gradient px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:-translate-y-0.5"
          >
            {justAdded ? t("cart.added") : t("cart.add")}
          </button>
        </div>
      ) : null}

      <Link
        to="/shop"
        onClick={onNavigate}
        className="rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white no-underline shadow-glow transition hover:-translate-y-0.5"
      >
        {t("cart.continue_shopping")}
      </Link>
    </div>
  );
}
