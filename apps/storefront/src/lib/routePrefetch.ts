import { getContentNodeInfo } from "./contentNodes";
import { getProductByUriOrSlug } from "./commerce";
import { prefetchIncrementalData } from "@funky/sdk/react";
import { getPageByUri } from "./pages";
import { getPostByUri } from "./posts";
import { warmStorefrontDocument } from "./storefrontDocumentWarmup";

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
    prefetchIncrementalData(`content-node:v2:${uri}`, () => getContentNodeInfo(uri)),
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
