import { graphqlRequest } from "./graphqlClient";
import type { SpecialPageKey } from "./pages";

export type ContentNodeType = "Category" | "CommunityPost" | "Page" | "Post" | "Product" | "ProductBrand" | "ProductCategory" | "ProductTag" | "Tag";

export type ContentNodeInfo = {
  type: ContentNodeType;
  /** Set when the resolved Page is a registered special storefront page (shop, cart, etc.).
   * Used by ContentNodeRoute to render the correct template for translated special-page URLs
   * (e.g. /sklep/ → shop, /koszyk/ → cart) without a URL redirect. */
  specialPageKey?: SpecialPageKey;
};

type ContentNodeTypeResult = {
  nodeByUri: { __typename: string; funkycommerceSpecialPageKey?: string | null } | null;
};

const CONTENT_NODE_TYPE_QUERY = /* GraphQL */ `
  query StorefrontContentNodeType($uri: String!) {
    nodeByUri(uri: $uri) {
      __typename
      ... on Page {
        funkycommerceSpecialPageKey
      }
    }
  }
`;

const SPECIAL_PAGE_KEYS = new Set<SpecialPageKey>([
  "home", "shop", "blog", "cart", "checkout", "account",
]);

function isSpecialPageKey(value: unknown): value is SpecialPageKey {
  return typeof value === "string" && SPECIAL_PAGE_KEYS.has(value as SpecialPageKey);
}

export async function getContentNodeInfo(uri: string): Promise<ContentNodeInfo | null> {
  const { data, errors } = await graphqlRequest<ContentNodeTypeResult>(CONTENT_NODE_TYPE_QUERY, { uri });

  if (errors?.length) {
    // Gracefully handle schema errors for funkycommerceSpecialPageKey on older backends
    const fatalErrors = errors.filter((e) => !e.message.includes("funkycommerceSpecialPageKey"));
    if (fatalErrors.length) throw new Error(fatalErrors.map(({ message }) => message).join("; "));
  }
  if (!data) {
    throw new Error("The content-node query returned no data");
  }

  const node = data.nodeByUri;
  const typeName = node?.__typename;

  let type: ContentNodeType | null = null;
  if (typeName === "SimpleProduct" || typeName === "VariableProduct" || typeName === "ExternalProduct" || typeName === "GroupProduct") {
    type = "Product";
  } else if (
    typeName === "Category" || typeName === "CommunityPost" || typeName === "Page" ||
    typeName === "Post" || typeName === "Product" || typeName === "ProductBrand" ||
    typeName === "ProductCategory" || typeName === "ProductTag" || typeName === "Tag"
  ) {
    type = typeName;
  }

  if (!type) return null;

  const specialPageKey = isSpecialPageKey(node?.funkycommerceSpecialPageKey) ? node!.funkycommerceSpecialPageKey : undefined;
  return { type, specialPageKey };
}

/** @deprecated Use getContentNodeInfo instead */
export async function getContentNodeType(uri: string): Promise<ContentNodeType | null> {
  const info = await getContentNodeInfo(uri);
  return info?.type ?? null;
}
