import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("protected pages use authenticated non-cacheable REST access and strict login refs", () => {
  const client = source("./protectedPages.ts");
  const gate = source("../components/CmsPageContent.tsx");

  assert.match(client, /cache:\s*"no-store"/);
  assert.match(client, /Authorization:\s*"Bearer " \+ token/);
  assert.match(client, /X-WPGraphQL-Login-Token/);
  assert.match(client, /X-FunkyCommerce-Page-Proof/);
  assert.match(client, /cachePrivate:\s*true/);
  assert.match(gate, /parseStorefrontAuthRef\(`\$\{pathname\}\$\{search\}\$\{hash\}`\)/);
  assert.match(gate, /role="alert"/);
  assert.match(gate, /aria-labelledby="protected-page-title"/);
  assert.ok(gate.indexOf("function ProtectedPageGate") < gate.indexOf("export function CmsPageContent"));
  assert.match(client, /response\.status === 429/);
});

test("CMS behaviors follow the global code-controls preference after protected-page updates", () => {
  const content = source("../components/CmsPageContent.tsx");

  assert.match(content, /const \{ showCodeControls \} = useLayoutPreferences\(\)/);
  assert.match(content, /mountCmsBehaviors\(contentRef\.current, showCodeControls\)/);
  assert.match(content, /\[page\?\.headlessContent, showCodeControls\]/);
  assert.match(content, /protectedPageRevision/);
});

test("WordPress verifies native post passwords and never publicly caches protected responses", () => {
  const backend = source("../../../../../backend/wordpress/themes/free/funkycommerce-headless/inc/protected-content.php");

  assert.match(backend, /post_password_required\( \$page \)/);
  assert.match(backend, /current_user_can\( 'read_private_pages' \)/);
  assert.match(backend, /current_user_can\( 'read_post', \$page->ID \)/);
  assert.match(backend, /private, no-store, no-cache/);
  assert.match(backend, /X-WPGraphQL-Login-Token, X-FunkyCommerce-Page-Proof/);
  assert.match(backend, /FUNKYCOMMERCE_PROTECTED_UNLOCK_LIMIT\s+= 5/);
  assert.match(backend, /funkycommerce_protected_unlock_record_failure\( \$page \)/);
  assert.match(backend, /delete_transient\( funkycommerce_protected_unlock_rate_key\( \$page \) \)/);
  assert.match(backend, /\'status\' => 429, \'retry_after\' => \$retry_after/);
  assert.match(backend, /response->header\( \'Retry-After\'/);
  assert.match(backend, /\$query_args\['has_password'\] = false/);
  assert.match(backend, /graphql_resolve_field/);
  assert.match(backend, /wp_sitemaps_posts_query_args/);
  assert.match(backend, /\$query->is_search\(\) \|\| \$query->is_feed\(\)/);
  assert.doesNotMatch(backend, /setcookie\s*\(/i);
});
