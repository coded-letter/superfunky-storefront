import { BrowserRouter, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import {
  AppStateProvider,
  ProductCardPreferencesProvider,
  StorefrontChromeMockup,
  languageHomePath,
  resolveLanguageUrlAction,
  useCart,
  useLanguage,
  useT,
  useToast,
} from "@funky/ui";
import { MOCK_PRODUCTS } from "./pages/shared";
import { useAiShoppingAssistantSurfaces } from "./components/AiShoppingAssistant";
import { GlobalFeedDiscovery } from "./components/GlobalFeedDiscovery";
import { BlogIndexFallback } from "./components/BlogIndexFallback";
import { SmartLinkNavigation } from "./components/SmartLinkNavigation";
import { useAuthHeartbeat, useAuthenticatedAccountId } from "./lib/auth";
import { useSyncCartToBackend } from "./lib/backendCart";
import { readingListRemote, wishlistRemote } from "./lib/savedLists";
import type { StorefrontRouteKey } from "./lib/storefrontPaths";
import { useResolvedStorefrontLanguageRoute, useResolvedStorefrontPath } from "./lib/storefrontPaths";
import { useLayoutPreferencesFromBackendConfig } from "./lib/layoutPreferencesSync";
import { CreatorContentProvider } from "./state/creatorContent";
import { BlogDataProvider } from "./state/blogData";
import { StickyPostsDataProvider } from "./state/stickyPostsData";
import { NavigationDataProvider, useNavigationData } from "./state/navigationData";
import { CommerceDataProvider } from "./state/commerceData";
import { CommunityDataProvider, useCommunityData } from "./state/communityData";
import { WordPressThemeStylesProvider } from "./state/wordpressThemeStyles";
import { searchStorefront } from "./lib/search";
import { submitNewsletterSubmission } from "./lib/submissions";
import { isBackendConfigured, STOREFRONT_BACKEND_PROFILE } from "@funky/sdk";
import { mountCmsScripts } from "./lib/pageScripts";
import { getExistingSubscription, getPushPreferences, subscribeToPush, unsubscribeFromPush } from "./lib/push";
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { StorefrontPreloader } from "./components/StorefrontPreloader";
import { DEFAULT_LOADER_CONFIGURATION } from "./lib/loaderConfig";
import { getHomePage } from "./lib/pages";
import { resolveBackendDataRequirements } from "./lib/backendDataRequirements";

const AuthorMockupPage = lazy(() => import("./pages/AuthorMockupPage").then((module) => ({ default: module.AuthorMockupPage })));
const AuthorDirectoryPage = lazy(() => import("./pages/AuthorDirectoryPage").then((module) => ({ default: module.AuthorDirectoryPage })));
const CommunityArticleMockupPage = lazy(() => import("./pages/CommunityArticleMockupPage").then((module) => ({ default: module.CommunityArticleMockupPage })));
const CommunityAuthorDirectoryPage = lazy(() => import("./pages/CommunityAuthorDirectoryPage").then((module) => ({ default: module.CommunityAuthorDirectoryPage })));
const CommunityPostMockupPage = lazy(() => import("./pages/CommunityPostMockupPage").then((module) => ({ default: module.CommunityPostMockupPage })));
const CommunityProfileMockupPage = lazy(() => import("./pages/CommunityProfileMockupPage").then((module) => ({ default: module.CommunityProfileMockupPage })));
const CommunityTagArchivePage = lazy(() => import("./pages/CommunityTagArchivePage").then((module) => ({ default: module.CommunityTagArchivePage })));
const CommunityTagDirectoryPage = lazy(() => import("./pages/CommunityTagDirectoryPage").then((module) => ({ default: module.CommunityTagDirectoryPage })));
const ContentNodeRoute = lazy(() => import("./pages/ContentNodeRoute").then((module) => ({ default: module.ContentNodeRoute })));
const NotFoundMockupPage = lazy(() => import("./pages/NotFoundMockupPage").then((module) => ({ default: module.NotFoundMockupPage })));
const OAuthCallbackPage = lazy(() => import("./pages/AuthMockupPage").then((module) => ({ default: module.OAuthCallbackPage })));
const OrderDetailMockupPage = lazy(() => import("./pages/OrderDetailMockupPage").then((module) => ({ default: module.OrderDetailMockupPage })));
const PageMockupPage = lazy(() => import("./pages/PageMockupPage").then((module) => ({ default: module.PageMockupPage })));
const PostCategoryMockupPage = lazy(() => import("./pages/PostCategoryMockupPage").then((module) => ({ default: module.PostCategoryMockupPage })));
const PostMockupPage = lazy(() => import("./pages/PostMockupPage").then((module) => ({ default: module.PostMockupPage })));
const PostTagMockupPage = lazy(() => import("./pages/PostTagMockupPage").then((module) => ({ default: module.PostTagMockupPage })));
const ProductCategoryMockupPage = lazy(() => import("./pages/ProductCategoryMockupPage").then((module) => ({ default: module.ProductCategoryMockupPage })));
const ProductMockupPage = lazy(() => import("./pages/ProductMockupPage").then((module) => ({ default: module.ProductMockupPage })));
const ProductTagMockupPage = lazy(() => import("./pages/ProductTagMockupPage").then((module) => ({ default: module.ProductTagMockupPage })));
const ProductBrandMockupPage = lazy(() => import("./pages/ProductBrandMockupPage").then((module) => ({ default: module.ProductBrandMockupPage })));
const ProductBrandDirectoryPage = lazy(() => import("./pages/ProductBrandDirectoryPage").then((module) => ({ default: module.ProductBrandDirectoryPage })));
const ResetPasswordMockupPage = lazy(() => import("./pages/AuthMockupPage").then((module) => ({ default: module.ResetPasswordMockupPage })));
const ShortcodeLibraryMockupPage = lazy(() => import("./pages/ShortcodeLibraryMockupPage").then((module) => ({ default: module.ShortcodeLibraryMockupPage })));
const LayoutStudioMockupPage = lazy(() => import("./pages/LayoutStudioMockupPage").then((module) => ({ default: module.LayoutStudioMockupPage })));
const SitemapPage = lazy(() => import("./pages/SitemapPage").then((module) => ({ default: module.SitemapPage })));

function ConnectedStorefrontChrome() {
  const { data } = useNavigationData();
  const { languageCode, languageBackendCode, configuredLanguageCodes } = useLanguage();
  const t = useT();
  const { showToast } = useToast();
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => {
    void getExistingSubscription().then((subscription) => {
      setPushSubscribed(Boolean(subscription));
      if (subscription) {
        void getPushPreferences().catch((error) => {
          showToast({
            title: "Could not sync push notifications",
            description: error instanceof Error ? error.message : undefined,
            tone: "error",
          });
        });
      }
    });
  }, [showToast]);
  const togglePush = useCallback(async () => {
    setPushBusy(true);
    try {
      if (pushSubscribed) {
        await unsubscribeFromPush();
        setPushSubscribed(false);
        showToast({ title: "Push notifications disabled.", tone: "success" });
      } else {
        await subscribeToPush();
        setPushSubscribed(true);
        showToast({ title: "Push notifications enabled.", tone: "success" });
      }
    } catch (error) {
      showToast({
        title: "Could not update push notifications",
        description: error instanceof Error ? error.message : undefined,
        tone: "error",
      });
    } finally {
      setPushBusy(false);
    }
  }, [pushSubscribed, showToast]);
  const search = useCallback(
    (query: string) => searchStorefront(query, languageBackendCode, languageCode, t),
    [languageBackendCode, languageCode, t],
  );
  const subscribeToNewsletter = useCallback(
    (email: string, source: "newsletter-popup" | "newsletter-footer" = "newsletter-popup") =>
      submitNewsletterSubmission(email, { source, language: languageCode, consent: true }),
    [languageCode],
  );
  useEffect(() => {
    const root = document.documentElement;
    const highlighting = data?.storefrontConfig.codeHighlighting;
    root.dataset.cmsCodeLightTheme = highlighting?.lightTheme || "one-light";
    root.dataset.cmsCodeDarkTheme = highlighting?.darkTheme || "one-dark";
  }, [data?.storefrontConfig.codeHighlighting]);
  // Keep the built-in storefront mock navigation as the fallback when a minimal
  // backend does not expose WordPress menu data. The UI package already defines a
  // sensible default nav, so we only pass backend menu arrays when they contain
  // actual content; otherwise the mock menu remains visible.
  const headerNavigation = Array.isArray(data?.header) && data.header.length ? data.header : undefined;
  const mobileNavigation = Array.isArray(data?.mobile) && data.mobile.length
    ? data.mobile
    : headerNavigation;
  const footerColumns = Array.isArray(data?.footer) && data.footer.length ? data.footer : undefined;
  const assistant = useAiShoppingAssistantSurfaces(data?.storefrontConfig);
  // Compute the language-aware home path so the logo link goes directly to the
  // correct home without triggering a redirect. "/" is kept for fallback languages
  // that don't have an explicit /:lang home route yet.
  const homePath = languageHomePath(languageCode, configuredLanguageCodes);
  return (
    <>
      <StorefrontChromeMockup
        featuredProduct={isBackendConfigured ? undefined : MOCK_PRODUCTS[0]}
        primaryNavigation={headerNavigation}
        mobileNavigation={mobileNavigation}
        footerColumns={footerColumns}
        search={search}
        onNewsletterSubscribe={isBackendConfigured ? subscribeToNewsletter : undefined}
        homePath={homePath}
        storefrontConfig={data?.storefrontConfig}
        onPushToggle={togglePush}
        pushSubscribed={pushSubscribed}
        pushBusy={pushBusy}
        assistantPlacement={assistant.placement}
        headerActionSlot={assistant.headerActionSlot}
        footerAssistantSlot={assistant.footerAssistantSlot}
        assistantOverlaySlot={assistant.assistantOverlaySlot}
        floatingAssistantSlot={assistant.floatingAssistantSlot}
      />
    </>
  );
}

