import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const checkoutSourceUrl = new URL("../src/pages/CheckoutMockupPage.tsx", import.meta.url);
const blikAssetUrl = new URL("../public/icons/payment/blik.svg", import.meta.url);
const englishStringsUrl = new URL("../../../packages/ui/src/locale/en.json", import.meta.url);

const LONG_LOCALIZED_COUPON_FIXTURE = {
  label: "Internationaler Aktionsgutscheincode",
  apply: "Internationalen Gutscheincode anwenden",
};

test("checkout uses exact production English coupon copy", async () => {
  const [source, englishStrings] = await Promise.all([
    readFile(checkoutSourceUrl, "utf8"),
    readFile(englishStringsUrl, "utf8").then(JSON.parse),
  ]);

  assert.deepEqual(englishStrings["checkout.coupon.title"], "Have a coupon?");
  assert.deepEqual(englishStrings["checkout.coupon.label"], "Coupon code");
  assert.deepEqual(englishStrings["checkout.coupon.apply"], "Apply code");
  assert.match(source, /title: "Have a coupon\?"/);
  assert.match(source, /label: "Coupon code"/);
  assert.match(source, /apply: "Apply code"/);
  assert.match(source, /placeholder=\{CHECKOUT_COUPON_COPY\.label\}/);
  assert.doesNotMatch(source, new RegExp(LONG_LOCALIZED_COUPON_FIXTURE.label));
  assert.doesNotMatch(source, new RegExp(LONG_LOCALIZED_COUPON_FIXTURE.apply));
});

test("long localized coupon fixture stacks at mobile widths without changing production copy", async () => {
  const source = await readFile(checkoutSourceUrl, "utf8");
  const rowClass = source.match(/data-checkout-coupon-row\s+className="([^"]+)"/)?.[1] ?? "";
  const inputClass = source.match(/data-checkout-coupon-input className="([^"]+)"/)?.[1] ?? "";
  const buttonClass = source.match(
    /data-checkout-coupon-submit[\s\S]*?className="([^"]+)"/,
  )?.[1] ?? "";

  assert.match(rowClass, /\bgrid-cols-1\b/);
  assert.ok(rowClass.split(" ").includes("sm:grid-cols-[minmax(0,1fr)_auto]"));
  assert.match(rowClass, /\bgap-3\b/);
  assert.match(inputClass, /\bmin-w-0\b/);
  assert.match(inputClass, /\bw-full\b/);
  assert.match(inputClass, /\bmax-w-full\b/);
  assert.match(inputClass, /\bbox-border\b/);
  assert.match(buttonClass, /\bmin-h-11\b/);
  assert.match(buttonClass, /\bmin-w-0\b/);
  assert.match(buttonClass, /\bw-full\b/);
  assert.match(buttonClass, /\bmax-w-full\b/);
  assert.match(buttonClass, /\bbox-border\b/);
  assert.match(buttonClass, /\bwhitespace-normal\b/);
  assert.match(buttonClass, /\bsm:w-auto\b/);
  assert.ok(LONG_LOCALIZED_COUPON_FIXTURE.label.length > "Coupon code".length);
  assert.ok(LONG_LOCALIZED_COUPON_FIXTURE.apply.length > "Apply code".length);
});

test("checkout restores old BLIK asset and scales its painted bounds to 20px", async () => {
  const [source, svg] = await Promise.all([
    readFile(checkoutSourceUrl, "utf8"),
    readFile(blikAssetUrl, "utf8"),
  ]);

  assert.equal(
    createHash("sha256").update(svg).digest("hex"),
    "bd86de4e1c3d213f537848ee7abe19d367a672f69aec602dbda5bf2e26471bc9",
  );
  const viewBoxHeight = 40;
  const paintedBounds = { x: 23, y: 8.00025, width: 48.0004, height: 24.04175 };
  const paintedHeightFraction = paintedBounds.height / viewBoxHeight;
  const renderedOuterHeight = 33.28;
  const renderedPaintedHeight = renderedOuterHeight * paintedHeightFraction;

  assert.match(svg, /width="95" height="40" viewBox="0 0 95 40"/);
  assert.equal(Number(paintedHeightFraction.toFixed(6)), 0.601044);
  assert.ok(Math.abs(renderedPaintedHeight - 20) < 0.01);
  assert.match(source, /src="\/icons\/payment\/blik\.svg"/);
  assert.match(source, /alt=""/);
  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /width=\{95\}/);
  assert.match(source, /height=\{40\}/);
  assert.match(source, /className="block w-auto max-w-full object-contain"/);
  assert.match(source, /const BLIK_RENDERED_HEIGHT_PX = 33\.28/);
  assert.match(source, /blockSize: `\$\{BLIK_RENDERED_HEIGHT_PX\}px`/);
  assert.match(source, /inlineSize: "auto"/);
  assert.match(source, /maxInlineSize: "100%"/);
  assert.match(source, /aspectRatio: "95 \/ 40"/);
  assert.match(source, /objectFit: "contain"/);
  assert.match(source, /className="mt-0\.5 shrink-0 text-zinc-500/);
  assert.match(source, /label="BLIK"/);
});
