import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";

const profilePageSource = readFileSync(
  fileURLToPath(new URL("../pages/CommunityProfileMockupPage.tsx", import.meta.url)),
  "utf8",
);

test("community profile page wires the like mutation into both of its SocialFeedGrid usages", () => {
  // Previously the "posts from followed profiles" grid and the "user's own posts"
  // grid on a member profile page rendered a heart with post.likes as static text
  // with no click handler, so liking never worked from a profile page either.
  assert.match(profilePageSource, /toggleCommunityPostLike,\s*\n\s*unfollowCommunityProfile,/);

  const onToggleLikeMatches = profilePageSource.match(/onToggleLike=\{\(post\) => toggleCommunityPostLike\(Number\(post\.id\)\)\}/g) || [];
  assert.equal(
    onToggleLikeMatches.length,
    2,
    "expected both the followed-profiles feed and the own-posts feed to wire onToggleLike",
  );
});
