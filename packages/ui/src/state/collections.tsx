import { createPersistedIdCollection } from "./createPersistedIdCollection";

export const { Provider: WishlistProvider, useCollection: useWishlist } = createPersistedIdCollection(
  "funkycommerce-mockup-wishlist"
);

export const { Provider: ReadingListProvider, useCollection: useReadingList } = createPersistedIdCollection(
  "funkycommerce-mockup-reading-list"
);

/** Tags a user has selected as "interests" to filter the community feed by — persisted
 * the same way the wishlist/reading list are, so returning to `/community` remembers
 * which tags were checked last time instead of resetting to "all tags" on every visit. */
export const { Provider: TagInterestsProvider, useCollection: useTagInterests } = createPersistedIdCollection(
  "funkycommerce-mockup-tag-interests"
);

/** Post ids the reader has opted to mark as "read" from the reading list — lets the
 * editorial (newspaper-index) layout show an unread mark per row, purely opt-in and
 * toggleable by the reader, persisted the same way as the other id collections. */
export const { Provider: ReadArticlesProvider, useCollection: useReadArticles } = createPersistedIdCollection(
  "funkycommerce-mockup-read-articles"
);
