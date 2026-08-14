import type { PostCardData } from "@funky/ui";
import { graphqlRequest, STOREFRONT_BACKEND_PROFILE } from "@funky/sdk";
import { BLOG_DATA_COMPATIBILITY_RULES } from "./blogGraphqlCompatibility";
import { requestGraphqlWithCompatibility } from "./graphqlFieldFallback";
import { BLOG_POST_CARD_FIELDS, mapBlogPost, type RawBlogPost } from "./postArchives";
import {
  createCoreBlogQuery,
  shouldPreferCoreGraphqlQueries,
} from "./profileGraphqlCompatibility";

type StickyPostsResult = {
  posts: {
    nodes: RawBlogPost[];
  } | null;
};

/**
 * Explicit, dedicated query for the `[sticky-posts]` shortcode — deliberately separate
 * from `getBlogData`'s general listing (used by the `grid`/`slider`/`carousel`
 * shortcodes) so the contract this shortcode promises is enforced at the query level
 * rather than derived by client-side filtering of an unrelated listing:
 *  - `status: PUBLISH` — drafts, pending, and scheduled posts never leak into a public
 *    widget just because an editor marked them sticky ahead of publishing.
 *  - `isSticky: true` — WPGraphQL's native sticky-post flag (`is_sticky()`), matching
 *    the same posts WordPress's own "Sticky posts" admin filter would show.
 *  - `language: $language` — scoped to the storefront's active Polylang/WPML language,
 *    consistent with every other content shortcode.
 *  - `orderby` — deterministic: newest publish date first, alphabetical title as a
 *    tie-break. `sortStickyPosts` below re-applies the same two keys (plus a final
 *    numeric ID tie-break) client-side, so ordering stays stable even against a backend
 *    that ignores multi-key `orderby` or coalesces same-second publish dates.
 */
const STICKY_POSTS_QUERY = /* GraphQL */ `
  query StorefrontStickyPosts($language: LanguageCodeFilterEnum!) {
    posts(
      first: 100
      where: {
        status: PUBLISH
        isSticky: true
        language: $language
        orderby: [{ field: DATE, order: DESC }, { field: TITLE, order: ASC }]
      }
    ) {
      ${BLOG_POST_CARD_FIELDS}
    }
  }
`;

export async function getStickyPosts(backendLanguageCode: string): Promise<PostCardData[]> {
  const query = shouldPreferCoreGraphqlQueries(STOREFRONT_BACKEND_PROFILE)
    ? createCoreBlogQuery(STICKY_POSTS_QUERY)
    : STICKY_POSTS_QUERY;
  const { data, errors } = await requestGraphqlWithCompatibility<StickyPostsResult>(
    graphqlRequest,
    query,
    { language: backendLanguageCode },
    BLOG_DATA_COMPATIBILITY_RULES,
  );

  if (errors?.length) {
    throw new Error(errors.map(({ message }) => message).join("; "));
  }
  if (!data) {
    throw new Error("The sticky posts query returned no data");
  }

  const posts = data.posts?.nodes.map(mapBlogPost) || [];
  return sortStickyPosts(posts);
}

/**
 * Deterministic ordering for sticky posts: newest publish date first, then
 * alphabetical title, then a stable numeric database ID — so the same set of sticky
 * posts always renders in the same order across requests, prerenders, and layouts
 * (grid, carousel, compact-list), even when two posts share an identical date/title.
 */
export function sortStickyPosts(posts: readonly PostCardData[]): PostCardData[] {
  return [...posts].sort((left, right) => {
    const dateDiff = Date.parse(right.date) - Date.parse(left.date);
    if (dateDiff !== 0) return dateDiff;
    const titleDiff = left.title.localeCompare(right.title);
    if (titleDiff !== 0) return titleDiff;
    return (left.databaseId || 0) - (right.databaseId || 0);
  });
}
