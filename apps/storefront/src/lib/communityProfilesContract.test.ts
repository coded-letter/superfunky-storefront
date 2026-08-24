import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const themeRoot = new URL(
  "../../../../../backend/wordpress/themes/free/funkycommerce-headless/",
  import.meta.url,
);
const backend = readFileSync(new URL("inc/community.php", themeRoot), "utf8");
const client = readFileSync(new URL("community.ts", import.meta.url), "utf8");
const profilePage = readFileSync(new URL("../pages/CommunityProfileMockupPage.tsx", import.meta.url), "utf8");
const accountPage = readFileSync(new URL("../pages/AccountMockupPage.tsx", import.meta.url), "utf8");

test("profile covers are image-only, owner-marked, and safely replaced", () => {
  assert.match(backend, /_community_cover_attachment_id/);
  assert.match(backend, /_community_cover_owner_user_id/);
  assert.match(backend, /getimagesizefromstring\( \$binary \)/);
  assert.match(backend, /0 === strpos\( \$mime, 'image\/' \)/);
  assert.match(backend, /uploadCommunityProfileCover/);
  assert.match(backend, /removeCommunityProfileCover/);
  assert.match(backend, /funkycommerce_delete_owned_community_cover/);
  assert.match(client, /uploadCommunityProfileCover/);
  assert.match(accountPage, /Replace cover/);
});

test("public profiles resolve fresh header media before the full profile payload", () => {
  assert.match(client, /export async function getCommunityProfileMember/);
  assert.match(client, /query StorefrontCommunityProfileMember\(\$handle: String!\)/);
  assert.match(profilePage, /getCommunityProfileMember\(handle\)/);
  assert.match(profilePage, /!authoritativeMember && isProfileLoading/);
});

test("normalized social graph owns accepted and pending transitions", () => {
  assert.match(backend, /CREATE TABLE \{\$table_name\}/);
  assert.match(backend, /UNIQUE KEY follower_followed/);
  assert.match(backend, /_community_following/);
  assert.match(backend, /status = 'accepted'/);
  assert.match(backend, /status = 'pending'/);
  assert.match(backend, /funkycommerce_community_promote_pending_followers/);
  assert.match(backend, /funkycommerce_community_assert_rate_limit/);
  assert.match(backend, /funkycommerce_with_community_profile_lock/);
  assert.match(backend, /SELECT GET_LOCK/);
  assert.match(backend, /manageCommunityFollower/);
  assert.doesNotMatch(backend, /update_user_meta\( \$viewer_id, '_community_following'/);
});

test("access-aware profile contracts keep locked summaries but gate content", () => {
  assert.match(backend, /funkycommerce_can_access_community_profile/);
  assert.match(backend, /communityProfileByHandle/);
  assert.match(backend, /relationshipState/);
  assert.match(backend, /pendingFollowRequests/);
  assert.match(backend, /followingFeed/);
  assert.match(backend, /CommunityProfileConnection/);
  assert.match(
    backend,
    /'communityMembers'[\s\S]*?'resolve' => function \( \$root, \$args \) \{[\s\S]*?funkycommerce_visible_community_user_ids\(\)[\s\S]*?return \$users;\s*\},\s*\)\s*\);\s*register_graphql_field\(\s*'RootQuery',\s*'communityProfileByHandle'/,
  );
  assert.match(backend, /! funkycommerce_community_followers_enabled\(\) \|\| ! funkycommerce_can_access_community_profile/);
  assert.match(client, /getCommunityProfileConnection/);
  assert.match(client, /"pendingFollowRequests"/);
  assert.match(profilePage, /Request access to see/);
  assert.match(profilePage, /Posts from followed profiles/);
  assert.match(accountPage, /Pending requests/);
  assert.match(accountPage, /loadMoreFollowerDashboard/);
});

test("profile products are filtered and capped in database queries", () => {
  assert.match(backend, /function funkycommerce_get_seller_product_ids/);
  assert.match(backend, /'posts_per_page'\s*=>\s*\$limit/);
  assert.match(backend, /'author__in'\s*=>\s*\$seller_ids/);
  assert.match(backend, /'key'\s*=>\s*'_seller_user_id'[\s\S]*?'compare'\s*=>\s*'IN'/);
  assert.match(
    backend,
    /'CommunityMemberProfile',\s*'products'[\s\S]*?funkycommerce_get_seller_product_ids\( array\( \$user->ID \), 100 \)/,
  );
  assert.doesNotMatch(
    backend,
    /'CommunityMemberProfile',\s*'products'[\s\S]*?'posts_per_page'\s*=>\s*-1[\s\S]*?get_post_meta/,
  );
});
