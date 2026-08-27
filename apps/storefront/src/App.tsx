import { BrowserRouter, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import {
  AppStateProvider,
  ProductCardPreferencesProvider,
  StorefrontChromeMockup,
  UploadPostModal,
  Seo,
  languageHomePath,
  resolveLanguageUrlAction,
  useCart,
  useCurrency,
  useLanguage,
  useLayoutPreferences,
  useT,
  useToast,
} from "@funky/ui";
import { Plus } from "lucide-react";
import { MOCK_PRODUCTS } from "./pages/shared";
import { useAiShoppingAssistantSurfaces } from "./components/AiShoppingAssistant";
import { GlobalFeedDiscovery } from "./components/GlobalFeedDiscovery";
import { BlogIndexFallback } from "./components/BlogIndexFallback";
import { SmartLinkNavigation } from "./components/SmartLinkNavigation";
import { useAuthHeartbeat, useAuthenticatedAccountId } from "./lib/auth";
import { useSyncCartToBackend } from "./lib/backendCart";
import { readingListRemote, wishlistRemote } from "./lib/savedLists";
import type { StorefrontRouteKey } from "./lib/storefrontPaths";
import { matchesStorefrontFallbackPath } from "./lib/routePathMatching";
import { useResolvedStorefrontLanguageRoute, useResolvedStorefrontPath } from "./lib/storefrontPaths";
import { applyLayoutConfiguration, useLayoutPreferencesFromBackendConfig } from "./lib/layoutPreferencesSync";
import { CreatorContentProvider } from "./state/creatorContent";
import { BlogDataProvider } from "./state/blogData";
import { StickyPostsDataProvider } from "./state/stickyPostsData";
import { NavigationDataProvider, useNavigationData } from "./state/navigationData";
import { CommerceDataProvider } from "./state/commerceData";
import { CommunityDataProvider, useCommunityData } from "./state/communityData";
import {
  useWordPressThemeStylesReady,
  WordPressThemeStylesProvider,
} from "./state/wordpressThemeStyles";
import { searchStorefront } from "./lib/search";
import { submitNewsletterSubmission } from "./lib/submissions";
import { isBackendConfigured, STOREFRONT_BACKEND_PROFILE } from "@funky/sdk";
import { useIncrementalData } from "@funky/sdk/react";
import { getFeaturedProducts } from "./lib/commerce";
import { formatProductCardCurrency } from "./lib/productCardCurrency";
import { mountCmsScripts } from "./lib/pageScripts";
import { getExistingSubscription, getPushPreferences, subscribeToPush, unsubscribeFromPush } from "./lib/push";
import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { StorefrontPreloader } from "./components/StorefrontPreloader";
import { DEFAULT_LOADER_CONFIGURATION, resolveThemeAwareLoaderConfiguration } from "./lib/loaderConfig";
import { hasPendingVisibleContent } from "./lib/storefrontReadiness";
import { getHomePage } from "./lib/pages";
import {
  canUseHomepageBlogSummary,
  canUseHomepageCommunityFeed,
  resolveBackendDataRequirements,
} from "./lib/backendDataRequirements";
import { createCommunityPost, searchTranslationCandidateCommunityPosts } from "./lib/community";

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
const OrderSuccessDigitalMockupPage = lazy(() => import("./pages/OrderSuccessDigitalMockupPage").then((module) => ({ default: module.OrderSuccessDigitalMockupPage })));
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
  const { data, isLoading: navigationLoading, error: navigationError } = useNavigationData();
  const location = useLocation();
  const { languageCode, languageBackendCode, configuredLanguageCodes } = useLanguage();
  const { formatBaseAmount } = useCurrency();
  const { path: checkoutPath } = useResolvedStorefrontPath("checkout", "/checkout", languageCode);
  const t = useT();
  const { showToast } = useToast();
  const { viewer, refresh: refreshCommunity } = useCommunityData();
  const {
    showCartDrawerPromotedProduct,
    showAllCartPromotedProducts,
    showHeaderPublishButton,
  } = useLayoutPreferences();
  const { data: featuredProducts } = useIncrementalData(
    `cart-featured-products:v2:${languageCode}:${showAllCartPromotedProducts ? "all" : "single"}`,
    () => getFeaturedProducts(languageBackendCode, showAllCartPromotedProducts),
    isBackendConfigured && showCartDrawerPromotedProduct,
  );
  const [isCommunityPublishOpen, setIsCommunityPublishOpen] = useState(false);
  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const navigationSettled = !navigationLoading && Boolean(data || navigationError || !isBackendConfigured);
  const pushEnabled = !isBackendConfigured || data?.storefrontConfig.features.push === true;
  useLayoutEffect(() => {
    if (!navigationSettled) return;
    const root = getStorefrontApplicationRoot();
    if (!root || root.dataset.storefrontShellReady === "true") return;
    root.dataset.storefrontShellReady = "true";
    performance.mark("storefront:shell-ready");
    window.dispatchEvent(new Event("funky:storefront-shell-ready"));
  }, [navigationSettled]);
  useEffect(() => {
    if (!navigationSettled || !pushEnabled) {
      setPushSubscribed(false);
      return;
    }
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
  }, [navigationSettled, pushEnabled, showToast]);
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
  const homePath = languageHomePath(languageCode, configuredLanguageCodes);
  const homeNavigation = [{ label: t("nav.home"), href: homePath }];
  const currentPath = normalizeBrowserPath(location.pathname);
  const isCheckoutRoute = currentPath === normalizeBrowserPath(checkoutPath);
  const hideCheckoutNavigation = isCheckoutRoute && data?.storefrontConfig.checkout.distractionFree === true;
  useEffect(() => {
    if (isCheckoutRoute) {
      document.documentElement.dataset.storefrontCheckout = "true";
    } else {
      delete document.documentElement.dataset.storefrontCheckout;
    }
    return () => {
      delete document.documentElement.dataset.storefrontCheckout;
    };
  }, [isCheckoutRoute]);
  const headerNavigation = Array.isArray(data?.header) && data.header.length
    ? data.header
    : isBackendConfigured
      ? homeNavigation
      : undefined;
  const mobileNavigation = Array.isArray(data?.mobile) && data.mobile.length
    ? data.mobile
    : headerNavigation;
  const footerColumns = Array.isArray(data?.footer) && data.footer.length
    ? data.footer
    : isBackendConfigured
      ? [{ title: t("nav.home"), links: homeNavigation }]
      : undefined;
  const assistant = useAiShoppingAssistantSurfaces(data?.storefrontConfig);
  const canPublishCommunityPosts = viewer?.capabilities.includes("publish_community_posts") ?? false;
  const publishAction = showHeaderPublishButton && canPublishCommunityPosts ? (
    <button
      type="button"
      onClick={() => setIsCommunityPublishOpen(true)}
      aria-label="Publish a community post"
      title="Publish a community post"
      className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:ring-offset-zinc-950"
    >
      <Plus className="h-5 w-5" aria-hidden="true" />
    </button>
  ) : null;
  return (
    <>
      <StorefrontChromeMockup
        featuredProducts={
          isBackendConfigured
            ? featuredProducts?.map((product) =>
                formatProductCardCurrency(product, formatBaseAmount)) ?? []
            : MOCK_PRODUCTS.slice(0, 4)
        }
        primaryNavigation={hideCheckoutNavigation ? [] : headerNavigation}
        mobileNavigation={hideCheckoutNavigation ? [] : mobileNavigation}
        footerColumns={hideCheckoutNavigation ? [] : footerColumns}
        hideNavigation={hideCheckoutNavigation}
        search={search}
        onNewsletterSubscribe={isBackendConfigured ? subscribeToNewsletter : undefined}
        homePath={homePath}
        storefrontConfig={data?.storefrontConfig}
        onPushToggle={pushEnabled ? togglePush : undefined}
        pushSubscribed={pushSubscribed}
        pushBusy={pushBusy}
        headerActionSlot={<>{publishAction}{assistant.headerActionSlot}</>}
        footerAssistantSlot={assistant.footerAssistantSlot}
        assistantOverlaySlot={assistant.assistantOverlaySlot}
        floatingAssistantSlot={assistant.floatingAssistantSlot}
      />
      {isCommunityPublishOpen ? (
        <UploadPostModal
          onClose={() => setIsCommunityPublishOpen(false)}
          defaultLanguageCode={languageCode}
          searchTranslationCandidates={searchTranslationCandidateCommunityPosts}
          onSubmit={async (draft) => {
            const media = draft.media.map(({ dataUrl }) => {
              if (!dataUrl) throw new Error("New community media is missing its upload data");
              return { dataUrl };
            });
            await createCommunityPost({
              title: draft.title,
              description: draft.description,
              tags: draft.tags,
              media,
              language: draft.languageCode || languageCode,
              translationOfId: draft.translationOfId,
            });
            refreshCommunity();
          }}
        />
      ) : null}
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

function getStorefrontApplicationRoot(): HTMLElement | null {
  return document.getElementById("storefront-react-root") || document.getElementById("root");
}

function StorefrontVisibleReadySignal() {
  const {
    data: navigation,
    isLoading: navigationLoading,
    error: navigationError,
  } = useNavigationData();
  const themeStylesReady = useWordPressThemeStylesReady();
  const navigationSettled = !navigationLoading
    && Boolean(navigation || navigationError || !isBackendConfigured);
  useEffect(() => {
    const root = getStorefrontApplicationRoot();
    if (!root) return;
    let hasAnnounced = false;
    const announceWhenCoherent = () => {
      if (hasAnnounced) return;
      const cmsContent = root.querySelector("[data-cms-page]:not([data-prerendered-cms-snapshot])");
      const criticalContent = cmsContent || root.querySelector(
        "[data-rendered-cms-shortcode], main article, main h1",
      );
      const cmsStylesReady = !cmsContent
        || cmsContent.getAttribute("data-cms-styles-ready") === "true";
      const pendingContent = hasPendingVisibleContent(root);
      if (
        !criticalContent
        || pendingContent
        || !navigationSettled
        || !themeStylesReady
        || !cmsStylesReady
      ) return;
      hasAnnounced = true;
      root.dataset.storefrontVisibleReady = "true";
      root.dataset.storefrontReady = "true";
      performance.mark("storefront:visible-ready");
      window.dispatchEvent(new Event("funky:storefront-visible-ready"));
      window.dispatchEvent(new Event("funky:storefront-ready"));
      observer.disconnect();
    };
    const observer = new MutationObserver(announceWhenCoherent);
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-cms-styles-ready"],
      childList: true,
      subtree: true,
    });
    announceWhenCoherent();
    return () => {
      observer.disconnect();
    };
  }, [navigationSettled, themeStylesReady]);
  return null;
}

