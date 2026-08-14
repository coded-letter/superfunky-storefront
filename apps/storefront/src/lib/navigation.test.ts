import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, test } from "node:test";
import { JSDOM } from "jsdom";
import {
  mapBestAvailableMenu,
  scoreMenu,
} from "./navigation.ts";
import {
  mapFooterColumns,
  mapMenuItems,
  type RawMenuItem,
} from "./menuMapping.ts";
import { sanitizeStorefrontHtml } from "../../../../packages/ui/src/layout/sanitizeStorefrontHtml.ts";

const navigationSource = readFileSync(new URL("navigation.ts", import.meta.url), "utf8");

let dom: JSDOM;

before(() => {
  dom = new JSDOM("<main></main>", {
    url: "https://example.test/",
    pretendToBeVisual: true,
  });
  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    DOMParser: dom.window.DOMParser,
  });
});

after(() => dom.window.close());

test("navigation compatibility fallback is explicit for minimal backends without WPGraphQL plugin fields", () => {
  assert.match(navigationSource, /const COMPATIBLE_NAVIGATION_QUERY/);
  assert.match(navigationSource, /const COMPATIBLE_BRANDING_QUERY/);
  assert.match(navigationSource, /hasOnlyKnownNavigationResolverErrors\(errors\)/);
  assert.match(navigationSource, /function isNavigationCompatibilityError\(/);
  assert.match(navigationSource, /extensions\?: \{ debugMessage\?: string \}/);
  assert.match(navigationSource, /"funkycommerceStorefrontConfig"/);
  assert.match(navigationSource, /"menus"/);
  assert.match(navigationSource, /"locations"/);
  assert.match(navigationSource, /"promoHtml"/);
  assert.match(navigationSource, /"headerIconMedia"/);
  assert.match(navigationSource, /"aiAssistant"/);
  assert.doesNotMatch(navigationSource, /query StorefrontNavigationCompatible \{\s*menus\(first: 100\) \{\s*nodes \{\s*id\s*databaseId\s*name\s*slug\s*locations/);
  assert.match(navigationSource, /return \[];\n\s*\}/);
});

test("prefers header menu names even when the minimal schema drops menu location metadata", () => {
  const menus = [
    {
      id: "footer-id",
      databaseId: 2,
      name: "Footer Menu",
      slug: "footer",
      locations: null,
      menuItems: { nodes: [{
        id: "footer-item",
        databaseId: 21,
        parentDatabaseId: null,
        order: 1,
        label: "Support",
        title: null,
        description: null,
        path: "/support/",
        uri: null,
        url: null,
        target: null,
        cssClasses: null,
        linkRelationship: null,
        locations: null,
      }] },
    },
    {
      id: "header-id",
      databaseId: 1,
      name: "Primary Header Menu",
      slug: "header",
      locations: null,
      menuItems: { nodes: [{
        id: "header-item",
        databaseId: 11,
        parentDatabaseId: null,
        order: 1,
        label: "Shop",
        title: null,
        description: null,
        path: "/shop/",
        uri: null,
        url: null,
        target: null,
        cssClasses: null,
        linkRelationship: null,
        locations: null,
      }] },
    },
  ] as any;

  const headerScore = scoreMenu(menus[1], ["HEADER"], "en");
  const footerScore = scoreMenu(menus[0], ["HEADER"], "en");
  assert.ok(headerScore > footerScore);
  assert.equal(mapBestAvailableMenu(menus, "HEADER", "en")[0]?.label, "Shop");
});

test("falls back to the first available menu when the backend exposes no location metadata at all", () => {
  const menus = [
    {
      id: "menu-1",
      databaseId: 10,
      name: "Menu",
      slug: "menu",
      locations: null,
      menuItems: { nodes: [{
        id: "item-1",
        databaseId: 101,
        parentDatabaseId: null,
        order: 1,
        label: "Home",
        title: null,
        description: null,
        path: "/",
        uri: null,
        url: null,
        target: null,
        cssClasses: null,
        linkRelationship: null,
        locations: null,
      }] },
    },
    {
      id: "menu-2",
      databaseId: 11,
      name: "Menu",
      slug: "menu-2",
      locations: null,
      menuItems: { nodes: [{
        id: "item-2",
        databaseId: 112,
        parentDatabaseId: null,
        order: 1,
        label: "Blog",
        title: null,
        description: null,
        path: "/blog/",
        uri: null,
        url: null,
        target: null,
        cssClasses: null,
        linkRelationship: null,
        locations: null,
      }] },
    },
  ] as any;

  assert.equal(mapBestAvailableMenu(menus, "HEADER", "en")[0]?.label, "Home");
});

const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");

test("keeps the built-in storefront mock menu as fallback when the backend has no menus", () => {
  assert.match(appSource, /const headerNavigation = Array\.isArray\(data\?\.header\) && data\.header\.length \? data\.header : undefined;/);
  assert.match(appSource, /const footerColumns = Array\.isArray\(data\?\.footer\) && data\.footer\.length \? data\.footer : undefined;/);
});

function buildRawItem(
  overrides: Partial<RawMenuItem> & { databaseId: number },
): RawMenuItem {
  return {
    id: `item-${overrides.databaseId}`,
    databaseId: overrides.databaseId,
    parentDatabaseId: null,
    order: overrides.databaseId,
    label: `Item ${overrides.databaseId}`,
    title: null,
    description: null,
    path: `/item-${overrides.databaseId}/`,
    uri: null,
    url: null,
    target: null,
    cssClasses: null,
    linkRelationship: null,
    locations: null,
    ...overrides,
  };
}

const normalizeHref = (
  value: string | null,
  parentHref: string | undefined,
): string => {
  const href = value?.trim() || "#";
  if (!href.startsWith("#")) return href;
  const parentPath = parentHref?.split("#")[0];
  return parentPath && parentPath !== "#" ? `${parentPath}${href}` : href;
};

test("maps sanitized menu-item description HTML and CSS classes", () => {
  const [item] = mapMenuItems([
    buildRawItem({
      databaseId: 1,
      label: "Shop",
      description: "<strong>Great</strong> deals<a href=\"javascript:alert(1)\" onclick=\"bad()\">here</a>",
      cssClasses: [" mega-4 ", "expanded"],
    }),
  ], normalizeHref);

  assert.equal(
    item.description,
    "<strong>Great</strong> deals<a>here</a>",
  );
  assert.deepEqual(item.cssClasses, ["mega-4", "expanded"]);
});

test("omits the description field when the menu item has none", () => {
  const [item] = mapMenuItems([
    buildRawItem({ databaseId: 1, label: "Shop", description: null }),
  ], normalizeHref);

  assert.equal(item.description, undefined);
});

test("maps arbitrary menu depth and resolves nested hash links", () => {
  const [root] = mapMenuItems([
    buildRawItem({ databaseId: 1, label: "Root", path: "/root/" }),
    buildRawItem({ databaseId: 2, parentDatabaseId: 1, label: "Level 2" }),
    buildRawItem({ databaseId: 3, parentDatabaseId: 2, label: "Level 3" }),
    buildRawItem({ databaseId: 4, parentDatabaseId: 3, label: "Level 4", path: "#details" }),
    buildRawItem({ databaseId: 5, parentDatabaseId: 4, label: "Level 5" }),
    buildRawItem({ databaseId: 6, parentDatabaseId: 5, label: "Level 6" }),
  ], normalizeHref);

  const level4 = root.children?.[0].children?.[0].children?.[0];
  assert.equal(level4?.href, "/item-3/#details");
  assert.equal(
    level4?.children?.[0].children?.[0].label,
    "Level 6",
  );
});

test("carries descriptions, classes, and arbitrary descendants into footer links", () => {
  const columns = mapFooterColumns(
    mapMenuItems([
      buildRawItem({
        databaseId: 1,
        label: "Shop",
        description: "<em>Everything</em> for the store",
        cssClasses: ["expanded"],
      }),
      buildRawItem({
        databaseId: 2,
        parentDatabaseId: 1,
        label: "All products",
        description: "Browse the full catalog",
        cssClasses: ["expanded"],
      }),
      buildRawItem({
        databaseId: 3,
        parentDatabaseId: 2,
        label: "Collections",
      }),
      buildRawItem({
        databaseId: 4,
        parentDatabaseId: 3,
        label: "Summer",
      }),
    ], normalizeHref),
  );

  assert.equal(columns[0].description, "<em>Everything</em> for the store");
  assert.deepEqual(columns[0].cssClasses, ["expanded"]);
  assert.equal(columns[0].links[0].description, "Browse the full catalog");
  assert.deepEqual(columns[0].links[0].cssClasses, ["expanded"]);
  assert.equal(columns[0].links[0].children?.[0].children?.[0].label, "Summer");
});

test("does not duplicate a childless top-level description onto its single link", () => {
  const columns = mapFooterColumns(
    mapMenuItems([
      buildRawItem({
        databaseId: 1,
        label: "Contact",
        description: "Reach our team",
      }),
    ], normalizeHref),
  );

  assert.equal(columns[0].description, "Reach our team");
  assert.equal(columns[0].links.length, 1);
  assert.equal(columns[0].links[0].description, undefined);
});
test("sanitizes configured chrome HTML and normalizes safe links", () => {
  const html = sanitizeStorefrontHtml(`
    <p onclick="alert(1)"><strong>Offer</strong>
      <a href="https://example.test/deal" onmouseover="bad()">shop now</a>
      <a href="jav&#x61;script:alert(1)">unsafe</a>
    </p>
    <script>globalThis.compromised = true</script>
    <img src=x onerror="alert(1)">
  `);

  assert.equal(
    html,
    '<p><strong>Offer</strong>\n      <a href="https://example.test/deal" target="_blank" rel="noopener noreferrer">shop now</a>\n      <a>unsafe</a>\n    </p>',
  );
  assert.doesNotMatch(html, /script|onmouseover|onerror|javascript/i);
});

test("normalizeStorefrontLayoutConfiguration falls back to defaults for every field and defines a bounded schemaVersion", () => {
  assert.match(
    navigationSource,
    /const source = layout \|\| \{\};/,
    "the normalizer must treat a missing/null backend layout as an empty object so every field falls back to its default",
  );
  assert.match(navigationSource, /schemaVersion: pickBoundedInt\(source\.schemaVersion, 1, Number\.MAX_SAFE_INTEGER, defaults\.schemaVersion\)/);
});

test("normalizeStorefrontLayoutConfiguration strictly allowlists enum fields instead of passing raw backend strings through", () => {
  assert.match(
    navigationSource,
    /productPageLayout: pickEnum\(source\.productPageLayout, \["classic", "studio"\] as const, defaults\.productPageLayout\)/,
  );
  assert.match(
    navigationSource,
    /discussionLayout: pickEnum\(source\.discussionLayout, \["stacked", "split-left", "split-right"\] as const, defaults\.discussionLayout\)/,
  );
  assert.match(
    navigationSource,
    /postTocLayout: pickEnum\(source\.postTocLayout, \["current", "hidden", "above"\] as const, defaults\.postTocLayout\)/,
  );
  assert.match(
    navigationSource,
    /function pickEnum<T extends string>\(value: unknown, allowed: readonly T\[\], fallback: T\): T \{\s*return typeof value === "string" && \(allowed as readonly string\[\]\)\.includes\(value\) \? \(value as T\) : fallback;/,
  );
});

test("normalizeStorefrontLayoutConfiguration clamps numeric fields to their documented bounds", () => {
  assert.match(navigationSource, /themeMaxWidthPx: pickBoundedInt\(source\.themeMaxWidthPx, 960, 1920, defaults\.themeMaxWidthPx\)/);
  assert.match(navigationSource, /themeRadiusPx: pickBoundedInt\(source\.themeRadiusPx, 0, 32, defaults\.themeRadiusPx\)/);
  assert.match(
    navigationSource,
    /newsletterPopupCooldownDays: pickBoundedInt\(source\.newsletterPopupCooldownDays, 1, 365, defaults\.newsletterPopupCooldownDays\)/,
  );
  assert.match(
    navigationSource,
    /function pickBoundedInt\(value: unknown, min: number, max: number, fallback: number\): number \{[\s\S]*?return Math\.min\(max, Math\.max\(min, Math\.round\(parsed\)\)\);/,
  );
});

test("normalizeStorefrontLayoutConfiguration coerces every show* field through the strict boolean picker", () => {
  assert.match(navigationSource, /showBreadcrumbs: pickBoolean\(source\.showBreadcrumbs, defaults\.showBreadcrumbs\)/);
  assert.match(navigationSource, /showFooterPaymentVisa: pickBoolean\(source\.showFooterPaymentVisa, defaults\.showFooterPaymentVisa\)/);
  assert.match(
    navigationSource,
    /function pickBoolean\(value: unknown, fallback: boolean\): boolean \{\s*return typeof value === "boolean" \? value : fallback;/,
  );
});

test("mapLayoutToHiddenFooterKeys hides exactly the payment/social providers whose show-boolean is false", () => {
  assert.match(
    navigationSource,
    /hiddenFooterPaymentMethodKeys: PAYMENT_METHODS\s*\.map\(\(\{ key \}\) => key\)\s*\.filter\(\(key\) => paymentKeyToField\[key\] && layout\[paymentKeyToField\[key\]\] === false\)/,
  );
  assert.match(
    navigationSource,
    /hiddenFooterSocialLinkKeys: SOCIAL_LINKS\s*\.map\(\(\{ id \}\) => id\)\s*\.filter\(\(id\) => socialKeyToField\[id\] && layout\[socialKeyToField\[id\]\] === false\)/,
  );
  assert.match(navigationSource, /visa: "showFooterPaymentVisa"/);
  assert.match(navigationSource, /github: "showFooterSocialGithub"/);
});

test("the GraphQL navigation query requests the full backend layout selection and the query field count matches the type/defaults/normalizer", () => {
  const layoutBlock = navigationSource.match(/ {6}layout \{\n([\s\S]*?)\n {6}\}\n/);
  assert.ok(layoutBlock, "expected a `layout { ... }` selection inside the NAVIGATION_QUERY template literal");
  const queryFieldCount = (layoutBlock![1].match(/^\s*[a-zA-Z]+\s*$/gm) || []).length;

  const typeFieldCount = (
    navigationSource.match(/export type StorefrontLayoutConfiguration = \{([\s\S]*?)\n\};/)![1].match(/^\s*[a-zA-Z]+:/gm) || []
  ).length;
  const defaultsFieldCount = (
    navigationSource.match(/export const DEFAULT_STOREFRONT_LAYOUT_CONFIGURATION: StorefrontLayoutConfiguration = \{([\s\S]*?)\n\};/)![1]
      .match(/^\s*[a-zA-Z]+:/gm) || []
  ).length;

  assert.equal(queryFieldCount, typeFieldCount, "every StorefrontLayoutConfiguration field must be requested by the GraphQL query");
  assert.equal(defaultsFieldCount, typeFieldCount, "every StorefrontLayoutConfiguration field must have a deterministic default");
  assert.ok(queryFieldCount > 80, "expected the full ~92-field backend layout schema to be represented");
});
