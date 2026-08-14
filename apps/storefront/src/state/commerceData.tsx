import { createContext, useContext, useMemo, type ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { useLanguage } from "@funky/ui";
import { getCommerceCatalog, type CmsCommerceCatalog } from "../lib/commerce";
import { useIncrementalData, type IncrementalDataState } from "@funky/sdk/react";

const CommerceDataContext = createContext<IncrementalDataState<CmsCommerceCatalog> | null>(null);

/**
 * Catalog cache identity follows the selected storefront language. The data response
 * explicitly reports when the current Polish-only live catalog is serving another
 * storefront language, so consumers never mistake it for translated content.
 */
export function CommerceDataProvider({ children, enabled = true }: { children?: ReactNode; enabled?: boolean }) {
  const { languageCode, languageBackendCode } = useLanguage();
  const normalizedLanguage = languageCode.toLowerCase();
  const rawState = useIncrementalData(
    `commerce-data:v4:${normalizedLanguage}:${languageBackendCode}`,
    () => getCommerceCatalog(normalizedLanguage, languageBackendCode),
    enabled,
  );
  const state = useMemo<IncrementalDataState<CmsCommerceCatalog>>(() => ({
    ...rawState,
    data: rawState.data
      ? {
          ...rawState.data,
          products: Array.isArray(rawState.data.products) ? rawState.data.products : [],
          categories: Array.isArray(rawState.data.categories) ? rawState.data.categories : [],
          tags: Array.isArray(rawState.data.tags) ? rawState.data.tags : [],
          brands: Array.isArray(rawState.data.brands) ? rawState.data.brands : [],
          reviews: Array.isArray(rawState.data.reviews) ? rawState.data.reviews : [],
          hasMoreProducts: rawState.data.hasMoreProducts === true,
        }
      : null,
  }), [rawState]);

  return (
    <CommerceDataContext.Provider value={state}>
      {children ?? <Outlet />}
    </CommerceDataContext.Provider>
  );
}

export function useCommerceData(): IncrementalDataState<CmsCommerceCatalog> {
  const context = useContext(CommerceDataContext);
  if (!context) throw new Error("useCommerceData must be used within CommerceDataProvider");
  return context;
}
