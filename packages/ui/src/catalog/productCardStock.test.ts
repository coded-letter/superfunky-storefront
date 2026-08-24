import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const card = readFileSync(new URL("./ProductCard.tsx", import.meta.url), "utf8");

test("a fully out-of-stock variable product uses the Learn more CTA and product link", () => {
  // Every variation being unavailable leaves nothing purchasable — the card must offer
  // navigation to the full product page instead of an "Add to cart"/"Choose options"
  // action whose only effect is a "Variation unavailable" toast.
  assert.match(
    card,
    /const isOutOfStockVariable = product\.productType === "variable" && product\.inStock === false;/,
  );
  assert.match(
    card,
    /const showLearnMore = usesAddToCartAction && \(!hasPrice \|\| isOutOfStockVariable\);/,
  );

  // The CTA render branch already resolves "Learn more" + a real <Link> to the product
  // page whenever `showLearnMore` is true, so feeding the out-of-stock case into that
  // same flag is enough to fix both the label and the navigation behavior.
  assert.match(card, /showLearnMore\s*\?\s*t\("product\.cta\.learn_more"\)/);
  const ctaMarkup = card.slice(card.indexOf("{!isSimple ? ("), card.indexOf("{quickViewEnabled && isQuickViewOpen"));
  assert.match(
    ctaMarkup,
    /showLearnMore \|\| product\.productType === "external" \|\| product\.productType === "grouped" \? \(\s*<Link\s+to=\{product\.href \?\? `\/shop\/\$\{encodeURIComponent\(product\.id\)\}`\}/,
  );
});
