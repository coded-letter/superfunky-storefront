import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const submissionsPath = new URL(
  "../../../../backend/wordpress/themes/free/funkycommerce-headless/inc/submissions.php",
  import.meta.url,
);
const controlCenterSchemaPath = new URL(
  "../../../../backend/wordpress/themes/free/funkycommerce-headless/inc/control-center-schema.php",
  import.meta.url,
);
const source = await readFile(submissionsPath, "utf8");
const controlCenterSchema = await readFile(controlCenterSchemaPath, "utf8");

test("WordPress submission contract keeps public routes and private file controls together", () => {
  assert.match(source, /'\/form-submissions'/);
  assert.match(source, /'\/newsletter-submissions'/);
  assert.match(source, /'\/newsletter-unsubscribe'/);
  assert.match(source, /FUNKYCOMMERCE_SUBMISSION_MAX_FILES\s*=\s*5/);
  assert.match(source, /move_uploaded_file/);
  assert.match(source, /funkycommerce_download_submission_file/);
  assert.match(source, /before_delete_post/);
  assert.match(source, /DOCUMENT_ROOT/);
  assert.match(source, /dirname\(\s*untrailingslashit\(\s*\$document_root\s*\)\s*\)/);
  assert.match(source, /funkycommerce_migrate_legacy_submission_storage/);
  assert.match(source, /funkycommerce_private_storage_public/);
});

test("form upload settings advertise the enforced 20 MB ceiling", () => {
  assert.match(source, /min\(\s*20,\s*max\(\s*1,\s*absint\(\s*\$settings\['forms_max_upload_mb'\]/);
  assert.match(controlCenterSchema, /'forms_max_upload_mb'.*'max'\s*=>\s*'20'/);
});

test("newsletter unsubscribe remains signed, expiring, single-use, and backend-emailed", () => {
  assert.match(source, /hash_hmac\(\s*'sha256'/);
  assert.match(source, /hash_equals/);
  assert.match(source, /delete_transient/);
  assert.match(source, /wp_delete_post\(\s*\$post_id,\s*true\s*\)/);
  assert.match(source, /wp_mail\(/);
  assert.match(source, /<form method="post"/);
  assert.match(source, /if \( ! \$is_post \)/);
  assert.match(source, /funkycommerce_render_newsletter_unsubscribe_confirmation/);
});

test("newsletter state is provider-agnostic and exposes stable plugin hooks", () => {
  assert.doesNotMatch(source, /newsletter_provider|_fc_provider|sync_provider|remove_from_provider/);
  assert.match(source, /do_action\(\s*'funkycommerce_newsletter_subscribed',\s*\$subscriber\s*\)/);
  assert.match(source, /do_action\(\s*'funkycommerce_newsletter_unsubscribed',\s*\$subscriber\s*\)/);
  assert.doesNotMatch(source, /['"]provider['"]\s*=>/);
});
