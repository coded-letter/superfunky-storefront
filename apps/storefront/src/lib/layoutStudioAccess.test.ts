import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Layout Studio must be gated on the SERVER-BACKED authenticated viewer's WordPress
// `manage_options` capability (from `useCommunityData()`, backed by a GraphQL query
// against the authenticated session) for BOTH:
//   1. the route itself (direct navigation to /layout-studio), and
//   2. the nav-link visibility (Account → Storefront controls),
// and never via local/client-only state, a query param, or "security through
// obscurity" (an unlinked-but-reachable route). This test asserts those invariants
// by inspecting the actual gating source, rather than re-implementing the gate.

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const accountPageSource = readFileSync(new URL("../pages/AccountMockupPage.tsx", import.meta.url), "utf8");

test("the /layout-studio route is registered and wrapped in AdminCapabilityRoute", () => {
  assert.match(
    appSource,
    /<Route\s+path="\/layout-studio"\s+element=\{<AdminCapabilityRoute>\s*<LayoutStudioMockupPage\s*\/>\s*<\/AdminCapabilityRoute>\}\s*\/>/,
  );
});

test("AdminCapabilityRoute checks the server-backed viewer.capabilities for manage_options, not local/client-only state", () => {
  const match = appSource.match(/function AdminCapabilityRoute\([\s\S]*?\n\}/);
  assert.ok(match, "AdminCapabilityRoute function not found in App.tsx");
  const body = match[0];

  // Sources its admin signal from the authenticated community/viewer query.
  assert.match(body, /useCommunityData\(\)/);
  assert.match(body, /viewer\??\.capabilities\.includes\("manage_options"\)/);

  // Must not fall back to any client-only/local signal (localStorage, a URL/query
  // param, a cookie read directly in JS, or a hardcoded allow-list) to decide access.
  assert.doesNotMatch(body, /localStorage|sessionStorage|searchParams|document\.cookie/);

  // Handles the loading state explicitly rather than defaulting to "allow".
  assert.match(body, /isViewerLoading/);

  // Non-admins (including the loading-resolved-to-null and anonymous-viewer cases)
  // must resolve to the standard not-found surface, not an error, blank page, or the
  // Studio itself.
  assert.match(body, /return <NotFoundMockupPage \/>/);
});

test("AdminCapabilityRoute renders its guarded children only after the capability check passes", () => {
  const match = appSource.match(/function AdminCapabilityRoute\([\s\S]*?\n\}/);
  assert.ok(match);
  const body = match[0];
  // The final statement returns the gated `children`, i.e. the Studio page is only
  // reachable once both the loading- and non-admin-guard clauses have returned early.
  assert.match(body, /return children;\s*\}\s*$/);
});

test("the language-independent route normalizer still recognizes layout-studio (no redirect loop for admins)", () => {
  assert.match(appSource, /\[["']shortcodes["'],\s*["']layout-studio["']\]/);
});

test("AccountMockupPage only renders the Layout Studio nav link for viewers with manage_options", () => {
  assert.match(accountPageSource, /useCommunityData\(\)/);
  assert.match(
    accountPageSource,
    /canManageLayouts\s*=\s*viewer\?\.capabilities\.includes\("manage_options"\)\s*\?\?\s*false/,
  );

  // The /layout-studio AccountControlLink must be conditionally rendered on
  // canManageLayouts, not unconditionally present in the markup.
  const linkIndex = accountPageSource.indexOf('to="/layout-studio"');
  assert.ok(linkIndex > -1, "expected an AccountControlLink pointing to /layout-studio");
  const precedingSlice = accountPageSource.slice(Math.max(0, linkIndex - 400), linkIndex);
  assert.match(precedingSlice, /canManageLayouts\s*\?/);
});

test("AccountMockupPage does not gate the Layout Studio link on any local/client-only signal", () => {
  const linkIndex = accountPageSource.indexOf('to="/layout-studio"');
  const surroundingSlice = accountPageSource.slice(Math.max(0, linkIndex - 400), linkIndex + 200);
  assert.doesNotMatch(surroundingSlice, /localStorage|sessionStorage/);
});
