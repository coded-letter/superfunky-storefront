import {
  graphqlRequest,
  STOREFRONT_BACKEND_PROFILE,
  type GraphqlResponse,
  type StorefrontBackendProfile,
} from "@funky/sdk";
import type { GraphqlFieldFallbackRequester } from "./graphqlFieldFallback.ts";
import { shouldPreferCoreGraphqlQueries } from "./profileGraphqlCompatibility.ts";

export type ContentNodeType = "Category" | "CommunityPost" | "Page" | "Post" | "Product" | "ProductBrand" | "ProductCategory" | "ProductTag" | "Tag";

export type ContentNodeInfo = {
  type: ContentNodeType;
};

type ContentNodeTypeResult = {
  nodeByUri: { __typename: string } | null;
};

type ContentNodePostResult = {
  post: { id: string } | null;
};

type ContentNodePageResult = {
  page: { id: string } | null;
};

const CONTENT_NODE_TYPE_QUERY = /* GraphQL */ `
  query StorefrontContentNodeType($uri: String!) {
    nodeByUri(uri: $uri) {
      __typename
    }
  }
`;

const CONTENT_NODE_POST_QUERY = /* GraphQL */ `
  query StorefrontContentNodePost($uri: ID!) {
    post(id: $uri, idType: URI) {
      id
    }
  }
`;

const CONTENT_NODE_PAGE_QUERY = /* GraphQL */ `
  query StorefrontContentNodePage($uri: ID!) {
    page(id: $uri, idType: URI) {
      id
    }
  }
`;

export async function getContentNodeInfo(
  uri: string,
  request: GraphqlFieldFallbackRequester = graphqlRequest,
  profile: StorefrontBackendProfile = STOREFRONT_BACKEND_PROFILE,
): Promise<ContentNodeInfo | null> {
  if (shouldPreferCoreGraphqlQueries(profile) && isRootLevelUri(uri)) {
    const postInfo = await getPostNodeInfo(uri, request);
    if (postInfo) return postInfo;
    const pageInfo = await getPageNodeInfo(uri, request);
    if (pageInfo) return pageInfo;
  }

  const { data, errors } = await request<ContentNodeTypeResult>(CONTENT_NODE_TYPE_QUERY, { uri });

  // A resolved node (e.g. a category/taxonomy archive with zero assigned posts or
  // products) is still valid content — only bail out on GraphQL errors when there's
  // no usable data to classify, so unrelated resolver warnings don't turn an empty
  // archive into a "Content unavailable" error page.
  if (!data) {
    if (hasMalformedNodeByUriError(errors)) {
      return getPostNodeInfo(uri, request);
    }
    if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
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

  return { type };
}

function isRootLevelUri(uri: string): boolean {
  return uri.split("/").filter(Boolean).length === 1;
}

async function getPostNodeInfo(
  uri: string,
  request: GraphqlFieldFallbackRequester,
): Promise<ContentNodeInfo | null> {
  const { data, errors } = await request<ContentNodePostResult>(CONTENT_NODE_POST_QUERY, { uri });
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  if (!data) throw new Error("The content-node post fallback returned no data");
  return data.post ? { type: "Post" } : null;
}

async function getPageNodeInfo(
  uri: string,
  request: GraphqlFieldFallbackRequester,
): Promise<ContentNodeInfo | null> {
  const { data, errors } = await request<ContentNodePageResult>(CONTENT_NODE_PAGE_QUERY, { uri });
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  if (!data) throw new Error("The content-node page fallback returned no data");
  return data.page ? { type: "Page" } : null;
}

function hasMalformedNodeByUriError(
  errors: GraphqlResponse<unknown>["errors"],
): boolean {
  return Boolean(errors?.length) && errors?.every(({ extensions }) =>
    extensions?.debugMessage?.includes("Cannot access offset of type string on string"),
  ) === true;
}

/** @deprecated Use getContentNodeInfo instead */
export async function getContentNodeType(uri: string): Promise<ContentNodeType | null> {
  const info = await getContentNodeInfo(uri);
  return info?.type ?? null;
}
