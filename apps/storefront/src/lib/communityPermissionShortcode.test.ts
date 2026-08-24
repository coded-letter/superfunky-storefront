import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const themeRoot = new URL(
  "../../../../../backend/wordpress/themes/free/funkycommerce-headless/",
  import.meta.url,
);
const schema = readFileSync(new URL("functions.php", themeRoot), "utf8");
const nativeShortcodes = readFileSync(new URL("inc/native-shortcodes.php", themeRoot), "utf8");
const communityBackend = readFileSync(new URL("inc/community.php", themeRoot), "utf8");
const storefrontShortcodes = readFileSync(
  new URL("../components/wordpressShortcodes.tsx", import.meta.url),
  "utf8",
);
const library = readFileSync(
  new URL("../pages/ShortcodeLibraryMockupPage.tsx", import.meta.url),
  "utf8",
);

test("community members use an exact comma-separated WordPress role whitelist", () => {
  assert.match(schema, /'role'\s*=>\s*array\(\s*'default'\s*=>\s*'all',\s*'type'\s*=>\s*'community-role-list'/);
  assert.match(schema, /function funkycommerce_community_role_filter_aliases/);
  assert.match(schema, /'administrator'\s*=>\s*'admin'/);
  assert.match(schema, /'seo-editor'\s*=>\s*'wpseo_editor'/);
  assert.match(schema, /wp_roles\(\)->roles/);
  assert.match(schema, /\$details\['name'\]/);
  assert.match(nativeShortcodes, /\$role_types = 'all' !== \$a\['role'\]/);
  assert.match(nativeShortcodes, /array_intersect\( \$role_types, \$types \)/);
  assert.match(storefrontShortcodes, /const requestedRoles = roles\.length \? roles : memberAliasRoles\.length \? memberAliasRoles : permissionRoles/);
  assert.match(storefrontShortcodes, /member\.memberTypes\.includes\(type\)/);
  assert.doesNotMatch(storefrontShortcodes, /member\.role === permission/);
  assert.match(library, /role: "member,creator"/);
  assert.match(library, /role \(comma-separated whitelist\)/);
});

test("community directories exclude roleless users and preserve legacy filter aliases", () => {
  assert.match(schema, /'members'\s*=>\s*array\(\s*'default'\s*=>\s*'',\s*'type'\s*=>\s*'community-role-list'/);
  assert.match(schema, /'permission'\s*=>\s*array\(\s*'default'\s*=>\s*'all',\s*'type'\s*=>\s*'community-role-list'/);
  assert.match(nativeShortcodes, /\$a\['members'\]/);
  assert.match(nativeShortcodes, /\$a\['permission'\]/);
  assert.match(nativeShortcodes, /funkycommerce_community_member_types\( \$user_id \)/);
  assert.match(communityBackend, /'communityMemberTypes'[\s\S]*'resolve'\s*=>\s*'funkycommerce_community_member_types'/);
  assert.match(communityBackend, /funkycommerce_is_community_profile_public\( \$user_id \)[\s\S]*funkycommerce_community_member_types\( \$user_id \)/);
  assert.doesNotMatch(communityBackend, /return \$types \?[\s\S]*array\( 'member' \)/);
  assert.match(storefrontShortcodes, /member\.memberTypes\.length > 0/);
  assert.match(library, /members \/ permission \(legacy aliases\)/);
});
