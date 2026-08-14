import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeProductPriceBehavior, resolveProductPriceMode } from "./productPriceMode.ts";

process.env.VITE_GRAPHQL_ENDPOINT = "https://backend.example.test/graphql";

// Dynamic import, evaluated after the env var above is set — a static import would be
// hoisted ahead of that assignment and see the endpoint as unconfigured (see the same
// pattern in submissions.test.ts).
const {
  buildProductInquirySubmission,
  prefillFromCustomer,
  PRODUCT_INQUIRY_FORM_ID,
  submitProductInquiry,
  validateProductInquiryValues,
} = await import("./productInquiry.ts");

const originalFetch = globalThis.fetch;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("resolveProductPriceMode: a positive price always resolves to purchase", () => {
  assert.equal(resolveProductPriceMode(19.99, "inherit", "free"), "purchase");
  assert.equal(resolveProductPriceMode(19.99, "inquiry", "inquiry"), "purchase");
});

test("resolveProductPriceMode: an explicit price of 0 is always preserved as free, even under an inquiry default", () => {
  assert.equal(resolveProductPriceMode(0, "inherit", "inquiry"), "free");
  assert.equal(resolveProductPriceMode(0, "inquiry", "inquiry"), "free");
  assert.equal(resolveProductPriceMode(0, "free", "inquiry"), "free");
});

test("resolveProductPriceMode: no price data defers to the per-product override when set", () => {
  assert.equal(resolveProductPriceMode(undefined, "free", "inquiry"), "free");
  assert.equal(resolveProductPriceMode(undefined, "inquiry", "free"), "inquiry");
});

test("resolveProductPriceMode: no price data falls back to the store-wide default when inherited", () => {
  assert.equal(resolveProductPriceMode(undefined, "inherit", "free"), "free");
  assert.equal(resolveProductPriceMode(undefined, "inherit", "inquiry"), "inquiry");
});

test("normalizeProductPriceBehavior accepts only the known values and defaults everything else to inherit", () => {
  assert.equal(normalizeProductPriceBehavior("inherit"), "inherit");
  assert.equal(normalizeProductPriceBehavior("free"), "free");
  assert.equal(normalizeProductPriceBehavior("inquiry"), "inquiry");
  assert.equal(normalizeProductPriceBehavior(undefined), "inherit");
  assert.equal(normalizeProductPriceBehavior(null), "inherit");
  assert.equal(normalizeProductPriceBehavior(""), "inherit");
  assert.equal(normalizeProductPriceBehavior("not-a-real-behavior"), "inherit");
});

test("validateProductInquiryValues trims fields and rejects missing name, email, or message", () => {
  assert.deepEqual(
    validateProductInquiryValues({ name: " Ada ", email: " ada@example.test ", message: " Is this in stock? " }),
    { name: "Ada", email: "ada@example.test", message: "Is this in stock?" },
  );
  assert.throws(() => validateProductInquiryValues({ name: "", email: "ada@example.test", message: "Hi" }), /name/i);
  assert.throws(() => validateProductInquiryValues({ name: "Ada", email: "not-an-email", message: "Hi" }), /valid email/i);
  assert.throws(() => validateProductInquiryValues({ name: "Ada", email: "ada@example.test", message: "  " }), /message/i);
});

test("prefillFromCustomer maps the authenticated session's display name and email, ignoring blanks", () => {
  assert.deepEqual(prefillFromCustomer({ displayName: "Ada Lovelace", email: "ada@example.test" }), {
    name: "Ada Lovelace",
    email: "ada@example.test",
  });
  assert.deepEqual(prefillFromCustomer({ displayName: "  ", email: "" }), {});
  assert.deepEqual(prefillFromCustomer(null), {});
  assert.deepEqual(prefillFromCustomer(undefined), {});
});

test("buildProductInquirySubmission attaches product context to the generic form-submission payload", () => {
  const payload = buildProductInquirySubmission(
    { databaseId: 42, name: "Widget", uri: "/product/widget/", sku: "WID-1" },
    { name: "Ada", email: "ada@example.test", message: "Is this available?" },
    { language: "en", origin: "https://store.example.test" },
  );

  assert.equal(payload.formId, PRODUCT_INQUIRY_FORM_ID);
  assert.equal(payload.email, "ada@example.test");
  assert.equal(payload.subject, "Product inquiry: Widget");
  assert.equal(payload.source, "https://store.example.test/product/widget/");
  assert.equal(payload.language, "en");
  assert.deepEqual(payload.fields, {
    Name: "Ada",
    Email: "ada@example.test",
    Message: "Is this available?",
    Product: "Widget",
    ProductId: 42,
    SKU: "WID-1",
  });
});

test("buildProductInquirySubmission omits SKU when the product has none and uses the raw uri without an origin", () => {
  const payload = buildProductInquirySubmission(
    { databaseId: 7, name: "Service", uri: "/product/service/" },
    { name: "Ada", email: "ada@example.test", message: "Details please" },
  );

  assert.equal(payload.source, "/product/service/");
  assert.equal("SKU" in payload.fields, false);
});

test("submitProductInquiry posts through the existing generic form-submission endpoint and surfaces backend errors", async () => {
  let requestBody: unknown;
  globalThis.fetch = async (url, init) => {
    requestBody = init?.body ? JSON.parse(String(init.body)) : undefined;
    void url;
    return new Response("{}", { status: 201 });
  };

  await submitProductInquiry(
    { databaseId: 1, name: "Widget", uri: "/product/widget/" },
    { name: "Ada", email: "ada@example.test", message: "Ping" },
  );
  assert.equal((requestBody as { formId: string }).formId, PRODUCT_INQUIRY_FORM_ID);

  globalThis.fetch = async () => Response.json({ message: "That product no longer accepts inquiries." }, { status: 503 });
  await assert.rejects(
    submitProductInquiry(
      { databaseId: 1, name: "Widget", uri: "/product/widget/" },
      { name: "Ada", email: "ada@example.test", message: "Ping" },
    ),
    /no longer accepts inquiries/,
  );
});
