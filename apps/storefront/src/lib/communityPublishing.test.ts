import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const themeRoot = new URL(
  "../../../../../backend/wordpress/themes/free/funkycommerce-headless/",
  import.meta.url,
);
const backendSource = readFileSync(new URL("inc/community.php", themeRoot), "utf8");
const headlessLoginSource = readFileSync(new URL("inc/headless-login.php", themeRoot), "utf8");
const nativeShortcodesSource = readFileSync(new URL("inc/native-shortcodes.php", themeRoot), "utf8");
const themeFunctionsSource = readFileSync(new URL("functions.php", themeRoot), "utf8");
const themeStyleSource = readFileSync(new URL("style.css", themeRoot), "utf8");
const themeReadmeSource = readFileSync(new URL("readme.txt", themeRoot), "utf8");
const themePackage = JSON.parse(readFileSync(new URL("package.json", themeRoot), "utf8")) as { version: string };
const communitySource = readFileSync(new URL("community.ts", import.meta.url), "utf8");
const communityDataSource = readFileSync(new URL("../state/communityData.tsx", import.meta.url), "utf8");
const detailSource = readFileSync(new URL("../pages/CommunityPostMockupPage.tsx", import.meta.url), "utf8");
const modalSource = readFileSync(
  new URL("../../../../packages/ui/src/social/UploadPostModal.tsx", import.meta.url),
  "utf8",
);
const gallerySource = readFileSync(
  new URL("../../../../packages/ui/src/social/CommunityMediaGallery.tsx", import.meta.url),
  "utf8",
);
const socialPostCardSource = readFileSync(
  new URL("../../../../packages/ui/src/social/SocialPostCard.tsx", import.meta.url),
  "utf8",
);
const articleModalSource = readFileSync(
  new URL("../../../../packages/ui/src/social/WriteArticleModal.tsx", import.meta.url),
  "utf8",
);
const commentThreadSource = readFileSync(new URL("../pages/CommentThread.tsx", import.meta.url), "utf8");

