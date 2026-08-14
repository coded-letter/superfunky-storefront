import assert from "node:assert/strict";
import test from "node:test";
import { accountTabFromHash, accountTabLocation, configuredAccountTabs } from "./accountNavigation.ts";

test("resolves every supported account hash section", () => {
  assert.equal(accountTabFromHash("#dashboard"), "dashboard");
  assert.equal(accountTabFromHash("#orders"), "orders");
  assert.equal(accountTabFromHash("#downloads"), "downloads");
  assert.equal(accountTabFromHash("#addresses"), "addresses");
  assert.equal(accountTabFromHash("#community"), "community");
  assert.equal(accountTabFromHash("#unknown"), null);
});

test("keeps account hash navigation on the page containing the shortcode", () => {
  assert.deepEqual(
    accountTabLocation({ pathname: "/customer-hub/", search: "?source=email" }, "orders"),
    {
      pathname: "/customer-hub/",
      search: "?source=email",
      hash: "#orders",
    },
  );
});

test("upgrades only the legacy account tab defaults to include downloads", () => {
  assert.deepEqual(
    configuredAccountTabs("dashboard,orders,addresses,community"),
    ["dashboard", "orders", "downloads", "addresses", "community"],
  );
  assert.deepEqual(configuredAccountTabs("dashboard,orders"), ["dashboard", "orders"]);
});
