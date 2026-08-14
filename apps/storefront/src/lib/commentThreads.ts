import type { ProductReview } from "../pages/shared";

export type ReviewNode = ProductReview & { replies: ReviewNode[] };

function isRootParent(parentId: string | null | undefined, parentDatabaseId: number | null | undefined): boolean {
  return (!parentId || parentId === "0") && (!parentDatabaseId || parentDatabaseId === 0);
}

export function isTopLevelReview(review: ProductReview): boolean {
  return isRootParent(review.parentId, review.parentDatabaseId);
}

export function isPendingReview(review: ProductReview): boolean {
  return review.isPending === true || review.id.startsWith("pending-");
}

export function mergeServerAndLocalReviews(
  serverReviews: ProductReview[],
  localReviews: ProductReview[],
): ProductReview[] {
  const merged = [...serverReviews];
  const ids = new Set(serverReviews.map(({ id }) => id));
  const databaseIds = new Set(
    serverReviews.flatMap(({ databaseId }) => databaseId ? [databaseId] : []),
  );

  localReviews.forEach((review) => {
    if (ids.has(review.id) || (review.databaseId && databaseIds.has(review.databaseId))) return;
    merged.push(review);
    ids.add(review.id);
    if (review.databaseId) databaseIds.add(review.databaseId);
  });

  return merged;
}

function compareDates(left: ProductReview, right: ProductReview, direction: 1 | -1): number {
  const leftTime = Date.parse(left.date) || 0;
  const rightTime = Date.parse(right.date) || 0;
  if (leftTime !== rightTime) return (leftTime - rightTime) * direction;

  const leftDatabaseId = left.databaseId || 0;
  const rightDatabaseId = right.databaseId || 0;
  if (leftDatabaseId !== rightDatabaseId) return (leftDatabaseId - rightDatabaseId) * direction;
  return left.id.localeCompare(right.id) * direction;
}

export function buildReviewTree(reviews: ProductReview[]): ReviewNode[] {
  const nodesById = new Map<string, ReviewNode>();
  const nodesByDatabaseId = new Map<number, ReviewNode>();

  reviews.forEach((review) => {
    const node = { ...review, replies: [] };
    nodesById.set(review.id, node);
    if (review.databaseId) nodesByDatabaseId.set(review.databaseId, node);
  });

  const resolvedParents = new Map<string, ReviewNode>();
  const resolveParent = (node: ReviewNode): ReviewNode | undefined => {
    if (isRootParent(node.parentId, node.parentDatabaseId)) return undefined;

    const parentById = node.parentId ? nodesById.get(node.parentId) : undefined;
    const numericParentId = node.parentId && /^\d+$/.test(node.parentId)
      ? Number(node.parentId)
      : undefined;
    return parentById
      || (node.parentDatabaseId ? nodesByDatabaseId.get(node.parentDatabaseId) : undefined)
      || (numericParentId ? nodesByDatabaseId.get(numericParentId) : undefined);
  };

  nodesById.forEach((node) => {
    const parent = resolveParent(node);
    if (parent && parent !== node) resolvedParents.set(node.id, parent);
  });

  const createsCycle = (node: ReviewNode): boolean => {
    const visited = new Set([node.id]);
    let parent = resolvedParents.get(node.id);
    while (parent) {
      if (visited.has(parent.id)) return true;
      visited.add(parent.id);
      parent = resolvedParents.get(parent.id);
    }
    return false;
  };

  const roots: ReviewNode[] = [];
  nodesById.forEach((node) => {
    const parent = resolvedParents.get(node.id);
    if (!parent || createsCycle(node)) {
      roots.push(node);
      return;
    }
    parent.replies.push(node);
  });

  const sortReplies = (node: ReviewNode) => {
    node.replies.sort((left, right) => compareDates(left, right, 1));
    node.replies.forEach(sortReplies);
  };
  roots.sort((left, right) => compareDates(left, right, -1));
  roots.forEach(sortReplies);

  return roots;
}