test("community publishing validates ordered image and MP4 media on the backend", () => {
  assert.match(backendSource, /community_upload_enabled/);
  assert.match(backendSource, /community_upload_max_mb/);
  assert.match(backendSource, /community_upload_types/);
  assert.match(backendSource, /count\( \$media_inputs \) < 1 \|\| count\( \$media_inputs \) > 5/);
  assert.match(backendSource, /getimagesizefromstring\( \$binary \)/);
  assert.match(backendSource, /'ftyp' !== substr\( \$binary, 4, 4 \)/);
  assert.match(
    backendSource,
    /if \( 'video\/mp4' === \$mime \) \{\s+require_once ABSPATH \. 'wp-admin\/includes\/media\.php';/,
  );
  assert.match(
    backendSource,
    /catch \( \\Throwable \$error \) \{\s+wp_delete_attachment\( \$attachment_id, true \);\s+throw new \\GraphQL\\Error\\UserError\( __\( 'The community media file could not be processed\.'/,
  );
  assert.match(backendSource, /_community_media_owner_post_id/);
  assert.match(backendSource, /before_delete_post/);
});

test("community publishing exposes rich fields and owner-managed mutations", () => {
  assert.match(backendSource, /FunkycommerceCommunityMediaInput/);
  assert.match(backendSource, /'description'/);
  assert.match(backendSource, /'media'/);
  assert.match(backendSource, /'canEdit'/);
  assert.match(backendSource, /'updateStorefrontCommunityPost'/);
  assert.match(backendSource, /'deleteStorefrontCommunityPost'/);
  assert.doesNotMatch(backendSource, /register_graphql_mutation\(\s*'updateCommunityPost'/);
  assert.doesNotMatch(backendSource, /register_graphql_mutation\(\s*'deleteCommunityPost'/);
  assert.match(backendSource, /Legacy clients can continue sending caption plus one image/);
  assert.match(communitySource, /media: \[FunkycommerceCommunityMediaInput\]/);
  assert.match(communitySource, /export async function updateCommunityPost/);
  assert.match(communitySource, /export async function deleteCommunityPost/);
  assert.match(communitySource, /updateStorefrontCommunityPost\(input:/);
  assert.match(communitySource, /deleteStorefrontCommunityPost\(input:/);
});

test("community MP4 media is visible in native feeds and WordPress admin", () => {
  assert.match(nativeShortcodesSource, /function funkycommerce_native_community_card_media/);
  assert.match(nativeShortcodesSource, /funkycommerce_community_media_ids\( \$post_id \)/);
  assert.match(nativeShortcodesSource, /<video autoplay loop muted playsinline preload="metadata"/);
  assert.match(nativeShortcodesSource, /object-fit:cover;object-position:center/);
  assert.match(nativeShortcodesSource, /\$media\s+= funkycommerce_native_community_card_media\( \$post_id \)/);
  assert.match(backendSource, /add_meta_boxes_community_post/);
  assert.match(backendSource, /funkycommerce-community-media/);
  assert.match(backendSource, /manage_community_post_posts_columns/);
  assert.match(backendSource, /manage_community_post_posts_custom_column/);
  assert.match(backendSource, /funkycommerce_community_admin_media_preview/);
});

test("headless community feeds invalidate legacy media caches", () => {
  const fullQuery = communitySource.match(/const COMMUNITY_QUERY[\s\S]*?`;/)?.[0] || "";
  const feedQuery = communitySource.match(/const COMMUNITY_FEED_QUERY[\s\S]*?`;/)?.[0] || "";
  assert.match(communityDataSource, /"feed:v1" : "v10"/);
  assert.match(communityDataSource, /getCommunityFeedData/);
  assert.match(communityDataSource, /feedOnly/);
  assert.match(communitySource, /query StorefrontCommunityFeed/);
  assert.match(communitySource, /communityPosts\(first: 100\)/);
  assert.match(communitySource, /commentCount/);
  assert.match(fullQuery, /likedByViewer[\s\S]*?canEdit[\s\S]*?canDelete/);
  assert.doesNotMatch(feedQuery, /likedByViewer|canEdit|canDelete/);
  assert.match(communitySource, /getCommunityFeedData[\s\S]*?communityGraphqlRequest<CommunityFeedQueryResult>\([\s\S]*?COMMUNITY_FEED_QUERY,[\s\S]*?\)/);
  assert.match(communitySource, /backendLanguageCode \|\| languageCode\)\.slice\(0, 12\)/);
});

test("community data remains available without optional marketplace GraphQL fields", () => {
  assert.match(
    communitySource,
    /if \(errors\?\.length\) \{[\s\S]*?getCommunityFeedData\(languageCode, backendLanguageCode\)/,
  );
  assert.match(communitySource, /members: Array\.from\(members\.values\(\)\)/);
  assert.match(communitySource, /The compatible community feed also failed/);
  assert.match(
    communitySource,
    /getCommunityArchiveData[\s\S]*?getCommunityMembers\(auth\?\.authToken\)[\s\S]*?members\.push\(eligibleAuthor\)/,
  );
});

test("community posts tolerate backends without optional localization fields", () => {
  assert.match(communitySource, /function withoutCommunityLocalizationFields/);
  assert.match(communitySource, /replace\(\/\\\(\\s\*\\\$language:\\s\*LanguageCodeFilterEnum/);
  assert.match(communitySource, /replace\(\/\\\$language:\\s\*LanguageCodeFilterEnum/);
  assert.match(communitySource, /replace\(\/,\\s\*where:\\s\*\\\{\\s\*language:\\s\*\\\$language/);
  assert.match(
    communitySource,
    /removeGraphqlFieldSelections\(\s*removeGraphqlFieldSelections\(withoutLocalizationArguments, "translations"\),\s*"language"/,
  );
  assert.match(communitySource, /Cannot query field "\(\?:srcSet\|sizes\)" on type "FunkycommerceCommunityMedia"/);
  assert.match(communitySource, /removeGraphqlFieldSelections\(compatibleQuery, "srcSet"\)/);
  assert.match(communitySource, /Cannot query field "\(\?:language\|translations\)" on type/);
  assert.match(communitySource, /Unknown type "LanguageCodeFilterEnum"/);
  assert.match(
    communitySource,
    /hasOptionalLocalization && message === "Internal server error"/,
  );
  assert.match(
    communitySource,
    /getCommunityProfile[\s\S]*?communityGraphqlRequest[\s\S]*?COMMUNITY_PROFILE_QUERY/,
  );
  assert.match(
    communitySource,
    /getCommunityPostByDatabaseId[\s\S]*?communityGraphqlRequest[\s\S]*?COMMUNITY_POST_QUERY/,
  );
  assert.match(
    communitySource,
    /getCommunityPostByUri[\s\S]*?communityGraphqlRequest[\s\S]*?COMMUNITY_POST_BY_SLUG_QUERY/,
  );
  assert.match(
    communitySource,
    /getCommunityFeedData[\s\S]*?communityGraphqlRequest<CommunityFeedQueryResult>/,
  );
  assert.match(
    communitySource,
    /getCommunityData[\s\S]*?communityGraphqlRequest<CommunityQueryResult>/,
  );
  assert.doesNotMatch(communitySource, /communityPosts\([^)]*status:\s*PUBLISH/);
});

test("authenticated controls use an explicit server-backed capability allowlist", () => {
  for (const capability of [
    "manage_options",
    "publish_community_posts",
    "publish_marketplace_products",
    "publish_collaborator_posts",
  ]) {
    assert.match(headlessLoginSource, new RegExp(`'${capability}'`));
  }
  assert.match(headlessLoginSource, /'storefrontCapabilities'/);
  assert.match(headlessLoginSource, /\$viewer_id !== \$user_id/);
  assert.match(
    headlessLoginSource,
    /user_can\( \$viewer_id, 'manage_options' \)[\s\S]*?return \$capabilities/,
  );
  assert.match(headlessLoginSource, /user_can\( \$viewer_id, \$capability \)/);
  assert.match(communitySource, /storefrontCapabilities/);
  assert.match(communitySource, /LEGACY_VIEWER_QUERY/);
  assert.match(communityDataSource, /community-viewer:v4/);
});

test("community posts and collaborator articles support translation-safe editing", () => {
  assert.match(backendSource, /\$source->post_type !== \$target->post_type/);
  assert.match(backendSource, /'translationOfId'\s*=> array\( 'type' => 'Int' \)/);
  assert.match(communitySource, /searchTranslationCandidateCommunityPosts/);
  assert.match(modalSource, /Translation of/);
  assert.match(backendSource, /'deleteCollaboratorPost'/);
  assert.match(articleModalSource, /imageDataUrl/);
  assert.match(articleModalSource, /onDelete/);
});

test("authenticated discussion forms retain stored identity autofill", () => {
  assert.match(commentThreadSource, /authStore\.load\(\)\?\.user/);
  assert.match(commentThreadSource, /useState\(identity\.author\)/);
  assert.match(commentThreadSource, /useState\(identity\.email\)/);
});

test("community comments remain independent from standalone engagement ratings", () => {
  assert.match(detailSource, /showRatingField=\{false\}/);
  assert.doesNotMatch(
    themeFunctionsSource,
    /'community_post' === \$post->post_type && ! is_user_logged_in\(\)/,
  );
  assert.match(
    themeFunctionsSource,
    /0 === \$parent_id && 'product' === \$post->post_type && \( \$rating < 1 \|\| \$rating > 5 \)/,
  );
  assert.doesNotMatch(
    themeFunctionsSource,
    /in_array\( \$post->post_type, array\( 'product', 'community_post' \), true \) && \( \$rating < 1 \|\| \$rating > 5 \)/,
  );
});

test("marketplace editor query selects concrete-type fields only", () => {
  const query = communitySource.slice(
    communitySource.indexOf("const MARKETPLACE_PRODUCT_FOR_EDITING_QUERY"),
    communitySource.indexOf("type RawMarketplaceProductForEditing"),
  );
  const interfaceSelection = query.slice(0, query.indexOf("... on SimpleProduct"));
  assert.match(query, /\.\.\. on SimpleProduct[\s\S]*crossSell/);
  assert.match(query, /\.\.\. on VariableProduct[\s\S]*crossSell/);
  assert.doesNotMatch(interfaceSelection, /crossSell/);
  assert.doesNotMatch(query, /\.\.\. on VariableProduct \{[\s\S]*?\n        downloadable\n/);
  assert.match(query, /variations\(first: 100\)[\s\S]*downloadable[\s\S]*downloads/);
});

test("community editor and detail gallery support mixed media editing", () => {
  assert.match(modalSource, /const MAX_MEDIA_COUNT = 5/);
  assert.match(modalSource, /multiple accept="image\/jpeg,image\/png,image\/gif,image\/webp,video\/mp4"/);
  assert.match(modalSource, /initialValues\?: UploadPostInitialValues/);
  assert.match(modalSource, /Move media \$\{index \+ 1\} earlier/);
  assert.match(gallerySource, /mediaType === "video"/);
  assert.match(gallerySource, /controls=\{variant === "detail"\}/);
  assert.match(gallerySource, /preload="none"/);
  assert.match(gallerySource, /new IntersectionObserver/);
  assert.match(gallerySource, /intersectionRatio >= 0\.6/);
  assert.match(gallerySource, /video\.play\(\)/);
  assert.match(gallerySource, /video\.pause\(\)/);
  assert.match(gallerySource, /canvas\.toDataURL\("image\/jpeg", 0\.76\)/);
  assert.match(gallerySource, /poster=\{activeMedia\.posterUrl \|\| generatedPoster\}/);
  assert.match(gallerySource, /width=\{activeMedia\.width\}/);
  assert.match(gallerySource, /height=\{activeMedia\.height\}/);
  assert.doesNotMatch(gallerySource, /autoPlay=|loop=/);
  assert.match(gallerySource, /<source src=\{activeMedia\.url\} type=\{activeMedia\.mimeType\}/);
  assert.match(gallerySource, /srcSet=\{activeMedia\.srcSet\}/);
  assert.match(communitySource, /media \{[\s\S]*srcSet[\s\S]*sizes/);
  assert.match(communitySource, /srcSet: item\.srcSet \|\| undefined/);
  assert.match(backendSource, /wp_get_attachment_image_srcset\( \$attachment_id, 'large' \)/);
  assert.match(backendSource, /wp_get_attachment_image_sizes\( \$attachment_id, 'large' \)/);
  assert.match(gallerySource, /variant === "feed" \? "object-cover" : "object-contain"/);
  assert.match(gallerySource, /object-center/);
  assert.match(socialPostCardSource, /closest\("a, button, input, textarea, select"\)/);
  assert.match(socialPostCardSource, /<article/);
  assert.doesNotMatch(socialPostCardSource, /role: "button"|role: "link"/);
  assert.match(socialPostCardSource, /media=\{feedMedia\}/);
  assert.match(socialPostCardSource, /posterUrl: post\.image/);
  assert.doesNotMatch(socialPostCardSource, /closest\("a, button, video/);
  assert.match(gallerySource, /aria-pressed=\{index === activeIndex\}/);
  assert.match(detailSource, /directPost\?\.post\.canEdit/);
  assert.match(detailSource, /isEditOpen && directPost/);
  assert.match(detailSource, /community-post:v6/);
  assert.match(detailSource, /languageCode: directPost\.languageCode \|\| languageCode/);
  assert.match(detailSource, /translationOfId: directPost\.translations\?\.\[0\]\?\.databaseId/);
  assert.match(communitySource, /\(rawPost\.translations \|\| \[\]\)\.flatMap/);
  assert.doesNotMatch(detailSource, /wordpressPost\.languageCode/);
  assert.doesNotMatch(detailSource, /wordpressPost\.translations/);
  assert.match(detailSource, /window\.confirm/);
  assert.match(detailSource, /<CommunityMediaGallery/);
});

test("community editor receives the complete ordered backend media shape", () => {
  assert.match(communitySource, /export function communityPostMediaForEditor/);
  assert.match(communitySource, /return media\.map\(\(item\) => \(\{/);
  assert.match(detailSource, /media: communityPostMediaForEditor\(directPost\.post\.media\)/);
  assert.match(communitySource, /const media: SocialPostMedia\[\] = \(post\.media \|\| \[\]\)\.flatMap/);
});

test("translated community posts reuse extra media without duplicating uploads", () => {
  assert.match(backendSource, /function funkycommerce_community_translation_ids/);
  assert.match(backendSource, /function funkycommerce_resolved_community_media_ids/);
  assert.match(backendSource, /\$index < \$explicit_count/);
  assert.match(backendSource, /in_array\( \$attachment_id, \$slots, true \)/);
  assert.match(
    backendSource,
    /funkycommerce_community_media_item',\s+funkycommerce_resolved_community_media_ids\( funkycommerce_community_source_id\( \$post \) \)/,
  );
  assert.match(backendSource, /\$old_resolved_ids\s+= funkycommerce_resolved_community_media_ids\( \$post_id \)/);
  assert.match(backendSource, /\$media_ids_to_save = \$media\['ids'\] === \$old_resolved_ids \? \$old_media_ids : \$media\['ids'\]/);
  assert.match(backendSource, /funkycommerce_resolve_community_media_inputs\([\s\S]*?\$old_resolved_ids/);
  assert.match(backendSource, /funkycommerce_save_community_media\( \$post_id, \$media_ids_to_save \)/);
  assert.match(backendSource, /function funkycommerce_delete_or_transfer_community_media/);
  assert.match(backendSource, /_community_media_owner_post_id', \$next_owner_id/);
  assert.match(backendSource, /funkycommerce_delete_or_transfer_community_media\( \$removed_id, \$post_id \)/);
});

test("the corrected theme release uses one consistent version", () => {
  const version = themePackage.version.replaceAll(".", "\\.");
  assert.match(themeFunctionsSource, new RegExp(`FUNKYCOMMERCE_HEADLESS_VERSION', '${version}'`));
  assert.match(themeStyleSource, new RegExp(`^Version: ${version}$`, "m"));
  assert.match(themeReadmeSource, new RegExp(`^Stable tag: ${version}$`, "m"));
});
