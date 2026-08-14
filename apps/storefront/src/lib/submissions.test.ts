import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

process.env.VITE_GRAPHQL_ENDPOINT = "https://backend.example.test/graphql";
const { requestNewsletterUnsubscribe, submitFormSubmission, submitNewsletterSubmission } = await import("./submissions.ts");

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("newsletter submissions include explicit consent, source, and language", async () => {
  let request: RequestInit | undefined;
  globalThis.fetch = async (_url, init) => {
    request = init;
    return new Response("{}", { status: 201 });
  };

  await submitNewsletterSubmission("person@example.test", { source: "newsletter-popup", language: "en", consent: true });
  assert.deepEqual(JSON.parse(String(request?.body)), {
    email: "person@example.test",
    consent: true,
    source: "newsletter-popup",
    language: "en",
    website: "",
  });
});

test("generic form uses multipart only when protected attachments are present", async () => {
  let request: RequestInit | undefined;
  globalThis.fetch = async (_url, init) => {
    request = init;
    return new Response("{}", { status: 201 });
  };
  const file = new File(["hello"], "notes.txt", { type: "text/plain" });

  await submitFormSubmission({ formId: "sample", fields: { Name: "Ada" }, files: [file] });
  assert.ok(request?.body instanceof FormData);
  const body = request?.body as FormData;
  assert.equal(body.get("fields"), JSON.stringify({ Name: "Ada" }));
  assert.equal((body.get("files[]") as File).name, "notes.txt");
  assert.equal((request?.headers as Record<string, string>)["Content-Type"], undefined);
});

test("unsubscribe requests never send mail or secrets from the client", async () => {
  let body = "";
  globalThis.fetch = async (_url, init) => {
    body = String(init?.body);
    return Response.json({ received: true, message: "Check your inbox." }, { status: 202 });
  };

  assert.equal(await requestNewsletterUnsubscribe("person@example.test"), "Check your inbox.");
  assert.deepEqual(JSON.parse(body), { email: "person@example.test" });
});
