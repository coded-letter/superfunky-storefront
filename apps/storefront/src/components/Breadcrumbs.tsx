import { Fragment } from "react";
import { Link } from "react-router-dom";
import { normalizeDisplayLabel, useLayoutPreferences } from "@funky/ui";

export type BreadcrumbItem = {
  label: string;
  /** Omit on the final (current-page) item — it renders as plain, non-linked text. */
  href?: string;
};

/** Placeholder absolute origin used only to build fully-qualified URLs for the JSON-LD
 * `item` fields below — this mockup has no real production domain yet. A future
 * integration should swap this for `window.location.origin` or a build-time env var. */
const SITE_ORIGIN = "https://funkycommerce.example.com";

/** Convert WordPress SEO breadcrumb entries (from Yoast / RankMath) to `BreadcrumbItem[]`
 *  ready for `<Breadcrumbs>`. The last item is left without an `href` so it renders
 *  as the non-linked current-page label. Returns an empty array when there is nothing
 *  meaningful to display (e.g. only a single "Home" entry). */
export function seoBreadcrumbsToItems(
  breadcrumbs: { name: string; url: string }[],
  fallback: BreadcrumbItem[],
): BreadcrumbItem[] {
  if (breadcrumbs.length > 1) {
    return breadcrumbs.map((crumb, index, all) => ({
      label: crumb.name,
      href: index === all.length - 1 ? undefined : toInternalBreadcrumbPath(crumb.url),
    }));
  }
  return fallback;
}

function toInternalBreadcrumbPath(url: string): string {
  try {
    return new URL(url, window.location.origin).pathname;
  } catch {
    return url;
  }
}

/**
 * Shared breadcrumb trail — renders the visible `<nav>` (matching the existing product
 * page style) plus a matching `BreadcrumbList` JSON-LD `<script>` for SEO, so every page
 * that uses it gets both the UI and the structured data from a single source of truth.
 */
export function Breadcrumbs({
  items,
  className = "",
  includeStructuredData = true,
}: {
  items: BreadcrumbItem[];
  className?: string;
  includeStructuredData?: boolean;
}) {
  const { showBreadcrumbs } = useLayoutPreferences();
  const normalizedItems = items.map((item) => ({ ...item, label: normalizeDisplayLabel(item.label) }));
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: normalizedItems.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      ...(item.href ? { item: `${SITE_ORIGIN}${item.href}` } : {}),
    })),
  };

  return (
    <>
      {showBreadcrumbs ? (
        <nav
          aria-label="Breadcrumb"
          className={`sf-breadcrumbs funky-breadcrumbs pt-3 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 ${className}`}
        >
          {normalizedItems.map((item, index) => {
            const isLast = index === normalizedItems.length - 1;
            return (
              <Fragment key={`${item.label}-${index}`}>
                {index > 0 ? (
                  <span aria-hidden="true" className="text-zinc-300 dark:text-zinc-700">
                    /
                  </span>
                ) : null}
                {item.href && !isLast ? (
                  <Link to={item.href} className="truncate no-underline hover:text-zinc-800 dark:hover:text-zinc-200">
                    {item.label}
                  </Link>
                ) : (
                  <span
                    aria-current={isLast ? "page" : undefined}
                    className={`truncate ${isLast ? "font-medium text-zinc-700 dark:text-zinc-200" : ""}`}
                  >
                    {item.label}
                  </span>
                )}
              </Fragment>
            );
          })}
        </nav>
      ) : null}
      {includeStructuredData ? (
        // eslint-disable-next-line react/no-danger -- static JSON.stringify output, not user-controlled HTML
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      ) : null}
    </>
  );
}
