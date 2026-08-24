import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { ProductCardData } from "../catalog/ProductCard.tsx";
import {
  getCartRecommendationHref,
  isCartRecommendationOptionAvailable,
  resolveCartRecommendationVariation,
} from "./cartRecommendation.ts";

const recommendationsSource = readFileSync(
  new URL("./CartEmptyRecommendations.tsx", import.meta.url),
  "utf8",
);
const drawerSource = readFileSync(new URL("./CartDrawer.tsx", import.meta.url), "utf8");
const dropdownSource = readFileSync(new URL("./CartDropdown.tsx", import.meta.url), "utf8");
const headerSource = readFileSync(new URL("./HeaderMockup.tsx", import.meta.url), "utf8");

test("both cart presentations render the shared featured-product recommendations", () => {
  assert.match(drawerSource, /<CartEmptyRecommendations products=\{featuredProducts\}/);
  assert.match(dropdownSource, /<CartEmptyRecommendations products=\{featuredProducts\}/);
  assert.match(
    headerSource,
    /<CartDropdown[\s\S]*featuredProducts=\{cartFeaturedProducts\}[\s\S]*showPromotedProduct=\{showCartPromotedProduct\}/,
  );
});

test("empty-cart product links use canonical product hrefs rather than GraphQL ids", () => {
  assert.equal(
    getCartRecommendationHref({
      id: "opaque-graphql-id",
      href: "/product/canonical-slug/",
      name: "Canonical product",
      priceLabel: "€10.00",
    }),
    "/product/canonical-slug/",
  );
  assert.equal(
    getCartRecommendationHref({
      id: "opaque-graphql-id",
      name: "Missing route",
      priceLabel: "€10.00",
    }),
    "/shop",
  );
  assert.doesNotMatch(recommendationsSource, /\/shop\/\$\{product\.id\}/);
});

test("variable recommendations add only a concrete priced variation", () => {
  const product: ProductCardData = {
    id: "variable-product",
    name: "Variable product",
    priceLabel: "",
    productType: "variable",
    variations: [
      {
        id: "sold-out",
        attributes: { Color: "Black", Size: "M" },
        priceLabel: "€20.00",
        inStock: false,
      },
      {
        id: "available",
        databaseId: 42,
        attributes: { Color: "Black", Size: "L" },
        priceLabel: "€22.00",
        priceAmount: 22,
        inStock: true,
      },
    ],
  };

  assert.equal(
    resolveCartRecommendationVariation(product, { Color: "Black", Size: "M" }),
    undefined,
  );
  assert.equal(
    resolveCartRecommendationVariation(product, { Color: "Black", Size: "L" })?.id,
    "available",
  );
  assert.match(
    recommendationsSource,
    /const canAddVariation = isVariable && Boolean\(selectedVariation\) && hasPrice;/,
  );
  assert.match(recommendationsSource, /backendVariationId: selectedVariation\?\.databaseId/);
  assert.match(recommendationsSource, /variationAttributes: selectedVariation\?\.attributes/);
  assert.match(recommendationsSource, /variantLabel: selectedVariation/);
  assert.match(recommendationsSource, /\{resolvedImageUrl \? \(/);
  assert.match(
    recommendationsSource,
    /isVariable && product\.inStock !== false\s*\?\s*t\("product\.choose_options"\)/,
  );
  assert.doesNotMatch(recommendationsSource, /fallbackMatch/);
});

test("variable recommendation options prevent impossible combinations without changing other selections", () => {
  const product: ProductCardData = {
    id: "variable-product",
    name: "Variable product",
    priceLabel: "",
    productType: "variable",
    variationOptions: [
      { label: "Color", values: [{ label: "Black" }, { label: "Blue" }] },
      { label: "Size", values: [{ label: "L" }, { label: "M" }] },
    ],
    variations: [
      {
        id: "black-large",
        attributes: { Color: "Black", Size: "L" },
        priceLabel: "€22.00",
        inStock: true,
      },
      {
        id: "blue-medium",
        attributes: { Color: "Blue", Size: "M" },
        priceLabel: "€22.00",
        inStock: true,
      },
    ],
  };

  assert.equal(
    isCartRecommendationOptionAvailable(product, { Color: "Black", Size: "L" }, "Color", "Blue"),
    false,
  );
  assert.equal(
    isCartRecommendationOptionAvailable(product, { Color: "Black" }, "Color", "Blue"),
    true,
  );
  assert.equal(resolveCartRecommendationVariation(product, { Color: "Blue" }), undefined);
  assert.match(recommendationsSource, /<option value="">\{t\("product\.select_options"\)\}<\/option>/);
});

test("multiple recommendations use a horizontally scrollable snap rail", () => {
  assert.match(recommendationsSource, /mx-auto w-full max-w-xs overflow-hidden/);
  assert.match(
    recommendationsSource,
    /snap-x snap-mandatory items-start gap-3 overflow-x-auto overflow-y-hidden overscroll-x-contain/,
  );
  assert.match(recommendationsSource, /w-full min-w-full max-w-72 shrink-0 snap-center/);
  assert.match(recommendationsSource, /products\.map\(\(product\)/);
});

test("purchasable recommendations expose bounded quantity controls", () => {
  assert.match(recommendationsSource, /const \[quantity, setQuantity\] = useState\(1\)/);
  assert.match(recommendationsSource, /Math\.max\(1, current - 1\)/);
  assert.match(recommendationsSource, /Math\.min\(99, current \+ 1\)/);
  assert.match(recommendationsSource, /addItem\([\s\S]*quantity,[\s\S]*\);/);
});
