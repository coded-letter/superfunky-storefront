import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { useLanguage } from "@funky/ui";
import { getBlogData, type CmsBlogData } from "../lib/blog";
import { useIncrementalData, type IncrementalDataState } from "../lib/incrementalData";

const BlogDataContext = createContext<IncrementalDataState<CmsBlogData> | null>(null);

export function BlogDataProvider({ children }: { children?: ReactNode }) {
  const { languageCode, languageBackendCode } = useLanguage();
  const rawState = useIncrementalData(
    `blog-data:v3:${languageCode}:${languageBackendCode}`,
    () => getBlogData(languageCode, languageBackendCode),
  );
  const state = useMemo<IncrementalDataState<CmsBlogData>>(() => ({
    ...rawState,
    data: rawState.data
      ? {
          ...rawState.data,
          posts: Array.isArray(rawState.data.posts) ? rawState.data.posts : [],
          categories: Array.isArray(rawState.data.categories) ? rawState.data.categories : [],
          tags: Array.isArray(rawState.data.tags) ? rawState.data.tags : [],
          authors: Array.isArray(rawState.data.authors) ? rawState.data.authors : [],
          comments: Array.isArray(rawState.data.comments) ? rawState.data.comments : [],
          hasMorePosts: rawState.data.hasMorePosts === true,
        }
      : null,
  }), [rawState]);

  return <BlogDataContext.Provider value={state}>{children ?? <Outlet />}</BlogDataContext.Provider>;
}

export function useBlogData(): IncrementalDataState<CmsBlogData> {
  const context = useContext(BlogDataContext);
  if (!context) throw new Error("useBlogData must be used within BlogDataProvider");
  return context;
}
