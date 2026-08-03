import { Link, useLocation } from "react-router-dom";
import { getContentNodeInfo } from "../lib/contentNodes";
import { useIncrementalData } from "../lib/incrementalData";
import { getPageByUri } from "../lib/pages";
import { getSpecialStorefrontRouteRegistry, matchStorefrontRouteKey } from "../lib/storefrontPaths";
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
import { APPLICATION_SHORTCODE_RENDERERS } from "../components/applicationShortcodeRenderers";
import { WordPressSpecialPageContent } from "../components/WordPressSpecialPageContent";

export function ContentNodeRoute() {
  const { pathname } = useLocation();
  const uri = pathname.endsWith("/") ? pathname : `${pathname}/`;
  const { data: specialRegistry, isLoading: isLoadingSpecialRegistry } = useIncrementalData(
    "special-storefront-route-registry:v1",
    getSpecialStorefrontRouteRegistry,
  );
  const { data: page, isLoading: isLoadingPage } = useIncrementalData(
    `content-page-by-uri:v1:${uri}`,
    () => getPageByUri(uri),
  );
  const matchedRouteKey = matchStorefrontRouteKey(specialRegistry || [], pathname);
  const { data: nodeInfo, isLoading, error } = useIncrementalData(`content-node:v2:${uri}`, () => getContentNodeInfo(uri));

  // Special pages resolved from the registry take highest priority.
  if (matchedRouteKey && ["home", "shop", "blog", "cart", "checkout", "account"].includes(matchedRouteKey)) {
    return <WordPressSpecialPageContent pageKey={matchedRouteKey} shortcodeRenderers={APPLICATION_SHORTCODE_RENDERERS} />;
  }

  // Wait for both the page lookup and the type classifier before committing to
  // a template, so that community posts / posts at language-prefixed URIs are
  // never incorrectly rendered as PageMockupPage.
  if (isLoadingSpecialRegistry || isLoadingPage || isLoading) {
    return <ContentLoadingState label="Resolving content" />;
  }
  if (error) {
    return <RouteStatus title="Content unavailable" message={error.message} />;
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
    return <PageMockupPage />;
  }
  return <RouteStatus title="Content not found" message={`WordPress has no published content or taxonomy archive at "${uri}".`} />;
}

function RouteStatus({ title, message }: { title: string; message: string }) {
  return (
    <section className="mx-auto grid max-w-lg gap-4 rounded-3xl border border-zinc-200/80 bg-white p-10 text-center shadow-soft dark:border-zinc-800 dark:bg-zinc-900">
      <h1 className="m-0 font-display text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h1>
      <p className="m-0 text-zinc-500 dark:text-zinc-400">{message}</p>
      <Link to="/" className="mx-auto text-sm font-semibold text-brand-600 no-underline hover:text-brand-500 dark:text-brand-400">
        Back to home
      </Link>
    </section>
  );
}