function ConnectedProductCardPreferences({ children }: { children: ReactNode }) {
  const { data } = useNavigationData();
  return (
    <ProductCardPreferencesProvider quickViewEnabled={data?.storefrontConfig.features.quickView ?? true}>
      {children}
    </ProductCardPreferencesProvider>
  );
}

function StorefrontReadySignal() {
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;
    let readinessTimer = 0;
    const announceWhenCoherent = () => {
      if (readinessTimer || root.dataset.storefrontReady === "true") return;
      readinessTimer = window.setTimeout(() => {
        readinessTimer = 0;
        const criticalContent = root.querySelector(
          "[data-cms-page], [data-rendered-cms-shortcode], main article, main h1",
        );
        if (!criticalContent) return;
        root.dataset.storefrontReady = "true";
        window.dispatchEvent(new Event("funky:storefront-ready"));
        observer.disconnect();
      }, 0);
    };
    const observer = new MutationObserver(announceWhenCoherent);
    observer.observe(root, { childList: true, subtree: true });
    announceWhenCoherent();
    return () => {
      observer.disconnect();
      window.clearTimeout(readinessTimer);
    };
  }, []);
  return null;
}

function CmsScriptRuntime() {
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root) return;

    return mountCmsScripts(root);
  }, []);

  return null;
}

