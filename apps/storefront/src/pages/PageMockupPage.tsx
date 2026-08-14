import { CmsPageContent } from "../components/CmsPageContent";
import { APPLICATION_SHORTCODE_RENDERERS } from "../components/applicationShortcodeRenderers";
import type { StorefrontRouteKey } from "../lib/storefrontRouteClassification";
import type { CmsPage } from "../lib/pages";
import { BlogIndexFallback } from "../components/BlogIndexFallback";

export function PageMockupPage({
  routeKey,
  loadPage,
  pageCacheKey,
  synchronizeLanguage = true,
}: {
  routeKey?: StorefrontRouteKey;
  loadPage?: () => Promise<CmsPage | null>;
  pageCacheKey?: string;
  synchronizeLanguage?: boolean;
}) {
  return (
    <CmsPageContent
      loadPage={loadPage}
      pageCacheKey={pageCacheKey}
      emptyFallback={routeKey === "blog" ? <BlogIndexFallback /> : undefined}
      shortcodeRenderers={APPLICATION_SHORTCODE_RENDERERS}
      synchronizeLanguage={synchronizeLanguage}
    />
  );
}
