export type CommunityHandleSource = {
  databaseId: number;
  communityHandle?: string | null;
  nicename?: string | null;
};

export type CommunityProfileCandidate = {
  databaseId: number;
  handle: string;
  isPublic: boolean;
};

export type CommunityRelationshipState = "none" | "pending" | "accepted" | "owner";

export type CommunityArticleMember = {
  databaseId: number;
  handle: string;
};

export type CommunityArticlePost = {
  authorDatabaseId?: number;
  author: { slug?: string };
};

export function normalizeCommunityHandle(value: string | null | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value).trim().replace(/^@/, "").normalize("NFC").toLocaleLowerCase("en-US");
  } catch {
    return "";
  }
}

export function communityHandleFromUser(user: CommunityHandleSource): string {
  return normalizeCommunityHandle(user.communityHandle || user.nicename) || `member-${user.databaseId}`;
}

export function communityHandlesMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const normalizedLeft = normalizeCommunityHandle(left);
  return Boolean(normalizedLeft) && normalizedLeft === normalizeCommunityHandle(right);
}

export function isCommunityArticlePost(
  post: CommunityArticlePost,
  members: CommunityArticleMember[],
): boolean {
  if (post.authorDatabaseId !== undefined) {
    return members.some(({ databaseId }) => databaseId === post.authorDatabaseId);
  }
  return members.some(({ handle }) => communityHandlesMatch(handle, post.author.slug));
}

export function resolvePublicCommunityMember<T extends CommunityProfileCandidate>(
  members: T[],
  routeHandle: string,
  viewer: CommunityProfileCandidate | null,
  profilesPublicEnabled: boolean,
): T | null {
  const member = members.find(({ handle }) => communityHandlesMatch(handle, routeHandle));
  if (!member) return null;
  const isViewer = Boolean(viewer && viewer.databaseId === member.databaseId);
  if ((!profilesPublicEnabled || !member.isPublic) && !isViewer) return null;
  return member;
}

export function normalizeCommunityRelationshipState(value: string | null | undefined): CommunityRelationshipState {
  return value === "pending" || value === "accepted" || value === "owner" ? value : "none";
}

export function canAccessCommunityProfile(isPublic: boolean, relationshipState: CommunityRelationshipState): boolean {
  return isPublic || relationshipState === "accepted" || relationshipState === "owner";
}

export function communityFollowActionLabel(relationshipState: CommunityRelationshipState): string {
  if (relationshipState === "pending") return "Requested";
  if (relationshipState === "accepted") return "Following";
  return "Follow";
}
