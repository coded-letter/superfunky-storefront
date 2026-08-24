import assert from "node:assert/strict";
import test from "node:test";
import {
  canAccessCommunityProfile,
  communityFollowActionLabel,
  communityHandleFromUser,
  isCommunityArchiveAuthor,
  isCommunityArticlePost,
  normalizeCommunityHandle,
  normalizeCommunityRelationshipState,
  resolvePublicCommunityMember,
} from "./communityProfiles.ts";

test("community author directory includes public members who have published posts", () => {
  const publishedAuthorIds = new Set([3]);

  assert.equal(isCommunityArchiveAuthor({ databaseId: 3, role: "member" }, publishedAuthorIds), true);
  assert.equal(isCommunityArchiveAuthor({ databaseId: 4, role: "member" }, publishedAuthorIds), false);
  assert.equal(isCommunityArchiveAuthor({ databaseId: 5, role: "creator" }, new Set()), true);
  assert.equal(isCommunityArchiveAuthor({ databaseId: 6, role: "collaborator" }, new Set()), true);
});

const v1PublicMember = {
  databaseId: 3,
  name: "Jorgo Lazaridis",
  nicename: "jorgo-lazaridis",
  communityHandle: "jorgo-lazaridis",
  communityProfilePublic: true,
};

test("normalizes encoded and case-varied v1 community handles", () => {
  assert.equal(communityHandleFromUser(v1PublicMember), "jorgo-lazaridis");
  assert.equal(normalizeCommunityHandle("Jorgo%2DLazaridis"), "jorgo-lazaridis");
});

test("resolves the public v1 member without exposing private or globally disabled profiles", () => {
  const member = {
    databaseId: v1PublicMember.databaseId,
    handle: communityHandleFromUser(v1PublicMember),
    isPublic: v1PublicMember.communityProfilePublic,
  };
  assert.equal(resolvePublicCommunityMember([member], "JORGO-LAZARIDIS", null, true), member);
  assert.equal(resolvePublicCommunityMember([{ ...member, isPublic: false }], member.handle, null, true), null);
  assert.equal(resolvePublicCommunityMember([member], member.handle, null, false), null);
  assert.equal(resolvePublicCommunityMember([{ ...member, isPublic: false }], member.handle, member, true)?.databaseId, 3);
});

test("uses a legacy nicename when a backend omits communityHandle", () => {
  assert.equal(communityHandleFromUser({ databaseId: 3, communityHandle: null, nicename: "Jorgo-Lazaridis" }), "jorgo-lazaridis");
  assert.equal(normalizeCommunityHandle("%E0%A4%A"), "");
});

test("identifies community articles by stable user ID before legacy handles", () => {
  const members = [
    { databaseId: 3, handle: "public-handle", role: "collaborator" },
    { databaseId: 4, handle: "ordinary-member", role: "member" },
  ];

  assert.equal(
    isCommunityArticlePost({ authorDatabaseId: 3, author: { slug: "different-wordpress-slug" } }, members),
    true,
  );
  assert.equal(
    isCommunityArticlePost({ authorDatabaseId: 4, author: { slug: "public-handle" } }, members),
    true,
  );
  assert.equal(
    isCommunityArticlePost({ authorDatabaseId: 99, author: { slug: "public-handle" } }, members),
    false,
  );
  assert.equal(
    isCommunityArticlePost({ author: { slug: "PUBLIC-HANDLE" } }, members),
    true,
  );
});

test("maps relationship state into private-profile access and actions", () => {
  assert.equal(normalizeCommunityRelationshipState("pending"), "pending");
  assert.equal(normalizeCommunityRelationshipState("unexpected"), "none");
  assert.equal(canAccessCommunityProfile(false, "none"), false);
  assert.equal(canAccessCommunityProfile(false, "pending"), false);
  assert.equal(canAccessCommunityProfile(false, "accepted"), true);
  assert.equal(canAccessCommunityProfile(false, "owner"), true);
  assert.equal(canAccessCommunityProfile(true, "none"), true);
  assert.equal(communityFollowActionLabel("pending"), "Requested");
  assert.equal(communityFollowActionLabel("accepted"), "Following");
  assert.equal(communityFollowActionLabel("none"), "Follow");
});
