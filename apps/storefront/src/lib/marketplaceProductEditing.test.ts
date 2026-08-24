import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseLocalizedPrice } from "../../../../packages/ui/src/locale/pricing.ts";
import {
  deriveMarketplaceVariationAttributes,
  marketplaceVariationKey,
} from "../../../../packages/ui/src/social/marketplaceVariations.ts";
import { resolveMarketplaceMutationPrice } from "./marketplaceProductPricing.ts";

const communitySource = readFileSync(new URL("./community.ts", import.meta.url), "utf8");
const backendSource = readFileSync(
  new URL("../../../../../backend/wordpress/themes/free/funkycommerce-headless/inc/community.php", import.meta.url),
  "utf8",
);
const modalSource = readFileSync(
  new URL("../../../../packages/ui/src/social/ListProductModal.tsx", import.meta.url),
  "utf8",
);

test("uses concrete product fragments for schema-specific editing fields", () => {
  const query = communitySource.match(/MARKETPLACE_PRODUCT_FOR_EDITING_QUERY = \/\* GraphQL \*\/ `([\s\S]*?)`;/)?.[1] || "";
  const interfaceSelection = query.split("... on SimpleProduct")[0];
  const variableSelection = query.match(/\.\.\. on VariableProduct \{([\s\S]*?)\n      \}/)?.[1] || "";

  assert.doesNotMatch(interfaceSelection, /\bcrossSell\s*\(/);
  assert.match(query, /\.\.\. on SimpleProduct \{[\s\S]*crossSell/);
  assert.match(query, /\.\.\. on VariableProduct \{[\s\S]*variations/);
  assert.doesNotMatch(
    variableSelection.split("variations(first: 100)")[0],
    /^\s*(downloadable|downloadLimit|downloadExpiry|downloads)\b/m,
  );
  assert.match(query, /\.\.\. on ExternalProduct \{[\s\S]*externalUrl[\s\S]*buttonText/);
});

test("normalizes simple, variable, and external editing models", () => {
  const mapper = communitySource.match(/export function mapMarketplaceProductForEditing[\s\S]*?\n\}/)?.[0] || "";

  assert.match(mapper, /product\.__typename === "VariableProduct"/);
  assert.match(mapper, /product\.__typename === "ExternalProduct"/);
  assert.match(mapper, /existingDownloadNames: \(product\.downloads \|\| \[\]\)/);
  assert.match(mapper, /existingDownloadNames: \(variation\.downloads \|\| \[\]\)/);
  assert.match(mapper, /externalUrl: product\.externalUrl \|\| ""/);
  assert.match(mapper, /buttonText: product\.buttonText \|\| ""/);
  assert.match(mapper, /sku: variation\.sku && variation\.sku !== product\.sku \? variation\.sku : ""/);
});

test("supports type-aware marketplace mutation inputs", () => {
  assert.match(communitySource, /\$externalUrl: String/);
  assert.match(communitySource, /\$buttonText: String/);
  assert.match(communitySource, /variationId\?: number/);
  assert.match(communitySource, /downloadableFiles: DownloadableFileInput\[\]/);
  assert.match(backendSource, /new WC_Product_External\(\)/);
  assert.match(backendSource, /set_product_url\( \$external_url \)/);
  assert.match(backendSource, /funkycommerce_apply_marketplace_downloadable_settings\( \$variation, \$variation_input \)/);
});

test("preserves existing variation records when updating variable products", () => {
  assert.match(backendSource, /\$existing_child_ids\s*=\s*array_map\( 'absint', \$product->get_children\(\) \)/);
  assert.match(backendSource, /\$variation_input\['variationId'\]/);
  assert.match(backendSource, /array_diff\( \$existing_child_ids, \$saved_child_ids \)/);
});

test("accepts zero marketplace prices while rejecting invalid or negative prices in create and edit flows", () => {
  const createMutation = backendSource.slice(
    backendSource.indexOf("'createMarketplaceProduct'"),
    backendSource.indexOf("'updateMarketplaceProduct'"),
  );
  const updateMutation = backendSource.slice(backendSource.indexOf("'updateMarketplaceProduct'"));

  assert.match(modalSource, /function isValidPrice[\s\S]*value !== null && value >= 0/);
  assert.match(modalSource, /const primaryPrice = parseLocalizedPrice\(priceLabel\)/);
  assert.match(modalSource, /priceAmount = productType !== "variable" \? requireValidatedPrice\(primaryPrice, "Price"\) : 0/);
  assert.match(modalSource, /priceAmount: requireValidatedPrice\(/);
  assert.doesNotMatch(modalSource, /isPositivePrice|requirePositivePrice|valid positive price/);
  assert.doesNotMatch(modalSource, /requireNonNegativePrice|Enter a valid (?:non-negative )?price|variationPrice \?\? 0/);

  for (const mutationSource of [createMutation, updateMutation]) {
    assert.match(mutationSource, /funkycommerce_validate_non_negative_marketplace_price\( \$input\['price'\] \?\? null \)/);
    assert.match(mutationSource, /funkycommerce_validate_non_negative_marketplace_price\( \$variation_input\['price'\] \?\? null \)/);
    assert.match(mutationSource, /Compare-at price cannot be lower than the price/);
    assert.match(mutationSource, /Variation compare-at price cannot be lower than the price/);
    assert.doesNotMatch(mutationSource, /\$price_value <= 0|\$variation_price_value <= 0/);
  }

  assert.match(backendSource, /! is_numeric\( \$value \) \|\| ! is_finite\( \(float\) \$value \) \|\| \(float\) \$value < 0/);
  assert.match(backendSource, /must be a finite non-negative number/);
  assert.equal(parseLocalizedPrice("0"), 0);
  assert.equal(parseLocalizedPrice(""), null);
  assert.equal(parseLocalizedPrice("not a price"), null);
  assert.equal(parseLocalizedPrice("Infinity"), null);
  assert.equal(parseLocalizedPrice("-1"), -1);
});

test("does not submit hidden variation drafts for simple or external products", () => {
  assert.match(
    modalSource,
    /const variationDrafts = productType === "variable"\s*\?\s*combinations\.map/,
  );
});

test("does not resubmit existing remote product images as new uploads", () => {
  assert.match(
    modalSource,
    /imageDataUrls: imagePreviews\.filter\(\(preview\) => preview\.startsWith\("data:image\/"\)\)/,
  );
});

test("submits a real top-level price for edited variable products", () => {
  assert.equal(resolveMarketplaceMutationPrice("simple", 50, []), 50);
  assert.equal(resolveMarketplaceMutationPrice("external", 200, []), 200);
  assert.equal(resolveMarketplaceMutationPrice("variable", 0, [200, 50, 125]), 50);
  assert.equal(resolveMarketplaceMutationPrice("variable", 50, [25, 0]), 0);
  assert.equal(resolveMarketplaceMutationPrice("variable", 20, [Number.NaN, -1]), 20);
});

test("matches saved variation defaults across WooCommerce attribute naming differences", () => {
  assert.equal(
    marketplaceVariationKey([{ name: "Size", option: "Small" }]),
    marketplaceVariationKey([{ name: "attribute_pa_size", option: "small" }]),
  );
  assert.equal(
    marketplaceVariationKey([
      { name: "Colour", option: "Ocean Blue" },
      { name: "Size", option: "Small" },
    ]),
    marketplaceVariationKey([
      { name: "pa_size", option: "small" },
      { name: "attribute_pa_colour", option: "ocean-blue" },
    ]),
  );
});

test("derives edit options from saved variations instead of hard-coded phantom defaults", () => {
  assert.deepEqual(
    deriveMarketplaceVariationAttributes([
      { attributes: [{ name: "pa_size", option: "Small" }] },
      { attributes: [{ name: "attribute_pa_size", option: "Large" }] },
    ]),
    [{ name: "pa_size", options: ["Small", "Large"] }],
  );
  assert.match(modalSource, /isEditing\s*\?\s*\[\]\s*:\s*\[\{ id: "attribute-1", name: "Size", options: "Small, Medium, Large" \}\]/);
});
