/** Hook for fetching and using special page backend content.
 * Provides headless content and shortcodes from the backend for special pages.
 */

import { useEffect, useState } from "react";
import { useLanguage } from "@funky/ui";
import { getSpecialPage, type CmsSpecialPage, type SpecialPageKey } from "./pages";

export type UseSpecialPageContentResult = {
  page: CmsSpecialPage | null;
  isLoading: boolean;
  error: Error | null;
};

/** Fetches special page content (backend-managed layout/shortcodes) for the given page key.
 * Returns the page data which includes headlessContent and headlessShortcodes for rendering.
 *
 * Usage:
 * ```tsx
 * const { page, isLoading } = useSpecialPageContent("cart");
 * // Render page.headlessShortcodes which contain [funkycommerce_*] tags
 * ```
 */
export function useSpecialPageContent(pageKey: SpecialPageKey): UseSpecialPageContentResult {
  const { languageCode, languageBackendCode } = useLanguage();
  const [page, setPage] = useState<CmsSpecialPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getSpecialPage(pageKey, languageCode, languageBackendCode);
        if (!cancelled) {
          setPage(result);
          if (!result) {
            setError(new Error(`Special page "${pageKey}" not found for language "${languageCode}"`));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void fetch();

    return () => {
      cancelled = true;
    };
  }, [pageKey, languageBackendCode, languageCode]);

  return { page, isLoading, error };
}
