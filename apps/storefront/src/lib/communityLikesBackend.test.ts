import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const communityBackendSource = readFileSync(
  new URL("../../../../../backend/wordpress/themes/free/funkycommerce-headless/inc/community.php", import.meta.url),
  "utf8",
);

test("community likes initialize legacy counters before applying the atomic delta", () => {
  const mutation = communityBackendSource.match(
    /register_graphql_mutation\(\s*'toggleCommunityPostLike',[\s\S]*?\n\t\);/,
  )?.[0] || "";

  assert.match(mutation, /metadata_exists\( 'post', \$post_id, '_community_likes' \)/);
  assert.match(mutation, /add_post_meta\( \$post_id, '_community_likes', 0, true \)/);
  assert.match(
    mutation,
    /UPDATE \{\$wpdb->postmeta\} SET meta_value = GREATEST\(0, CAST\(meta_value AS SIGNED\) \+ %d\)/,
  );
});

test("community likes restore viewer metadata when the counter update fails", () => {
  const mutation = communityBackendSource.match(
    /register_graphql_mutation\(\s*'toggleCommunityPostLike',[\s\S]*?\n\t\);/,
  )?.[0] || "";

  assert.match(mutation, /\$previous_liked = \$liked/);
  assert.match(mutation, /false === \$updated/);
  assert.match(
    mutation,
    /update_user_meta\( \$user_id, '_community_liked_posts', \$previous_liked \)/,
  );
  assert.match(mutation, /The community like could not be saved/);
});
