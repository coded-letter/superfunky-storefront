import { BrowserRouter, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AppStateProvider, StorefrontChromeMockup } from "@funky/ui";
import {
  AuthorMockupPage,
  CommunityArticleMockupPage,
  CommunityPostMockupPage,
  CommunityProfileMockupPage,
  ContentNodeRoute,
  LayoutStudioMockupPage,
  NotFoundMockupPage,
  OAuthCallbackPage,
  OrderDetailMockupPage,
  PageMockupPage,
  PostCategoryMockupPage,
  PostMockupPage,
  PostTagMockupPage,
  ProductCategoryMockupPage,
  ProductMockupPage,
  ProductTagMockupPage,
  ProductBrandMockupPage,
  ResetPasswordMockupPage,
  ShortcodeLibraryMockupPage,
  SitemapPage,
} from "./pages";
import { MOCK_PRODUCTS } from "./pages/shared";
import { APPLICATION_SHORTCODE_RENDERERS } from "./components/applicationShortcodeRenderers";
import { WordPressSpecialPageContent } from "./components/WordPressSpecialPageContent";
import { AiShoppingAssistant } from "./components/AiShoppingAssistant";
import { GlobalFeedDiscovery } from "./components/GlobalFeedDiscovery";
import { useAuthHeartbeat } from "./lib/auth";
import { useSyncCartToBackend } from "./lib/backendCart";
import type { StorefrontRouteKey } from "./lib/storefrontPaths";
import { useResolvedStorefrontPath } from "./lib/storefrontPaths";
import { useT } from "@funky/ui";
import { CreatorContentProvider } from "./state/creatorContent";
import { BlogDataProvider } from "./state/blogData";
import { NavigationDataProvider, useNavigationData } from "./state/navigationData";
import { CommerceDataProvider, useCommerceData } from "./state/commerceData";
import { CommunityDataProvider, useCommunityData } from "./state/communityData";
import { WordPressThemeStylesProvider } from "./state/wordpressThemeStyles";
import { useLanguage } from "@funky/ui";
import { searchStorefront } from "./lib/search";
import { submitNewsletterSubmission } from "./lib/submissions";
import { isBackendConfigured } from "./lib/env";
import { languageHomePath } from "./lib/languageMapping";
import { useCallback, useEffect, useRef, type ReactNode } from "react";

function ConnectedStorefrontChrome() {
  const { data } = useNavigationData();
  const { data: commerce } = useCommerceData();
  const { languageCode, languageBackendCode } = useLanguage();
  const t = useT();
  const search = useCallback(
    (query: string) => searchStorefront(query, languageBackendCode, t),
    [languageBackendCode, t],
  );
  const subscribeToNewsletter = useCallback(
    (email: string) => submitNewsletterSubmission(email, { source: "newsletter-popup", language: languageCode }),
    [languageCode],
  );
  // An explicit empty array keeps the UI package from applying its mock navigation
  // default while the WordPress menu request is loading or unavailable.
  const headerNavigation = Array.isArray(data?.header) ? data.header : [];
  const mobileNavigation = Array.isArray(data?.mobile) && data.mobile.length
    ? data.mobile
    : headerNavigation;
  const footerColumns = Array.isArray(data?.footer) ? data.footer : [];
  const products = Array.isArray(commerce?.products) ? commerce.products : [];
  // Compute the language-aware home path so the logo link goes directly to the
  // correct home without triggering a redirect. "/" is kept for fallback languages
  // that don't have an explicit /:lang home route yet.
  const homePath = languageHomePath(languageCode);

  return (
    <>
      <StorefrontChromeMockup
        featuredProduct={products[0] || MOCK_PRODUCTS[0]}
        primaryNavigation={headerNavigation}
        mobileNavigation={mobileNavigation}
        footerColumns={footerColumns}
        search={search}
        onNewsletterSubscribe={isBackendConfigured ? subscribeToNewsletter : undefined}
        homePath={homePath}
        storefrontConfig={data?.storefrontConfig}
      />
      <AiShoppingAssistant />
    </>
  );
}

function CartSyncManager() {
  useSyncCartToBackend();
  return null;
}