function CmsScriptRuntime() {
  useEffect(() => {
    const root = getStorefrontApplicationRoot();
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
  const initialGeneratedMarkup = useRef<string | null>(null);
  if (initialGeneratedMarkup.current === null) {
    initialGeneratedMarkup.current = document.getElementById("prerendered-storefront")?.innerHTML || "";
  }
  const generatedPayload = isGeneratedHome
    ? document.getElementById("storefront-route-payload")?.textContent
      || initialGeneratedMarkup.current
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
  const communityFeedOnly = requirements.community
    && canUseHomepageCommunityFeed(pathname, generatedPayload);
  const blogSummaryOnly = requirements.blog
    && canUseHomepageBlogSummary(pathname, generatedPayload);

  useEffect(() => {
    const root = getStorefrontApplicationRoot();
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

  return (
    <CommerceDataProvider enabled={enabled && requirements.commerce}>
      <CommunityDataProvider
        enabled={enabled && requirements.community}
        feedOnly={Boolean(communityFeedOnly)}
      >
        <CreatorContentProvider>
          <BlogDataProvider
            enabled={enabled && requirements.blog}
            summaryOnly={Boolean(blogSummaryOnly)}
          >
            <StickyPostsDataProvider enabled={enabled && requirements.stickyPosts}>
              {children}
            </StickyPostsDataProvider>
          </BlogDataProvider>
        </CreatorContentProvider>
      </CommunityDataProvider>
    </CommerceDataProvider>
  );
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

  return <PageMockupPage routeKey={routeKey} synchronizeLanguage={false} />;
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
    if (matchesStorefrontFallbackPath(currentPath, fallback, routeLanguage)) {
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
      synchronizeLanguage={false}
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

function LayoutStudioSessionControls() {
  const navigate = useNavigate();
  const { data } = useNavigationData();
  const prefs = useLayoutPreferences();
  if (!prefs.isLayoutPreviewActive) return null;

  const exitPreview = () => {
    const layout = data?.storefrontConfig.layout;
    if (layout) applyLayoutConfiguration(prefs, layout);
    prefs.setLayoutPreviewActive(false);
  };

  return (
    <aside
      aria-label="Layout Studio preview controls"
      className="fixed bottom-4 right-4 z-[100] flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-violet-300 bg-zinc-950 px-3 py-2 text-xs font-semibold text-white shadow-2xl"
    >
      <span className="hidden sm:inline">Layout Studio preview</span>
      <button
        type="button"
        onClick={() => navigate("/layout-studio")}
        className="rounded-full bg-violet-600 px-3 py-1.5 hover:bg-violet-500"
      >
        Controls
      </button>
      <button
        type="button"
        onClick={exitPreview}
        className="rounded-full px-3 py-1.5 text-zinc-200 hover:bg-white/10 hover:text-white"
      >
        Exit &amp; revert
      </button>
    </aside>
  );
}

function HiddenPresentationRoute({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <Seo title={title} robots="noindex, nofollow, noarchive, nosnippet" />
      {children}
    </>
  );
}

function LanguageUrlNormalizer() {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    configuredLanguageCodes,
    hasBackendLanguageOptions,
    languageCode,
    languageSelectionRevision,
    setLanguageCodeFromRoute,
  } = useLanguage();
  const currentUrl = `${location.pathname}${location.search}${location.hash}`;
  const { resolution: storefrontLanguageRoute } = useResolvedStorefrontLanguageRoute(location.pathname);
  const storefrontLanguageTarget = storefrontLanguageRoute?.targetPath;
  const handledSelectionRevision = useRef(languageSelectionRevision);
  const pendingSelection = useRef<{ sourceUrl: string; targetUrl: string | null } | null>(null);

  useEffect(() => {
    if (!hasBackendLanguageOptions) return;
    const languageSelectionChanged = handledSelectionRevision.current !== languageSelectionRevision;
    handledSelectionRevision.current = languageSelectionRevision;
    if (languageSelectionChanged) {
      pendingSelection.current = { sourceUrl: currentUrl, targetUrl: null };
    } else if (pendingSelection.current?.targetUrl === currentUrl) {
      pendingSelection.current = null;
      return;
    } else if (
      pendingSelection.current?.sourceUrl === currentUrl
      && pendingSelection.current.targetUrl
    ) {
      return;
    } else if (
      pendingSelection.current
      && pendingSelection.current.sourceUrl !== currentUrl
    ) {
      pendingSelection.current = null;
    }
    const languageSelectionPending = pendingSelection.current?.sourceUrl === currentUrl;
    if (languageSelectionPending && storefrontLanguageTarget) {
      const targetUrl = `${storefrontLanguageTarget}${location.search}${location.hash}`;
      if (targetUrl === currentUrl) {
        pendingSelection.current = null;
      } else {
        pendingSelection.current = { sourceUrl: currentUrl, targetUrl };
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
      && languageSelectionPending
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

    pendingSelection.current = { sourceUrl: currentUrl, targetUrl: action.to };
    navigate(action.to, { replace: true });
  }, [
    configuredLanguageCodes,
    currentUrl,
    hasBackendLanguageOptions,
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

  return (
    <HelmetProvider>
      <GlobalFeedDiscovery />
      <CmsScriptRuntime />
      <BrowserRouter>
        <AppStateProvider
          accountId={accountId}
          wishlistRemote={wishlistRemote}
          readingListRemote={readingListRemote}
        >
          <SmartLinkNavigation />
          <CartSyncManager />
          <LanguageUrlNormalizer />
          <WordPressThemeStylesProvider enabled={isBackendConfigured}>
            <NavigationDataProvider enabled={isBackendConfigured}>
              <LayoutPreferencesBackendSync />
              <LayoutStudioSessionControls />
              <StorefrontVisibleReadySignal />
              <ConnectedProductCardPreferences>
                <RouteDataProviders enabled={isBackendConfigured}>
                  <Suspense fallback={<RouteSuspenseFallback />}>
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
                    <Route path="/:language/product-category/*" element={<ProductCategoryMockupPage />} />
                    <Route path="/:language/product-tag/*" element={<ProductTagMockupPage />} />
                    <Route path="/:language/brand/:slug" element={<ProductBrandMockupPage />} />
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
                    <Route path="/spolecznosc" element={<StorefrontRedirectRoute routeKey="community" fallback="/community" />} />
                    <Route path="/:language/spolecznosc" element={<StorefrontRedirectRoute routeKey="community" fallback="/community" />} />
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
                      element={<OrderSuccessDigitalMockupPage />}
                    />
                    <Route
                      path="/:language/order-success/digital"
                      element={<OrderSuccessDigitalMockupPage />}
                    />
                    <Route path="/order/:id" element={<OrderDetailMockupPage />} />
                    <Route path="/:language/order/:id" element={<OrderDetailMockupPage />} />
                    <Route path="/unsubscribe" element={<StorefrontRedirectRoute routeKey="unsubscribe" fallback="/unsubscribe" />} />
                    <Route path="/auth/reset-password" element={<ResetPasswordMockupPage />} />
                    <Route path="/oauth/login/:provider" element={<OAuthCallbackPage />} />
                    <Route path="/shortcodes" element={<HiddenPresentationRoute title="Shortcode library"><ShortcodeLibraryMockupPage /></HiddenPresentationRoute>} />
                    <Route path="/layout-studio" element={<HiddenPresentationRoute title="Layout Studio"><LayoutStudioMockupPage /></HiddenPresentationRoute>} />
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

function RouteSuspenseFallback() {
  const loader = resolveThemeAwareLoaderConfiguration(DEFAULT_LOADER_CONFIGURATION);

  return (
    <div
      className="fixed inset-0 z-[2147483646] grid min-h-[100dvh] place-items-center bg-[rgb(var(--theme-background,250_250_250))] px-4 text-[rgb(var(--theme-foreground,24_24_27))] dark:bg-[rgb(var(--theme-foreground,24_24_27))] dark:text-[rgb(var(--theme-background,250_250_250))]"
      aria-live="polite"
      role="status"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <StorefrontPreloader
          loader={loader}
          className="flex items-center justify-center"
          style={{ filter: "drop-shadow(0 0 18px rgb(var(--brand-500) / 0.18))" }}
        />
        <span className="text-[10px] font-medium uppercase tracking-[0.32em] text-zinc-500 dark:text-zinc-400">
          Loading
        </span>
        <span className="sr-only">Loading page section</span>
      </div>
    </div>
  );
}
