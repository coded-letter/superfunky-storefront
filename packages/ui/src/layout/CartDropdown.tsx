import { Link } from "react-router-dom";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "../state";
import { ResponsiveImage } from "../media";

export type CartDropdownProps = {
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Compact popover alternative to `CartDrawer` — anchored under the header's cart
 * icon instead of sliding in from the edge of the viewport. Same cart state/actions,
 * just a lighter-weight presentation for stores that don't want a full-screen
 * takeover on every add-to-cart. Rendered by `HeaderMockup` itself (inside a
 * `relative`-positioned wrapper around the cart button) so it's naturally anchored
 * without needing a portal or ref-measuring.
 */
export function CartDropdown({ isOpen, onClose }: CartDropdownProps) {
  const { items, itemCount, subtotalLabel, removeItem, updateQuantity } = useCart();

  if (!isOpen) return null;

  return (
    <>
      <div role="presentation" onClick={onClose} className="fixed inset-0 z-[70]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        onClick={(event) => event.stopPropagation()}
        className="sf-cart-dropdown funky-cart-dropdown absolute right-0 top-[calc(100%+0.75rem)] z-[80] w-[22rem] max-w-[90vw] origin-top-right rounded-2xl border border-zinc-200 bg-white p-4 shadow-soft-lg dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="m-0 flex items-center gap-1.5 font-display text-sm font-bold text-zinc-900 dark:text-zinc-100">
            <ShoppingBag className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            Your cart
            {itemCount > 0 ? (
              <span className="rounded-full bg-brand-50 px-1.5 py-0.5 text-[0.65rem] font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                {itemCount}
              </span>
            ) : null}
          </h2>
        </div>

        {items.length === 0 ? (
          <p className="m-0 py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">Your cart is empty.</p>
        ) : (
          <ul className="m-0 grid max-h-72 list-none gap-2.5 overflow-y-auto p-0">
            {items.map((item) => (
              <li key={item.id} className="flex gap-2.5 rounded-xl border border-zinc-100 bg-zinc-50/60 p-2.5 dark:border-zinc-800/80 dark:bg-zinc-900/40">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  {item.imageUrl ? <ResponsiveImage src={item.imageUrl} alt="" sizes="3.5rem" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  <p className="m-0 truncate text-xs font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-1 rounded-full border border-zinc-200 p-0.5 dark:border-zinc-700">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        aria-label={`Decrease quantity of ${item.name}`}
                        className="inline-grid h-5 w-5 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      >
                        <Minus className="h-2.5 w-2.5" aria-hidden="true" />
                      </button>
                      <span className="min-w-[1.25rem] text-center text-[0.65rem] font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        aria-label={`Increase quantity of ${item.name}`}
                        className="inline-grid h-5 w-5 place-items-center rounded-full text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      >
                        <Plus className="h-2.5 w-2.5" aria-hidden="true" />
                      </button>
                    </div>
                    <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{item.priceLabel}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  aria-label={`Remove ${item.name} from cart`}
                  className="h-fit shrink-0 rounded-full p-1 text-zinc-400 transition hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {items.length > 0 ? (
          <div className="mt-3 space-y-2.5 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500 dark:text-zinc-400">Subtotal</span>
              <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{subtotalLabel}</span>
            </div>
            <div className="flex gap-2">
              <Link
                to="/cart"
                onClick={onClose}
                className="flex-1 rounded-full border border-zinc-200 px-3 py-2 text-center text-xs font-semibold text-zinc-700 no-underline transition hover:border-brand-300 hover:text-brand-600 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-brand-500 dark:hover:text-brand-300"
              >
                View cart
              </Link>
              <Link
                to="/checkout"
                onClick={onClose}
                className="flex-1 rounded-full bg-brand-gradient px-3 py-2 text-center text-xs font-semibold text-white no-underline shadow-glow transition hover:-translate-y-0.5"
              >
                Checkout
              </Link>
            </div>
          </div>
        ) : (
          <Link
            to="/shop"
            onClick={onClose}
            className="mt-2 block rounded-full bg-brand-gradient px-3 py-2 text-center text-xs font-semibold text-white no-underline shadow-glow transition hover:-translate-y-0.5"
          >
            Continue shopping
          </Link>
        )}
      </div>
    </>
  );
}
