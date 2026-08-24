import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { ProductCard, savedListEntityId, useLayoutPreferences, useT, useWishlist } from "@funky/ui";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { useSavedListCap } from "../lib/savedLists";
import { useStorefrontPath } from "../lib/storefrontPaths";
import { useCommerceData } from "../state/commerceData";

export function WishlistMockupPage() {
  const t = useT();
  const { wishlistCardVariant: cardStyle } = useLayoutPreferences();
  const shopPath = useStorefrontPath("shop", "/shop");
  const { ids, clear, syncError } = useWishlist();
  const { data: commerce, isLoading, error } = useCommerceData();
  const { cap, error: capError, isLoggedIn } = useSavedListCap("wishlist");
  const items = (commerce?.products || []).filter((product) => ids.includes(savedListEntityId(product)));
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-200 pb-5 dark:border-zinc-800">
        <div className="grid gap-1">
          <h1 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">Wishlist</h1>
          <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400">
            {ids.length} saved {ids.length === 1 ? "product" : "products"}
            {cap ? ` of ${cap}` : ""} · {isLoggedIn ? "synced to your account" : "persisted locally in this browser"}.
          </p>
          {!isLoggedIn ? <p className="m-0 text-sm text-zinc-500 dark:text-zinc-400"><Link to="/login" className="font-semibold text-brand-600 dark:text-brand-300">Sign in</Link> to sync your wishlist across devices.</p> : null}
        </div>
      </div>
      {syncError ? <SavedCollectionStatus message={`Your wishlist could not be synced: ${syncError}`} /> : null}
      {capError ? <SavedCollectionStatus message={`Your wishlist limit could not be loaded: ${capError}`} /> : null}
      {ids.length > 0 && isLoading ? <ContentLoadingState compact label={t("wishlist.loading")} /> : null}
      {ids.length > 0 && error ? (
        <SavedCollectionStatus message={`Your saved products could not be loaded: ${error.message}`} />
      ) : null}
      {!isLoading && !error && ids.length > 0 && items.length === 0 ? (
        <SavedCollectionStatus
          message="These saved products are no longer available in the current catalog."
          actionLabel="Clear unavailable products"
          onAction={clear}
        />
      ) : null}
      {!isLoading && !error && ids.length === 0 ? (
        <div className="grid justify-items-center gap-4 rounded-3xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <span className="inline-grid h-14 w-14 place-items-center rounded-full bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500">
            <Heart className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="grid gap-1">
            <h2 className="m-0 font-display text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t("wishlist.empty")}</h2>
            <p className="m-0 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
              Tap the heart icon on any product card to save it here for later — it stays saved across visits.
            </p>
          </div>
          <Link
            to={shopPath}
            className="rounded-full bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white no-underline shadow-glow transition hover:-translate-y-0.5"
          >
            Browse the shop
          </Link>
        </div>
      ) : !isLoading && !error && items.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-5">
          {items.map((product) => (
            <ProductCard key={product.id} product={product} variant={cardStyle} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function SavedCollectionStatus({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="grid justify-items-center gap-3 rounded-3xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <p role="status" className="m-0 max-w-lg text-sm text-zinc-500 dark:text-zinc-400">{message}</p>
      {actionLabel && onAction ? (
        <button type="button" onClick={onAction} className="text-sm font-semibold text-brand-600 hover:text-brand-500 dark:text-brand-400">
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
