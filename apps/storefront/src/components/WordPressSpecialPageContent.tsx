import { useMemo, type ReactNode } from "react";
import { useLanguage } from "@funky/ui";
import { getPageByUri } from "../lib/pages";
import { resolveLocalizedSpecialPage } from "../lib/specialPages";
import { APPLICATION_SHORTCODE_RENDERERS } from "./applicationShortcodeRenderers";
import { CmsPageContent } from "./CmsPageContent";

export function WordPressSpecialPageContent({
  fallback,
  pageSlug,
}: {
  fallback: ReactNode;
  pageSlug: "404";
}) {
  const { languageCode } = useLanguage();
  const loadPage = useMemo(
    () => () => resolveLocalizedSpecialPage(pageSlug, languageCode, getPageByUri),
    [languageCode, pageSlug],
  );

  return (
    <CmsPageContent
      className={`sf-${pageSlug}`}
      fallback={fallback}
      loadPage={loadPage}
      pageCacheKey={`special-page:${pageSlug}:${languageCode}`}
      rootId={`sf-${pageSlug}`}
      robots="noindex, follow"
      shortcodeRenderers={APPLICATION_SHORTCODE_RENDERERS}
      synchronizeLanguage={false}
    />
  );
}
