import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { useLanguage, type PostCardData } from "@funky/ui";
import { getStickyPosts } from "../lib/stickyPosts";
import { useIncrementalData, type IncrementalDataState } from "@funky/sdk/react";

export type StickyPostsData = {
  posts: PostCardData[];
};

const StickyPostsDataContext = createContext<IncrementalDataState<StickyPostsData> | null>(null);

/** Provides the `[sticky-posts]` shortcode's dedicated published/sticky/language-scoped
 * post list — kept separate from `BlogDataProvider` so the shortcode's data contract
 * (see `lib/stickyPosts.ts`) is never diluted by the general blog listing's broader
 * query shape. Mirrors `BlogDataProvider`'s stale-while-revalidate caching. */
export function StickyPostsDataProvider({ children, enabled = true }: { children?: ReactNode; enabled?: boolean }) {
  const { languageCode, languageBackendCode } = useLanguage();
  const rawState = useIncrementalData(
    `sticky-posts-data:v1:${languageCode}:${languageBackendCode}`,
    async () => ({ posts: await getStickyPosts(languageBackendCode) }),
    enabled,
  );
  const state = useMemo<IncrementalDataState<StickyPostsData>>(() => ({
    ...rawState,
    data: rawState.data
      ? { posts: Array.isArray(rawState.data.posts) ? rawState.data.posts : [] }
      : null,
  }), [rawState]);

  return <StickyPostsDataContext.Provider value={state}>{children ?? <Outlet />}</StickyPostsDataContext.Provider>;
}

export function useStickyPostsData(): IncrementalDataState<StickyPostsData> {
  const context = useContext(StickyPostsDataContext);
  if (!context) throw new Error("useStickyPostsData must be used within StickyPostsDataProvider");
  return context;
}
