import { getContentNodeInfo } from "./contentNodes";
import { getProductArchive, getProductByUriOrSlug, type CommerceTaxonomy } from "./commerce";
import { prefetchIncrementalData } from "@funky/sdk/react";
import { getAuthorArchive } from "./authors";
import { getPageByUri } from "./pages";
import { getPostTaxonomyArchive, type PostTaxonomy, type TaxonomyIdentifierType } from "./postArchives";
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

function publicArchiveForPath(
  pathname: string,
  languageCodes: readonly string[],
): { type: "author"; slug: string } | {
  type: "taxonomy";
  taxonomy: PostTaxonomy;
  identifier: string;
  idType: TaxonomyIdentifierType;
} | null {
  const segments = pathname.split("/").filter(Boolean);
  const firstSegment = segments[0]?.toLowerCase();
  const routeSegments = languageCodes.some((code) => code.toLowerCase() === firstSegment)
    ? segments.slice(1)
    : segments;
  const [prefix, slug] = routeSegments;
  if (prefix === "author" && slug) return { type: "author", slug };
  if (prefix === "blog" && ["category", "tag"].includes(routeSegments[1]) && routeSegments[2]) {
    return {
      type: "taxonomy",
      taxonomy: routeSegments[1] as PostTaxonomy,
      identifier: routeSegments[2],
      idType: "SLUG",
    };
  }
  if (["category", "tag"].includes(prefix) && slug) {
    return {
      type: "taxonomy",
      taxonomy: prefix as PostTaxonomy,
      identifier: pathname === "/" ? "/" : `${pathname.replace(/\/+$/, "")}/`,
      idType: "URI",
    };
  }
  if (["c", "t"].includes(prefix) && slug) {
    return {
      type: "taxonomy",
      taxonomy: prefix === "c" ? "category" : "tag",
      identifier: pathname === "/" ? "/" : `${pathname.replace(/\/+$/, "")}/`,
      idType: "URI",
    };
  }
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
  const publicArchive = publicArchiveForPath(pathname, languageCodes);
  if (publicArchive?.type === "author") {
    await Promise.all([
      documentWarmup,
      prefetchIncrementalData(
        `author:v2:${publicArchive.slug}:${languageCode}:${languageBackendCode}:${languageCodes.join(",")}`,
        () => getAuthorArchive(
          publicArchive.slug,
          languageBackendCode,
          languageCode,
          languageCodes,
        ),
      ),
    ]);
    return;
  }
  if (publicArchive?.type === "taxonomy") {
    await Promise.all([
      documentWarmup,
      prefetchIncrementalData(
        `post-${publicArchive.taxonomy}-archive:${publicArchive.idType}:${publicArchive.identifier}:${languageCode}`,
        () => getPostTaxonomyArchive(
          publicArchive.taxonomy,
          publicArchive.identifier,
          publicArchive.idType,
          languageCode,
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
