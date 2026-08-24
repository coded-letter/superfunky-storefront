import type { FooterColumn, FooterLinkItem } from "@funky/ui/src/layout/FooterMockup.tsx";
import type { HeaderNavItem } from "@funky/ui/src/layout/HeaderMockup.tsx";
import { sanitizeCmsHtml } from "./cmsBehaviors.ts";

export type RawMenuItem = {
  id: string;
  databaseId: number;
  parentDatabaseId: number | null;
  order: number | null;
  label: string | null;
  title: string | null;
  description: string | null;
  path: string | null;
  uri: string | null;
  url: string | null;
  target: string | null;
  cssClasses: (string | null)[] | null;
  linkRelationship: string | null;
  locations: string[] | null;
};

export type MenuHrefNormalizer = (
  value: string | null,
  parentHref: string | undefined,
) => string;

export function mapMenuItems(
  items: RawMenuItem[],
  normalizeHref: MenuHrefNormalizer,
): HeaderNavItem[] {
  const uniqueItems = new Map<number, RawMenuItem>();
  items.forEach((item) => uniqueItems.set(item.databaseId, item));

  const sortedItems = [...uniqueItems.values()].sort(
    (left, right) => (left.order || 0) - (right.order || 0),
  );
  const childrenByParent = new Map<number, RawMenuItem[]>();
  const roots: RawMenuItem[] = [];

  sortedItems.forEach((item) => {
    const parentId = item.parentDatabaseId || 0;
    if (!parentId || !uniqueItems.has(parentId)) {
      roots.push(item);
      return;
    }
    const children = childrenByParent.get(parentId) || [];
    children.push(item);
    childrenByParent.set(parentId, children);
  });

  return roots.flatMap((item) =>
    mapMenuItem(item, childrenByParent, normalizeHref, undefined, new Set()),
  );
}

export function mapFooterColumns(items: HeaderNavItem[]): FooterColumn[] {
  return items.map((item) => ({
    title: item.label,
    description: item.description,
    cssClasses: item.cssClasses,
    // A childless top-level item doubles as the heading and its single link. Its
    // description belongs to the heading and must not be rendered twice.
    links: item.children?.length
      ? item.children.map(mapFooterLink)
      : [{ label: item.label, href: item.href, cssClasses: item.cssClasses }],
  }));
}

function mapFooterLink(item: HeaderNavItem): FooterLinkItem {
  return {
    label: item.label,
    href: item.href,
    description: item.description,
    cssClasses: item.cssClasses,
    children: item.children?.map(mapFooterLink),
  };
}

function mapMenuItem(
  item: RawMenuItem,
  childrenByParent: Map<number, RawMenuItem[]>,
  normalizeHref: MenuHrefNormalizer,
  parentHref: string | undefined,
  ancestors: Set<number>,
): HeaderNavItem[] {
  const label = item.label?.trim();
  if (!label || ancestors.has(item.databaseId)) return [];

  // WPGraphQL can expose a local-looking `path` for custom links. The canonical
  // `url` preserves an explicitly configured external host; backend URLs are still
  // converted to storefront paths by the normalizer.
  const href = normalizeHref(item.url || item.path || item.uri, parentHref);
  const nextAncestors = new Set(ancestors).add(item.databaseId);
  const children = (childrenByParent.get(item.databaseId) || []).flatMap((child) =>
    mapMenuItem(child, childrenByParent, normalizeHref, href, nextAncestors),
  );
  const description = sanitizeCmsHtml(item.description?.trim() || "");

  return [{
    id: item.id,
    label,
    href,
    title: item.title?.trim() || undefined,
    description: description || undefined,
    target: item.target?.trim() || undefined,
    cssClasses: item.cssClasses?.flatMap((className) => className?.trim() || []) || [],
    linkRelationship: item.linkRelationship?.trim() || undefined,
    children: children.length ? children : undefined,
  }];
}
