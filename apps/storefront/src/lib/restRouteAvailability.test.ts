import assert from "node:assert/strict";
import test from "node:test";
import { createRestRouteAvailability, restIndexHasRoute } from "./restRouteAvailability.ts";

test("REST route discovery checks registered methods and reuses the REST index", async () => {
  const requests: string[] = [];
  const availability = createRestRouteAvailability("https://cms.test", async (input) => {
    requests.push(String(input));
    return new Response(JSON.stringify({
      routes: {
        "/funkycommerce/v1/protected-page": {
          endpoints: [{ methods: ["GET", "POST"] }],
        },
      },
    }));
  });

  assert.equal(await availability.isAvailable("/funkycommerce/v1/protected-page", "GET"), true);
  assert.equal(await availability.isAvailable("/funkycommerce/v1/protected-page", "POST"), true);
  assert.equal(await availability.isAvailable("/funkycommerce/v1/abandoned-carts/config"), false);
  assert.equal(requests.length, 1);
  assert.equal(requests[0], "https://cms.test/wp-json/");
});

test("REST route discovery treats a missing or method-incompatible route as unavailable", () => {
  const index = {
    routes: {
      "/wc/store/v1/products": { endpoints: [{ methods: ["GET"] }] },
    },
  };

  assert.equal(restIndexHasRoute(index, "/wc/store/v1/products"), true);
  assert.equal(restIndexHasRoute(index, "/wc/store/v1/products", "POST"), false);
  assert.equal(restIndexHasRoute(index, "/funkycommerce/v1/protected-page"), false);
});
