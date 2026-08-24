import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const profileHeader = readFileSync(
  new URL("../../../../packages/ui/src/social/ProfileHeader.tsx", import.meta.url),
  "utf8",
);
const communityPage = readFileSync(
  new URL("../pages/CommunityProfileMockupPage.tsx", import.meta.url),
  "utf8",
);
const authorPage = readFileSync(new URL("../pages/AuthorMockupPage.tsx", import.meta.url), "utf8");
const authors = readFileSync(new URL("./authors.ts", import.meta.url), "utf8");
const account = readFileSync(new URL("./account.ts", import.meta.url), "utf8");
const incrementalData = readFileSync(
  new URL("../../../../packages/sdk/src/incrementalData.ts", import.meta.url),
  "utf8",
);

test("shared ProfileHeader implements all six backend-selected layout variants", () => {
  for (const variant of ["immersive", "cover-banner", "compact-list", "split", "strip"]) {
    assert.match(
      profileHeader,
      new RegExp(`layout === "${variant}"`),
      `missing dedicated branch for the "${variant}" layout`,
    );
  }
  // "card" is the implicit default fallthrough, not its own `layout === "card"` branch.
  assert.match(profileHeader, /export function ProfileHeader/);
  assert.match(profileHeader, /export type ProfileHeaderLayout =/);
});

test("community profile page and author page both reuse the single shared ProfileHeader", () => {
  for (const page of [communityPage, authorPage]) {
    assert.match(page, /import\s*\{[^}]*\bProfileHeader\b[^}]*\}\s*from\s*"@funky\/ui"/s);
    assert.match(page, /<ProfileHeader\b/);
  }
  // Neither page should still carry its own duplicated multi-variant header markup.
  assert.doesNotMatch(communityPage, /function avatarNode/);
  assert.doesNotMatch(communityPage, /type ProfileHeaderLayout =\s*"card"/);
});

test("community page reads communityProfileHeaderLayout and author page reads authorProfileHeaderLayout", () => {
  // Both pages source this field from the shared `LayoutPreferencesContext` (via
  // `useLayoutPreferences()`) rather than reading `navigationData.storefrontConfig.layout`
  // directly — this lets the admin-only Layout Studio live-preview the setting for the
  // current session, while `LayoutPreferencesBackendSync` still hydrates the context's
  // initial value from the canonical backend Control Center config on load.
  assert.match(communityPage, /communityProfileHeaderLayout[^;]*=\s*useLayoutPreferences\(\)/);
  assert.match(authorPage, /authorProfileHeaderLayout[^;]*=\s*useLayoutPreferences\(\)/);
  // The two backend controls stay separate — neither page should read the other's key.
  assert.doesNotMatch(communityPage, /authorProfileHeaderLayout/);
  assert.doesNotMatch(authorPage, /communityProfileHeaderLayout/);
});

test("author archive exposes coverUrl by reusing the existing communityCover field, not a new one", () => {
  assert.match(authors, /coverUrl:\s*string \| null/);
  assert.match(authors, /communityCover\s*\{\s*\n?\s*url\s*\}?/);
  assert.match(authors, /coverUrl:\s*data\.user\.communityCover\?\.url \|\| null/);
  // Guard against re-introducing a duplicate/new cover field name on the author query.
  assert.doesNotMatch(authors, /authorCover|coverAttachment|authorCoverUrl/);
});

test("profile covers never flash the avatar while authoritative cover data loads", () => {
  assert.doesNotMatch(communityPage, /coverUrl: undefined/);
  assert.doesNotMatch(profileHeader, /coverUrl \|\| avatarUrl/);
  assert.match(profileHeader, /\{coverUrl \? \(/);
});

test("avatar editing updates the account cache independently and invalidates profile media", () => {
  assert.match(account, /function applyUpdatedAvatar/);
  assert.match(account, /avatarUrl: avatar\.avatarUrl/);
  assert.match(account, /invalidateIncrementalDataPrefix\("community:"\)/);
  assert.match(account, /invalidateIncrementalDataPrefix\("community-post:v6:"\)/);
  assert.match(account, /invalidateIncrementalDataPrefix\("community-archive-data:v1:"\)/);
  assert.match(account, /invalidateIncrementalDataPrefix\("author:v2:"\)/);
  assert.match(account, /invalidateIncrementalDataPrefix\("blog-data:"\)/);
  assert.match(incrementalData, /entry\.cacheKey\.startsWith\("community:v10:"\)/);
  assert.match(incrementalData, /entry\.cacheKey\.startsWith\("author:v2:"\)/);
  assert.match(authorPage, /`author:v2:/);
});