function normalizeBrowserPath(path: string): string {
  if (path === "/") return "/";
  return path.endsWith("/") ? path.slice(0, -1) : path;
}

function StorefrontSpecialPageRoute({
  routeKey,
  fallback,
}: {
  routeKey: Extract<StorefrontRouteKey, "shop" | "blog" | "cart" | "checkout" | "account">;
  fallback: string;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { path, isLoading } = useResolvedStorefrontPath(routeKey, fallback);
  const currentPath = normalizeBrowserPath(location.pathname);
  const resolvedPath = normalizeBrowserPath(path);

  // Only redirect when on the English fallback path and a translated path
  // exists. Once we are on a translated slug, WordPressSpecialPageContent
  // owns the URL via its own navigation effect, so we never block the render
  // here — that prevents the "content changes but URL stays stale" bug on
  // rapid language switches.
  useEffect(() => {
    if (isLoading || resolvedPath === currentPath) return;
    if (currentPath === normalizeBrowserPath(fallback)) {
      navigate(path, { replace: true });
    }
  }, [currentPath, fallback, isLoading, navigate, path, resolvedPath]);

  return <WordPressSpecialPageContent pageKey={routeKey} shortcodeRenderers={APPLICATION_SHORTCODE_RENDERERS} />;
}

function StorefrontRedirectRoute({ routeKey, fallback }: { routeKey: StorefrontRouteKey; fallback: string }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { path, isLoading } = useResolvedStorefrontPath(routeKey, fallback);
  const currentPath = normalizeBrowserPath(location.pathname);
  const resolvedPath = normalizeBrowserPath(path);

  useEffect(() => {
    if (isLoading || resolvedPath === currentPath) return;
    if (currentPath === normalizeBrowserPath(fallback)) {
      navigate(path, { replace: true });
    }
  }, [currentPath, fallback, isLoading, navigate, path, resolvedPath]);

  return <PageMockupPage />;
}

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

function HomePageRoute() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language: routeLanguage } = useParams();
  const { languageCode, languageOptions, setLanguageCode } = useLanguage();
  const explicitLanguage = routeLanguage?.toLowerCase();
  const isSupportedLanguage = explicitLanguage
    ? languageOptions.some(({ code }) => code === explicitLanguage)
    : true;
  // Tracks the previous languageCode so we can detect changes vs initial mount.
  // null means the effect hasn't run yet (first mount pass).
  const prevLangRef = useRef<string | null>(null);

  // On mount only: sync context to the explicit language declared in the URL.
  // Handles deep-links (e.g. someone shares /en but the visitor prefers Polish).
  // Intentionally omits languageCode from deps — we never want to re-sync and
  // override a language the user just picked with the switcher.
  useEffect(() => {
    if (explicitLanguage && explicitLanguage !== languageCode) {
      setLanguageCode(explicitLanguage);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explicitLanguage, setLanguageCode]);

  // After mount: when the language context changes (user used the language switcher),
  // navigate to the matching home path.  The first-run guard (prevLangRef === null)
  // prevents this from racing with the mount-sync above.
  useEffect(() => {
    if (prevLangRef.current === null) {
      prevLangRef.current = languageCode;
      return;
    }
    if (prevLangRef.current === languageCode) return;
    prevLangRef.current = languageCode;

    const target = languageHomePath(languageCode);
    if (location.pathname !== target) {
      navigate(target, { replace: true });
    }
  }, [languageCode, location.pathname, navigate]);

  // Redirect bare "/" to the language-prefixed home on initial load.
  useEffect(() => {
    if (explicitLanguage) return;
    if (location.pathname !== "/") return;
    navigate(languageHomePath(languageCode), { replace: true });
  }, [explicitLanguage, languageCode, location.pathname, navigate]);

  if (!isSupportedLanguage) return <ContentNodeRoute />;
  return <WordPressSpecialPageContent pageKey="home" />;
}

