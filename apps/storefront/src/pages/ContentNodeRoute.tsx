import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useLanguage } from "@funky/ui";
import { getContentNodeInfo } from "../lib/contentNodes";
import { useIncrementalData } from "@funky/sdk/react";
import { getPageByUri } from "../lib/pages";
import {
  getStorefrontRouteRegistry,
  matchStorefrontRoute,
  ROUTE_REGISTRY_CACHE_KEY,
} from "../lib/storefrontPaths";
import { PageMockupPage } from "./PageMockupPage";
import { PostCategoryMockupPage } from "./PostCategoryMockupPage";
import { PostMockupPage } from "./PostMockupPage";
import { PostTagMockupPage } from "./PostTagMockupPage";
import { ProductCategoryMockupPage } from "./ProductCategoryMockupPage";
import { ProductMockupPage } from "./ProductMockupPage";
import { ProductTagMockupPage } from "./ProductTagMockupPage";
import { ProductBrandMockupPage } from "./ProductBrandMockupPage";
import { CommunityPostMockupPage } from "./CommunityPostMockupPage";
import { ContentLoadingState } from "../components/ContentLoadingState";
import { WordPressSpecialPageContent } from "../components/WordPressSpecialPageContent";
import { useCanonicalContentLanguage } from "../lib/useCanonicalContentLanguage";
import { resolveContentLanguageFallback } from "../lib/contentLanguageFallback";
import { resolveRouteLanguageSync } from "../lib/contentRouteLanguageSync";
import { STOREFRONT_BACKEND_PROFILE } from "@funky/sdk";
import { shouldPreferCoreContentQueries } from "../lib/profileGraphqlCompatibility";

