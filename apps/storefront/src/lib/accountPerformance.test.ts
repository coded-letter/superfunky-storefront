import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const accountSource = readFileSync(new URL("./account.ts", import.meta.url), "utf8");
const accountPageSource = readFileSync(new URL("../pages/AccountMockupPage.tsx", import.meta.url), "utf8");

test("the initial account profile query excludes expensive order history", () => {
  const profileFields = accountSource.match(/const ACCOUNT_PROFILE_FIELDS = [\s\S]*?`;/);
  assert.ok(profileFields, "account profile fields should exist");
  assert.doesNotMatch(profileFields[0], /\borders\s*\{/);
  assert.match(accountSource, /query StorefrontAccountOrders/);
});

test("account profile requests are cached and order history loads only for order-backed tabs", () => {
  assert.match(accountSource, /cachedAccount\?\.token === token/);
  assert.match(accountSource, /cachedOrders\?\.token === token/);
  assert.match(accountSource, /accountRequest\?\.token === token/);
  assert.match(accountPageSource, /activeTab === "orders" \|\| activeTab === "downloads"/);
  assert.match(accountPageSource, /getStorefrontAccountOrders\(\)/);
  assert.match(accountPageSource, /shouldLoadAccount = activeTab !== "community"/);
  assert.match(accountPageSource, /account\?\.displayName \|\| authUser\?\.displayName/);
});