export function App() {
  useAuthHeartbeat();

  return (
    <HelmetProvider>
      <GlobalFeedDiscovery />
      <BrowserRouter>
        <AppStateProvider>
          <CartSyncManager />
          <WordPressThemeStylesProvider>
            <NavigationDataProvider>
              <CommerceDataProvider>
                <CommunityDataProvider>
                  <CreatorContentProvider>
                  <Routes>
                  <Route element={<ConnectedStorefrontChrome />}>
                  <Route element={<BlogDataProvider />}>
                    <Route path="/" element={<HomePageRoute />} />
                    <Route path="/:language" element={<HomePageRoute />} />
                    <Route path="/shop" element={<StorefrontSpecialPageRoute routeKey="shop" fallback="/shop" />} />
                    <Route path="/shop/category/:slug" element={<ProductCategoryMockupPage />} />
                    <Route path="/shop/tag/:slug" element={<ProductTagMockupPage />} />
                    <Route path="/shop/brand/:slug" element={<ProductBrandMockupPage />} />
                    <Route path="/shop/:slug" element={<ProductMockupPage />} />
                    <Route path="/product/*" element={<ProductMockupPage />} />
                    <Route path="/product-category/*" element={<ProductCategoryMockupPage />} />
                    <Route path="/product-tag/*" element={<ProductTagMockupPage />} />
                    <Route path="/brand/*" element={<ProductBrandMockupPage />} />
                    <Route path="/blog" element={<StorefrontSpecialPageRoute routeKey="blog" fallback="/blog" />} />
                    <Route path="/blog/category/:slug" element={<PostCategoryMockupPage />} />
                    <Route path="/blog/tag/:slug" element={<PostTagMockupPage />} />
                    <Route path="/blog/author/:slug" element={<AuthorMockupPage />} />
                    <Route path="/author/:slug" element={<AuthorMockupPage />} />
                    <Route path="/:language/author/:slug" element={<AuthorMockupPage />} />
                    <Route path="/blog/:slug" element={<PostMockupPage />} />
                    <Route path="/sitemap" element={<SitemapPage />} />
                    <Route path="/cart" element={<StorefrontSpecialPageRoute routeKey="cart" fallback="/cart" />} />
                    <Route path="/checkout" element={<StorefrontSpecialPageRoute routeKey="checkout" fallback="/checkout" />} />
                    <Route path="/community/post/:postId" element={<CommunityPostMockupPage />} />
                    <Route path="/community_post/:slug" element={<CommunityPostMockupPage />} />
                    <Route path="/:language/community_post/:slug" element={<CommunityPostMockupPage />} />
                    <Route path="/community/:handle/articles/:slug" element={<CommunityArticleMockupPage />} />
                    <Route path="/community/:handle" element={<CommunityProfileMockupPage />} />
                    <Route path="/account" element={<StorefrontSpecialPageRoute routeKey="account" fallback="/account" />} />
                    <Route path="/wishlist" element={<StorefrontRedirectRoute routeKey="wishlist" fallback="/wishlist" />} />
                    <Route path="/reading-list" element={<StorefrontRedirectRoute routeKey="reading-list" fallback="/reading-list" />} />
                    <Route path="/community" element={<StorefrontRedirectRoute routeKey="community" fallback="/community" />} />
                    <Route path="/auth" element={<StorefrontRedirectRoute routeKey="auth-login" fallback="/auth" />} />
                    <Route path="/order-success" element={<StorefrontRedirectRoute routeKey="order-success" fallback="/order-success" />} />
                    <Route path="/order/:id" element={<OrderDetailMockupPage />} />
                    <Route path="/unsubscribe" element={<StorefrontRedirectRoute routeKey="unsubscribe" fallback="/unsubscribe" />} />
                    <Route path="/auth/reset-password" element={<ResetPasswordMockupPage />} />
                    <Route path="/oauth/login/:provider" element={<OAuthCallbackPage />} />
                    <Route path="/shortcodes" element={<AdminCapabilityRoute><ShortcodeLibraryMockupPage /></AdminCapabilityRoute>} />
                    <Route path="/layout-studio" element={<AdminCapabilityRoute><LayoutStudioMockupPage /></AdminCapabilityRoute>} />
                    <Route path="*" element={<ContentNodeRoute />} />
                  </Route>
                  </Route>
                  </Routes>
                  </CreatorContentProvider>
                </CommunityDataProvider>
              </CommerceDataProvider>
            </NavigationDataProvider>
          </WordPressThemeStylesProvider>
        </AppStateProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}