export function ContentNodeRoute() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const {
    configuredLanguageCodes,
    languageCode,
    languageSelectionRevision,
    setLanguageCodeFromRoute,
  } = useLanguage();
  const handledSelectionRevision = useRef(0);
  const pendingSelectionPath = useRef<string | null>(null);
  const uri = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const useRouteRegistry = !shouldPreferCoreContentQueries(STOREFRONT_BACKEND_PROFILE);
  const { data: routeRegistry, isLoading: isLoadingRouteRegistry } = useIncrementalData(
    `${ROUTE_REGISTRY_CACHE_KEY}:${configuredLanguageCodes[0] || "default"}`,
    () => getStorefrontRouteRegistry(configuredLanguageCodes[0]),
    useRouteRegistry,
  );
  const {
    data: page,
    isLoading: isLoadingPage,
    isRevalidating: isRevalidatingPage,
    error: pageError,
  } = useIncrementalData(
    `content-page-by-uri:v1:${uri}`,
    () => getPageByUri(uri),
  );
  const matchedRoute = useRouteRegistry
    ? matchStorefrontRoute(routeRegistry || [], pathname)
    : null;
  useCanonicalContentLanguage(
    page?.languageCode,
    page?.translations || [],
    pathname,
    !isLoadingPage && !isRevalidatingPage,
    !isLoadingRouteRegistry && !matchedRoute,
    page?.uri,
  );
  const languageSelectionChanged = handledSelectionRevision.current !== languageSelectionRevision;
  const languageSelectionPending = languageSelectionChanged || pendingSelectionPath.current === pathname;
  const { data: nodeInfo, isLoading, error } = useIncrementalData(
    `content-node:v3:${uri}`,
    () => getContentNodeInfo(uri, undefined, undefined, { probePage: false }),
  );
  const shouldResolveLanguageFallback = !isLoadingRouteRegistry
    && !isLoadingPage
    && !isLoading
    && !pageError
    && !error
    && !matchedRoute
    && !page
    && !nodeInfo;
  const {
    data: languageFallbackPath,
    isLoading: isLoadingLanguageFallback,
    error: languageFallbackError,
  } = useIncrementalData(
    `content-language-fallback:v1:${uri}:${languageCode}:${configuredLanguageCodes.join(",")}:${shouldResolveLanguageFallback ? "resolve" : "skip"}`,
    () => shouldResolveLanguageFallback
      ? resolveContentLanguageFallback(pathname, languageCode, configuredLanguageCodes, {
          getPage: getPageByUri,
          getNodeInfo: (candidate) => getContentNodeInfo(candidate, undefined, undefined, { probePage: false }),
        })
      : Promise.resolve(null),
  );

  useEffect(() => {
    if (!matchedRoute) return;
    const decision = resolveRouteLanguageSync(
      pendingSelectionPath.current,
      pathname,
      languageSelectionChanged,
    );
    if (languageSelectionChanged) {
      handledSelectionRevision.current = languageSelectionRevision;
    }
    pendingSelectionPath.current = decision.pendingSelectionPath;
    if (!decision.shouldSynchronizeRouteLanguage) return;
    if (matchedRoute.languageCode !== languageCode) {
      setLanguageCodeFromRoute(matchedRoute.languageCode);
    }
  }, [
    languageCode,
    languageSelectionChanged,
    languageSelectionRevision,
    matchedRoute,
    pathname,
    setLanguageCodeFromRoute,
  ]);

  useEffect(() => {
    if (!shouldResolveLanguageFallback || !languageFallbackPath) return;
    navigate(languageFallbackPath, { replace: true });
  }, [languageFallbackPath, navigate, shouldResolveLanguageFallback]);

  // CMS route pages resolved from the ordinary Page registry take highest priority.
  if (matchedRoute) {
    if (!languageSelectionPending && matchedRoute.languageCode !== languageCode) {
      return <ContentLoadingState label="Selecting route language" />;
    }

    return <PageMockupPage routeKey={matchedRoute.key} synchronizeLanguage={false} />;
  }

  // Render whichever authoritative lookup resolves first. The remaining lookup
  // may still refine the route type without holding a known page or post off-screen.
  if (isLoadingRouteRegistry || (isLoading && !page) || (isLoadingPage && !nodeInfo)) {
    return <ContentLoadingState label="Resolving content" />;
  }
  const fatalPageError = nodeInfo ? null : pageError;
  if (error || fatalPageError || languageFallbackError) return <NotFoundContent />;
  if (shouldResolveLanguageFallback && (isLoadingLanguageFallback || languageFallbackPath)) {
    return <ContentLoadingState label="Finding available translation" />;
  }

  // nodeInfo.__typename is the authoritative type. Only fall back to the page
  // check when nodeInfo explicitly confirms this is a Page (or is absent but
  // page loaded — e.g. for very old backends that lack the typeQuery field).
  if (nodeInfo?.type === "CommunityPost") {
    return <CommunityPostMockupPage />;
  }
  if (nodeInfo?.type === "Post") {
    return <PostMockupPage />;
  }
  if (nodeInfo?.type === "Product") {
    return <ProductMockupPage />;
  }
  if (nodeInfo?.type === "ProductCategory") {
    return <ProductCategoryMockupPage />;
  }
  if (nodeInfo?.type === "ProductTag") {
    return <ProductTagMockupPage />;
  }
  if (nodeInfo?.type === "ProductBrand") {
    return <ProductBrandMockupPage />;
  }
  if (nodeInfo?.type === "Category") {
    return <PostCategoryMockupPage />;
  }
  if (nodeInfo?.type === "Tag") {
    return <PostTagMockupPage />;
  }
  if (nodeInfo?.type === "Page" || page) {
    return <PageMockupPage synchronizeLanguage={false} />;
  }
  return <NotFoundContent />;
}

function NotFoundContent() {
  const fallback = <RouteStatus title="Content not found" message="This page is unavailable." />;
  return <WordPressSpecialPageContent pageSlug="404" fallback={fallback} />;
}

function RouteStatus({ title, message }: { title: string; message: string }) {
  return (
    <section id="sf-404" className="sf-404 mx-auto mt-16 grid max-w-lg gap-4 rounded-3xl border border-zinc-200/80 bg-white p-10 text-center shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h1>
      <p className="m-0 text-zinc-500 dark:text-zinc-400">{message}</p>
      <Link to="/" className="mx-auto text-sm font-semibold text-brand-600 no-underline hover:text-brand-500 dark:text-brand-400">
        Back to home
      </Link>
    </section>
  );
}
