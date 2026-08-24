import assert from "node:assert/strict";
import test from "node:test";

import { mergeKnownRoutes } from "./canonicalContentRoutes.ts";

test("canonical content routes keep the backend URI for the source language", () => {
  const routes = mergeKnownRoutes(
    "pl",
    "/sklep/",
    "/en/shop/",
    [{ languageCode: "en", uri: "/en/shop/" }],
    [],
  );

  assert.deepEqual(routes, [
    { languageCode: "pl", uri: "/sklep/" },
    { languageCode: "en", uri: "/en/shop/" },
  ]);
});

test("canonical content route cache survives the translated navigation path", () => {
  const initialRoutes = mergeKnownRoutes(
    "pl",
    "/sklep/",
    "/sklep/",
    [{ languageCode: "en", uri: "/en/shop/" }],
    [],
  );
  const translatedRoutes = mergeKnownRoutes(
    "en",
    "/en/shop/",
    "/en/shop/",
    [{ languageCode: "pl", uri: "/sklep/" }],
    initialRoutes,
  );

  assert.deepEqual(translatedRoutes, [
    { languageCode: "pl", uri: "/sklep/" },
    { languageCode: "en", uri: "/en/shop/" },
  ]);
});
