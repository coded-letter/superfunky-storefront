import { getContentNodeInfo } from "./contentNodes";
import { getProductArchive, getProductByUriOrSlug, type CommerceTaxonomy } from "./commerce";
import { prefetchIncrementalData } from "@funky/sdk/react";
import { getPageByUri } from "./pages";
import { getPostByUri } from "./posts";
import { warmStorefrontDocument } from "./storefrontDocumentWarmup";
import { resolveTaxonomyArchiveIdentifier } from "./taxonomyRoutes";

function commerceTaxonomyForPath(pathname: string, languageCodes: readonly string[]): CommerceTaxonomy | null {
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0]?.toLowerCase();
  const routeSegments = languageCodes.some((code) => code.toLowerCase() === firstSegment)
    ? segments.slice(1)
    : segments;
  if (["product-category", "pro-cat"].includes(routeSegments[0])) return "category";
  if (["product-tag", "pro-tag"].includes(routeSegments[0])) return "tag";
  if (["brand", "product-brand"].includes(routeSegments[0])) return "brand";
  if (routeSegments[0] === "shop" && routeSegments[1] === "category") return "category";
  if (routeSegments[0] === "shop" && routeSegments[1] === "tag") return "tag";
  if (routeSegments[0] === "shop" && routeSegments[1] === "brand") return "brand";
  return null;
}

export async function prefetchStorefrontRoute(
  to: string,
  languageCode: string,
  languageBackendCode: string,
  languageCodes: string[],
): Promise<void> {
  const url = new URL(to, window.location.origin);
  const documentWarmup = warmStorefrontDocument(`${url.pathname}${url.search}`);
  const pathname = url.pathname;
  const uri = pathname === "/" ? "/" : `${pathname.replace(/\/+$/, "")}/`;
  const taxonomy = commerceTaxonomyForPath(pathname, languageCodes);
  if (taxonomy) {
    const identifier = resolveTaxonomyArchiveIdentifier(pathname);
    await Promise.all([
      documentWarmup,
      prefetchIncrementalData(
        `product-${taxonomy}:v2:${identifier.idType}:${identifier.identifier}:${languageCode}`,
        () => getProductArchive(
          taxonomy,
          identifier.identifier,
          identifier.idType,
          languageCode,
          languageBackendCode,
        ),
      ),
    ]);
    return;
  }
  const shopProduct = pathname.match(/^\/shop\/(?!category\/|tag\/|brand\/)([^/]+)\/?$/);
  if (shopProduct || /^\/product\//.test(pathname)) {
    const identifier = shopProduct?.[1] || pathname;
    await Promise.all([
      documentWarmup,
      prefetchIncrementalData(`product:${identifier}`, () => getProductByUriOrSlug(identifier)),
    ]);
    return;
  }

  if (/^\/blog\/(?!category\/|tag\/|author\/)[^/]+\/?$/.test(pathname)) {
    await Promise.all([
      documentWarmup,
      prefetchIncrementalData(`post:${uri}`, () => getPostByUri(uri)),
    ]);
    return;
  }

  const [page, node] = await Promise.all([
    prefetchIncrementalData(`content-page-by-uri:v1:${uri}`, () => getPageByUri(uri)),
    prefetchIncrementalData(
      `content-node:v3:${uri}`,
      () => getContentNodeInfo(uri, undefined, undefined, { probePage: false }),
    ),
  ]);
  if (node?.type === "Page" || page) {
    await Promise.all([
      documentWarmup,
      prefetchIncrementalData(`page:${uri}`, () => getPageByUri(uri)),
    ]);
  } else if (node?.type === "Post") {
    await Promise.all([
      documentWarmup,
      prefetchIncrementalData(`post:${uri}`, () => getPostByUri(uri)),
    ]);
  } else if (node?.type === "Product") {
    await Promise.all([
      documentWarmup,
      prefetchIncrementalData(`product:${pathname}`, () => getProductByUriOrSlug(pathname)),
    ]);
  } else {
    await documentWarmup;
  }
}
