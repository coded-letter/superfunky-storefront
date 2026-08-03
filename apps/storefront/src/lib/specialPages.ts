/** Special pages resolver — fetches the URLs for all special pages in all languages
 * from the backend so language switching can navigate to the correct translated URL.
 * For example, when switching to Polish on /shop, navigate to /sklep/ instead.
 */

import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "@funky/ui";
import { graphqlRequest } from "./graphqlClient";
import type { SpecialPageKey } from "./pages";

const SPECIAL_PAGE_KEYS = new Set<SpecialPageKey>(["home", "shop", "blog", "cart", "checkout", "account"]);

function isSpecialPageKey(value: unknown): value is SpecialPageKey {
  return typeof value === "string" && SPECIAL_PAGE_KEYS.has(value as SpecialPageKey);
}

export type SpecialPageURLMap = {
  pageKey: SpecialPageKey;
  uri: string;
  languageCode: string;
}[];

const SPECIAL_PAGES_QUERY = /* GraphQL */ `
  query StorefrontSpecialPages {
    pages(where: { status: PUBLISH }, first: 100) {
      nodes {
        id
        uri
        language {
          code
        }
        translations {
          databaseId
          language {
            code
          }
          uri
        }
        funkycommerceSpecialPageKey
      }
    }
  }
`;

type SpecialPageResult = {
  pages: {
    nodes: {
      id: string;
      uri: string;
      language: { code: string | null } | null;
      translations: { databaseId: number; language: { code: string | null } | null; uri: string }[];
      funkycommerceSpecialPageKey?: string | null;
    }[];
  } | null;
};

let cachedPages: SpecialPageURLMap | null = null;
let inFlight: Promise<SpecialPageURLMap> | null = null;

function fetchSpecialPages(): Promise<SpecialPageURLMap> {
  if (cachedPages) return Promise.resolve(cachedPages);
  if (inFlight) return inFlight;

  inFlight = graphqlRequest<SpecialPageResult>(SPECIAL_PAGES_QUERY)
    .then(({ data }) => {
      const urlMap: SpecialPageURLMap = [];
      if (data?.pages?.nodes) {
        for (const page of data.pages.nodes) {
          if (isSpecialPageKey(page.funkycommerceSpecialPageKey)) {
            // Add the page itself
            urlMap.push({
              pageKey: page.funkycommerceSpecialPageKey,
              uri: page.uri,
              languageCode: page.language?.code?.toLowerCase() || "en",
            });
            // Add all its translations
            if (page.translations) {
              for (const translation of page.translations) {
                if (!translation.language?.code) continue;
                urlMap.push({
                  pageKey: page.funkycommerceSpecialPageKey,
                  uri: translation.uri,
                  languageCode: translation.language.code.toLowerCase(),
                });
              }
            }
          }
        }
      }
      cachedPages = urlMap;
      inFlight = null;
      return urlMap;
    })
    .catch((err) => {
      console.warn("[specialPages] Failed to fetch special pages:", err);
      inFlight = null;
      return [];
    });

  return inFlight;
}

/** Normalizes a URI for comparison (lowercase, trim trailing slashes). */
function normalizeUri(uri: string): string {
  return uri.toLowerCase().replace(/\/+$/, "");
}

/** Maps a URI to its corresponding special page key, if any. */
export async function resolveSpecialPageKey(uri: string): Promise<SpecialPageKey | null> {
  const pages = await fetchSpecialPages();
  const normalized = normalizeUri(uri);
  const page = pages.find((p) => normalizeUri(p.uri) === normalized);
  return page?.pageKey ?? null;
}

/** Hook that navigates to the translated URL of the current special page when language changes.
 * For example: on /shop switching to Polish navigates to /sklep/ (if available, else /shop).
 */
export function useSpecialPageLanguageNavigation(): void {
  const navigate = useNavigate();
  const location = useLocation();
  const { languageCode } = useLanguage();
  const previousLanguageRef = useRef(languageCode);
  const [currentPageKey, setCurrentPageKey] = useState<SpecialPageKey | null>(null);

  // Whenever the location changes, resolve the current special page key
  useEffect(() => {
    const currentUri = location.pathname;
    void resolveSpecialPageKey(currentUri).then((key) => {
      setCurrentPageKey(key);
    });
  }, [location.pathname]);

  // When language changes and we're on a special page, navigate to the translated URL
  useEffect(() => {
    if (languageCode === previousLanguageRef.current) return;

    previousLanguageRef.current = languageCode;

    // Only navigate if we're currently on a special page
    if (!currentPageKey) return;

    void fetchSpecialPages().then((pages) => {
      const normalizedLanguageCode = languageCode.toLowerCase();
      const translatedPage = pages.find(
        (p) => p.pageKey === currentPageKey && p.languageCode.toLowerCase() === normalizedLanguageCode
      );

      if (translatedPage) {
        // Navigate to the translated URL
        navigate(translatedPage.uri);
      } else {
        // Fallback: try to find the page in the default language (English)
        const fallbackPage = pages.find((p) => p.pageKey === currentPageKey && p.languageCode.toLowerCase() === "en");
        if (fallbackPage) {
          navigate(fallbackPage.uri);
        }
      }
    });
  }, [languageCode, currentPageKey, navigate]);
}
