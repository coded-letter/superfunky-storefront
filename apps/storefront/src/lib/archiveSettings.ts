import { graphqlRequest, type GraphqlResponse } from "@funky/sdk";

const DEFAULT_ARCHIVE_PAGE_SIZE = 10;
export const ARCHIVE_BATCH_SIZE = 100;
let archivePageSizePromise: Promise<number> | null = null;

type ArchiveBatchPageInfo = {
  hasNextPage: boolean;
  endCursor?: string | null;
};

export function getArchivePageSize(): Promise<number> {
  archivePageSizePromise ||= graphqlRequest<{
    readingSettings: { postsPerPage: number | null } | null;
  }>(`
    query StorefrontArchiveSettings {
      readingSettings {
        postsPerPage
      }
    }
  `).then((result: GraphqlResponse<{ readingSettings: { postsPerPage: number | null } | null }>) => {
    return resolveArchivePageSize(result.data?.readingSettings?.postsPerPage);
  }).catch(() => DEFAULT_ARCHIVE_PAGE_SIZE);
  return archivePageSizePromise;
}

export function resolveArchivePageSize(value: number | null | undefined): number {
  return Number.isSafeInteger(value) && value! > 0 ? value! : DEFAULT_ARCHIVE_PAGE_SIZE;
}

export async function fetchArchiveNodesInBatches<TNode>(
  targetCount: number,
  fetchPage: (
    first: number,
    after: string | null,
  ) => Promise<{ nodes: TNode[]; pageInfo: ArchiveBatchPageInfo }>,
): Promise<{ nodes: TNode[]; hasMore: boolean }> {
  const resolvedTargetCount = resolveArchivePageSize(targetCount);
  const nodes: TNode[] = [];
  let after: string | null = null;

  while (nodes.length < resolvedTargetCount) {
    const remaining = resolvedTargetCount - nodes.length;
    const { nodes: pageNodes, pageInfo } = await fetchPage(Math.min(remaining, ARCHIVE_BATCH_SIZE), after);
    nodes.push(...pageNodes.slice(0, remaining));

    if (!pageInfo.hasNextPage) {
      return { nodes, hasMore: false };
    }
    if (nodes.length >= resolvedTargetCount) {
      return { nodes, hasMore: true };
    }
    if (!pageInfo.endCursor) {
      if (pageNodes.length === 0) {
        return { nodes, hasMore: false };
      }
      throw new Error("The archive query returned an incomplete pagination cursor");
    }
    after = pageInfo.endCursor;
  }

  return { nodes, hasMore: false };
}
