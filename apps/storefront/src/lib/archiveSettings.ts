import { graphqlRequest } from "@funky/sdk";
import type { ArchivePageSizes } from "@funky/ui";
import type { GraphqlFieldFallbackRequester } from "./graphqlFieldFallback.ts";

export const ARCHIVE_SETTINGS_CACHE_KEY = "archive-settings:v1";
export const ARCHIVE_BATCH_SIZE = 25;

type ArchiveBatchPageInfo = {
  hasNextPage: boolean;
  endCursor?: string | null;
};

function validPageSize(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && (value === -1 || value > 0);
}

export async function getArchiveSettings(request: GraphqlFieldFallbackRequester = graphqlRequest): Promise<ArchivePageSizes> {
  const result = await request<{ funkycommerceArchiveSettings: ArchivePageSizes | null }>(`
    query StorefrontArchiveSettings {
      funkycommerceArchiveSettings {
        postsPerPage
        productsPerPage
      }
    }
  `);
  if (result.errors?.length) {
    if (!result.errors.every(({ message }) => /Cannot query field "funkycommerceArchiveSettings" on type "RootQuery"/i.test(message))) {
      throw new Error(result.errors.map(({ message }) => message).join("; "));
    }
    const legacy = await request<{ readingSettings: { postsPerPage: number | null } | null }>(`
      query StorefrontLegacyArchiveSettings { readingSettings { postsPerPage } }
    `);
    if (legacy.errors?.length) throw new Error(legacy.errors.map(({ message }) => message).join("; "));
    const postsPerPage = legacy.data?.readingSettings?.postsPerPage;
    if (!validPageSize(postsPerPage)) throw new Error("WordPress returned an invalid posts-per-page setting.");
    console.warn("[archive-settings] Update the backend theme to expose native WooCommerce pagination; using 12 products per page until then.");
    return { postsPerPage, productsPerPage: 12 };
  }
  const settings = result.data?.funkycommerceArchiveSettings;
  if (!settings || !validPageSize(settings.postsPerPage) || !validPageSize(settings.productsPerPage)) {
    throw new Error("The backend returned invalid archive pagination settings.");
  }
  return settings;
}

export function resolveArchivePageSize(value: number | null | undefined): number {
  return validPageSize(value) ? value : 10;
}

export async function fetchRestArchiveNodes<TNode>(endpoint: string, request: typeof fetch = fetch): Promise<TNode[]> {
  const nodes: TNode[] = [];
  for (let page = 1; page <= 1_000; page += 1) {
    const url = new URL(endpoint);
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));
    const response = await request(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status === 404 && page === 1) return [];
    if (!response.ok) throw new Error(`WooCommerce Store API catalog failed with status ${response.status}`);
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) throw new Error("WooCommerce Store API catalog returned a non-array payload");
    const totalPagesHeader = response.headers.get("x-wp-totalpages");
    const totalPages = Number(totalPagesHeader);
    if (totalPagesHeader === null || !Number.isSafeInteger(totalPages) || totalPages < 0) {
      throw new Error("WooCommerce Store API catalog returned invalid pagination headers");
    }
    nodes.push(...payload);
    if (page >= totalPages) return nodes;
    if (!payload.length) throw new Error("WooCommerce Store API catalog returned an incomplete page");
  }
  throw new Error("WooCommerce Store API catalog exceeded 1,000 pagination batches");
}

export async function fetchArchiveNodesInBatches<TNode>(
  targetCount: number,
  fetchPage: (
    first: number,
    after: string | null,
  ) => Promise<{ nodes: TNode[]; pageInfo: ArchiveBatchPageInfo }>,
): Promise<{ nodes: TNode[]; hasMore: boolean }> {
  const requestedCount = resolveArchivePageSize(targetCount);
  const resolvedTargetCount = requestedCount === -1 ? Number.POSITIVE_INFINITY : requestedCount;
  const nodes: TNode[] = [];
  const cursors = new Set<string>();
  let after: string | null = null;

  while (nodes.length < resolvedTargetCount) {
    const remaining = resolvedTargetCount - nodes.length;
    const { nodes: pageNodes, pageInfo } = await fetchPage(Math.min(remaining, ARCHIVE_BATCH_SIZE), after);
    nodes.push(...pageNodes.slice(0, remaining));

    if (!pageInfo.hasNextPage) return { nodes, hasMore: false };
    if (nodes.length >= resolvedTargetCount) return { nodes, hasMore: true };
    if (!pageInfo.endCursor) {
      if (pageNodes.length === 0) return { nodes, hasMore: false };
      throw new Error("The archive query returned an incomplete pagination cursor");
    }
    if (cursors.has(pageInfo.endCursor)) throw new Error("The archive query repeated a pagination cursor");
    cursors.add(pageInfo.endCursor);
    if (cursors.size >= 1_000) throw new Error("The archive query exceeded 1,000 pagination batches");
    after = pageInfo.endCursor;
  }
  return { nodes, hasMore: false };
}