function CartSyncManager() {
  const { items, removeItem } = useCart();
  const { showToast } = useToast();
  useEffect(() => {
    if (!isBackendConfigured) return;
    const legacyDemoIds = new Set(MOCK_PRODUCTS.map(({ id }) => id));
    const unavailableDemoItems = items.filter(
      (item) => !item.backendProductId && legacyDemoIds.has(item.id),
    );
    if (!unavailableDemoItems.length) return;

    unavailableDemoItems.forEach(({ id }) => removeItem(id));
    showToast({
      title: "Unavailable demo item removed",
      description:
        unavailableDemoItems.length === 1
          ? `${unavailableDemoItems[0].name} is not a live WooCommerce product.`
          : `${unavailableDemoItems.length} demo items are not live WooCommerce products.`,
    });
  }, [items, removeItem, showToast]);
  useSyncCartToBackend();
  return null;
}

function RouteDataProviders({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const { pathname } = useLocation();
  const isGeneratedHome = pathname === "/" || /^\/[a-z]{2}\/?$/.test(pathname);
  const generatedPayload = isGeneratedHome
    ? document.getElementById("storefront-route-payload")?.textContent || ""
    : "";
  const routeRequirements = resolveBackendDataRequirements(
    STOREFRONT_BACKEND_PROFILE,
    pathname,
    generatedPayload,
  );
  const [detectedRequirements, setDetectedRequirements] = useState({
    pathname,
    requirements: routeRequirements,
  });
  const requirements = detectedRequirements.pathname === pathname
    ? detectedRequirements.requirements
    : routeRequirements;

  useEffect(() => {
    const root = document.getElementById("root");
    const updateRequirements = () => {
      const nextRequirements = resolveBackendDataRequirements(
        STOREFRONT_BACKEND_PROFILE,
        pathname,
        generatedPayload || (enabled ? root?.innerHTML || "" : ""),
      );
      setDetectedRequirements((current) => {
        const unchanged = current.pathname === pathname
          && current.requirements.commerce === nextRequirements.commerce
          && current.requirements.blog === nextRequirements.blog
          && current.requirements.stickyPosts === nextRequirements.stickyPosts
          && current.requirements.community === nextRequirements.community;
        return unchanged ? current : { pathname, requirements: nextRequirements };
      });
    };

    updateRequirements();
    if (!enabled || !root || generatedPayload) return;

    const observer = new MutationObserver(updateRequirements);
    observer.observe(root, { attributes: true, childList: true, subtree: true });
    return () => observer.disconnect();
  }, [enabled, generatedPayload, pathname]);

  if (isGeneratedHome && generatedPayload && !Object.values(requirements).some(Boolean)) {
    return children;
  }

  return (
    <CommerceDataProvider enabled={enabled && requirements.commerce}>
      <CommunityDataProvider enabled={enabled && requirements.community}>
        <CreatorContentProvider>
          <BlogDataProvider enabled={enabled && requirements.blog}>
            <StickyPostsDataProvider enabled={enabled && requirements.stickyPosts}>
              {children}
            </StickyPostsDataProvider>
          </BlogDataProvider>
        </CreatorContentProvider>
      </CommunityDataProvider>
    </CommerceDataProvider>
  );
}

function useRouteCriticalContentReady(): boolean {
  const [ready, setReady] = useState(
    () => document.getElementById("root")?.dataset.storefrontReady === "true",
  );
  useEffect(() => {
    const markReady = () => setReady(true);
    window.addEventListener("funky:storefront-ready", markReady);
    if (document.getElementById("root")?.dataset.storefrontReady === "true") markReady();
    return () => window.removeEventListener("funky:storefront-ready", markReady);
  }, []);
  return ready;
}

function normalizeBrowserPath(path: string): string {
  if (path === "/") return "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

function StorefrontPageRoute({
  routeKey,
  fallback,
}: {
  routeKey: Extract<StorefrontRouteKey, "shop" | "blog" | "cart" | "checkout" | "account">;
  fallback: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { language: routeLanguage } = useParams();
  const { configuredLanguageCodes, languageCode } = useLanguage();
  const targetLanguageCode = routeLanguage && configuredLanguageCodes.includes(routeLanguage.toLowerCase())
    ? routeLanguage
    : languageCode;
  const { path, isLoading } = useResolvedStorefrontPath(routeKey, fallback, targetLanguageCode);
  const currentPath = normalizeBrowserPath(location.pathname);
  const resolvedPath = normalizeBrowserPath(path);

  useEffect(() => {
    if (isLoading || resolvedPath === currentPath) return;
    navigate(`${path}${location.search}${location.hash}`, { replace: true });
  }, [currentPath, isLoading, location.hash, location.search, navigate, path, resolvedPath]);

  if (routeKey === "blog" && STOREFRONT_BACKEND_PROFILE === "shop") {
    return <BlogIndexFallback />;
  }

  return <PageMockupPage routeKey={routeKey} />;
}

function StorefrontRedirectRoute({
  routeKey,
  fallback,
}: {
  routeKey: StorefrontRouteKey;
  fallback: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { language: routeLanguage } = useParams();
  const { configuredLanguageCodes, languageCode } = useLanguage();
  const targetLanguageCode = routeLanguage && configuredLanguageCodes.includes(routeLanguage.toLowerCase())
    ? routeLanguage
    : languageCode;
  const { path, isLoading } = useResolvedStorefrontPath(routeKey, fallback, targetLanguageCode);
  const currentPath = normalizeBrowserPath(location.pathname);
  const resolvedPath = normalizeBrowserPath(path);

  useEffect(() => {
    if (isLoading || resolvedPath === currentPath) return;
    if (currentPath === normalizeBrowserPath(fallback)) {
      navigate(`${path}${location.search}${location.hash}`, { replace: true });
    }
  }, [currentPath, fallback, isLoading, location.hash, location.search, navigate, path, resolvedPath]);

  return <PageMockupPage routeKey={routeKey} />;
}

function HomePageRoute() {
  const { language: routeLanguage } = useParams();
  const { configuredLanguageCodes, languageCode } = useLanguage();
  const explicitLanguage = routeLanguage?.toLowerCase();
  const isSupportedLanguage = explicitLanguage
    ? configuredLanguageCodes.includes(explicitLanguage)
    : true;
  const targetLanguageCode = explicitLanguage || languageCode;
  const configuredLanguageKey = configuredLanguageCodes.join(",");
  const loadPage = useCallback(
    () => getHomePage(targetLanguageCode, configuredLanguageCodes),
    [configuredLanguageCodes, targetLanguageCode],
  );

  if (!isSupportedLanguage) {
    return STOREFRONT_BACKEND_PROFILE === "blog"
      ? <PostMockupPage fallback={<ContentNodeRoute />} />
      : <ContentNodeRoute />;
  }
  return (
    <PageMockupPage
      routeKey="home"
      loadPage={loadPage}
      pageCacheKey={`home-page:v1:${targetLanguageCode}:${configuredLanguageKey}`}
    />
  );
}

/** Hydrates/reconciles the shared `LayoutPreferencesContext` from the canonical
 *  backend storefront `layout` configuration whenever navigation data loads or
 *  changes. Mounted inside `NavigationDataProvider` (which itself is nested inside
 *  `AppStateProvider`'s `LayoutPreferencesProvider`) so both contexts are available. */
function LayoutPreferencesBackendSync() {
  const { data } = useNavigationData();
  useLayoutPreferencesFromBackendConfig(data?.storefrontConfig.layout);
  return null;
}

/** Gates a route to authenticated WordPress administrators. Checks the
 *  server-backed `viewer.capabilities` (from `useCommunityData()`, sourced via
 *  an authenticated GraphQL query) for the `manage_options` capability — never
 *  local storage or client-only state — so non-admins (including anonymous
 *  visitors) always resolve to the normal not-found surface, both for direct
 *  navigation and for nav-link visibility (see `AccountMockupPage`'s
 *  `canManageLayouts`). */
function AdminCapabilityRoute({ children }: { children: ReactNode }) {
  const { viewer, isViewerLoading } = useCommunityData();

  if (isViewerLoading) {
    return <main aria-busy="true" className="mx-auto min-h-[45vh] w-full max-w-7xl px-4 py-16" />;
  }

  if (!viewer?.capabilities.includes("manage_options")) {
    return <NotFoundMockupPage />;
  }

  return children;
}

function LanguageUrlNormalizer() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    configuredLanguageCodes,
    hasBackendLanguageOptions,
    hasLanguagePreference,
    languageCode,
    languageSelectionRevision,
    setLanguageCodeFromRoute,
  } = useLanguage();
  const currentUrl = `${location.pathname}${location.search}${location.hash}`;
  const { resolution: storefrontLanguageRoute } = useResolvedStorefrontLanguageRoute(location.pathname);
  const storefrontLanguageTarget = storefrontLanguageRoute?.targetPath;
  const handledSelectionRevision = useRef(languageSelectionRevision);
  const pendingSelectionUrl = useRef<string | null>(null);

  useLayoutEffect(() => {
    if (!hasBackendLanguageOptions) return;
    const languageSelectionChanged = handledSelectionRevision.current !== languageSelectionRevision;
    handledSelectionRevision.current = languageSelectionRevision;
    if (languageSelectionChanged) {
      pendingSelectionUrl.current = currentUrl;
    } else if (pendingSelectionUrl.current && pendingSelectionUrl.current !== currentUrl) {
      pendingSelectionUrl.current = null;
    }
    const languageSelectionPending = pendingSelectionUrl.current === currentUrl;
    if (languageSelectionPending && storefrontLanguageTarget) {
      const targetUrl = `${storefrontLanguageTarget}${location.search}${location.hash}`;
      if (targetUrl === currentUrl) {
        pendingSelectionUrl.current = null;
      } else {
        navigate(targetUrl, { replace: true });
      }
      return;
    }

    const canNormalizeSelection = canNormalizeLanguageSelection(
      location.pathname,
      configuredLanguageCodes,
    );
    if (
      !canNormalizeSelection
      && (languageSelectionPending || hasLanguagePreference)
    ) {
      return;
    }

    const action = resolveLanguageUrlAction(
      currentUrl,
      languageCode,
      configuredLanguageCodes,
      languageSelectionPending,
    );
    if (action?.type === "set-language") {
      setLanguageCodeFromRoute(action.languageCode);
      return;
    }
    if (action?.type !== "navigate") return;
    if (!languageSelectionPending) {
      navigate(action.to, { replace: true });
      return;
    }

    const timeout = window.setTimeout(() => navigate(action.to, { replace: true }), 100);
    return () => window.clearTimeout(timeout);
  }, [
    configuredLanguageCodes,
    currentUrl,
    hasBackendLanguageOptions,
    hasLanguagePreference,
    languageCode,
    languageSelectionRevision,
    location.hash,
    location.pathname,
    location.search,
    navigate,
    setLanguageCodeFromRoute,
    storefrontLanguageTarget,
  ]);
  return null;
}

function canNormalizeLanguageSelection(
  pathname: string,
  configuredLanguageCodes: readonly string[],
): boolean {
  const segments = pathname.split("/").filter(Boolean);
  const configured = new Set(configuredLanguageCodes.map((code) => code.toLowerCase()));
  const routeSegments = configured.has(segments[0]?.toLowerCase())
    ? segments.slice(1)
    : segments;
  if (!routeSegments.length) return true;
  if (routeSegments.length === 1 && ["shortcodes", "layout-studio"].includes(routeSegments[0].toLowerCase())) {
    return true;
  }

  const route = routeSegments.join("/").toLowerCase();
  return route === "sitemap"
    || route === "auth/reset-password"
    || route.startsWith("oauth/login/")
    || route.startsWith("order/")
    || route === "product-brand"
    || route === "author"
    || route === "community"
    || route.startsWith("community/")
    || route === "community-author"
    || route === "community-tag"
    || route.startsWith("community-tag/");
}

export function App() {
  useAuthHeartbeat();
  const accountId = useAuthenticatedAccountId();
  const backendDataReady = useRouteCriticalContentReady();

  return (
    <HelmetProvider>
      <GlobalFeedDiscovery />
      <StorefrontReadySignal />
      <CmsScriptRuntime />
      <BrowserRouter>
        <AppStateProvider
          accountId={accountId}
          wishlistRemote={wishlistRemote}
          readingListRemote={readingListRemote}
        >
          <SmartLinkNavigation />
          <CartSyncManager />
          <WordPressThemeStylesProvider enabled={backendDataReady}>
            <NavigationDataProvider enabled={backendDataReady}>
              <LanguageUrlNormalizer />
              <LayoutPreferencesBackendSync />
              <ConnectedProductCardPreferences>
                <RouteDataProviders enabled={backendDataReady}>
                  <Suspense fallback={<StorefrontPreloader loader={DEFAULT_LOADER_CONFIGURATION} className="min-h-[45vh]" />}>
                    <Routes>
                  <Route element={<ConnectedStorefrontChrome />}>
                    <Route path="/" element={<HomePageRoute />} />
                    <Route path="/:language" element={<HomePageRoute />} />
                    <Route path="/shop" element={<StorefrontPageRoute routeKey="shop" fallback="/shop" />} />
                    <Route path="/:language/shop" element={<StorefrontPageRoute routeKey="shop" fallback="/shop" />} />
                    <Route path="/shop/category/:slug" element={<ProductCategoryMockupPage />} />
                    <Route path="/shop/tag/:slug" element={<ProductTagMockupPage />} />
                    <Route path="/shop/brand/:slug" element={<ProductBrandMockupPage />} />
                    <Route path="/product-brand" element={<ProductBrandDirectoryPage />} />
                    <Route path="/:language/product-brand" element={<ProductBrandDirectoryPage />} />
                    <Route path="/shop/:slug" element={<ProductMockupPage />} />
                    <Route path="/product/*" element={<ProductMockupPage />} />
                    <Route path="/product-category/*" element={<ProductCategoryMockupPage />} />
                    <Route path="/product-tag/*" element={<ProductTagMockupPage />} />
                    <Route path="/brand/*" element={<ProductBrandMockupPage />} />
                    <Route path="/blog" element={<StorefrontPageRoute routeKey="blog" fallback="/blog" />} />
                    <Route path="/:language/blog" element={<StorefrontPageRoute routeKey="blog" fallback="/blog" />} />
                    <Route path="/blog/category/:slug" element={<PostCategoryMockupPage />} />
                    <Route path="/blog/tag/:slug" element={<PostTagMockupPage />} />
                    <Route path="/category/:slug" element={<PostCategoryMockupPage />} />
                    <Route path="/tag/:slug" element={<PostTagMockupPage />} />
                    <Route path="/:language/category/:slug" element={<PostCategoryMockupPage />} />
                    <Route path="/:language/tag/:slug" element={<PostTagMockupPage />} />
                    <Route path="/blog/author/:slug" element={<AuthorMockupPage />} />
                    <Route path="/author" element={<AuthorDirectoryPage />} />
                    <Route path="/:language/author" element={<AuthorDirectoryPage />} />
                    <Route path="/author/:slug" element={<AuthorMockupPage />} />
                    <Route path="/:language/author/:slug" element={<AuthorMockupPage />} />
                    <Route path="/blog/:slug" element={<PostMockupPage />} />
                    <Route path="/:year/:month/:day/:slug" element={<PostMockupPage />} />
                    <Route path="/:language/:year/:month/:day/:slug" element={<PostMockupPage />} />
                    <Route path="/sitemap" element={<SitemapPage />} />
                    <Route path="/cart" element={<StorefrontPageRoute routeKey="cart" fallback="/cart" />} />
                    <Route path="/:language/cart" element={<StorefrontPageRoute routeKey="cart" fallback="/cart" />} />
                    <Route path="/checkout" element={<StorefrontPageRoute routeKey="checkout" fallback="/checkout" />} />
                    <Route path="/:language/checkout" element={<StorefrontPageRoute routeKey="checkout" fallback="/checkout" />} />
                    <Route path="/community/post/:postId" element={<CommunityPostMockupPage />} />
                    <Route path="/:language/community/post/:postId" element={<CommunityPostMockupPage />} />
                    <Route path="/community_post/:slug" element={<CommunityPostMockupPage />} />
                    <Route path="/:language/community_post/:slug" element={<CommunityPostMockupPage />} />
                    <Route path="/community/:handle/articles/:slug" element={<CommunityArticleMockupPage />} />
                    <Route path="/:language/community/:handle/articles/:slug" element={<CommunityArticleMockupPage />} />
                    <Route path="/community/:handle" element={<CommunityProfileMockupPage />} />
                    <Route path="/:language/community/:handle" element={<CommunityProfileMockupPage />} />
                    <Route path="/community-author" element={<CommunityAuthorDirectoryPage />} />
                    <Route path="/:language/community-author" element={<CommunityAuthorDirectoryPage />} />
                    <Route path="/community-tag" element={<CommunityTagDirectoryPage />} />
                    <Route path="/:language/community-tag" element={<CommunityTagDirectoryPage />} />
                    <Route path="/community-tag/:slug" element={<CommunityTagArchivePage />} />
                    <Route path="/:language/community-tag/:slug" element={<CommunityTagArchivePage />} />
                    <Route path="/account" element={<StorefrontPageRoute routeKey="account" fallback="/account" />} />
                    <Route path="/:language/account" element={<StorefrontPageRoute routeKey="account" fallback="/account" />} />
                    <Route path="/wishlist" element={<StorefrontRedirectRoute routeKey="wishlist" fallback="/wishlist" />} />
                    <Route path="/reading-list" element={<StorefrontRedirectRoute routeKey="reading-list" fallback="/reading-list" />} />
                    <Route path="/community" element={<StorefrontRedirectRoute routeKey="community" fallback="/community" />} />
                    <Route path="/:language/community" element={<StorefrontRedirectRoute routeKey="community" fallback="/community" />} />
                    <Route path="/auth" element={<StorefrontRedirectRoute routeKey="auth-login" fallback="/auth" />} />
                    <Route
                      path="/order-success"
                      element={<StorefrontRedirectRoute routeKey="order-success" fallback="/order-success" />}
                    />
                    <Route
                      path="/:language/order-success"
                      element={<StorefrontRedirectRoute routeKey="order-success" fallback="/order-success" />}
                    />
                    <Route
                      path="/order-success/digital"
                      element={<StorefrontRedirectRoute routeKey="order-success-digital" fallback="/order-success/digital" />}
                    />
                    <Route
                      path="/:language/order-success/digital"
                      element={<StorefrontRedirectRoute routeKey="order-success-digital" fallback="/order-success/digital" />}
                    />
                    <Route path="/order/:id" element={<OrderDetailMockupPage />} />
                    <Route path="/:language/order/:id" element={<OrderDetailMockupPage />} />
                    <Route path="/unsubscribe" element={<StorefrontRedirectRoute routeKey="unsubscribe" fallback="/unsubscribe" />} />
                    <Route path="/auth/reset-password" element={<ResetPasswordMockupPage />} />
                    <Route path="/oauth/login/:provider" element={<OAuthCallbackPage />} />
                    <Route path="/shortcodes" element={<ShortcodeLibraryMockupPage />} />
                    <Route path="/layout-studio" element={<AdminCapabilityRoute><LayoutStudioMockupPage /></AdminCapabilityRoute>} />
                    <Route path="*" element={<ContentNodeRoute />} />
                  </Route>
                    </Routes>
                  </Suspense>
                </RouteDataProviders>
              </ConnectedProductCardPreferences>
            </NavigationDataProvider>
          </WordPressThemeStylesProvider>
        </AppStateProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}
