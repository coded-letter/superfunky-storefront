import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const themeRoot = new URL(
  "../../../../../backend/wordpress/themes/free/funkycommerce-headless/",
  import.meta.url,
);
const schema = readFileSync(new URL("functions.php", themeRoot), "utf8");
const nativeShortcodes = readFileSync(new URL("inc/native-shortcodes.php", themeRoot), "utf8");
const storefrontShortcodes = readFileSync(
  new URL("../components/wordpressShortcodes.tsx", import.meta.url),
  "utf8",
);
const library = readFileSync(
  new URL("../pages/ShortcodeLibraryMockupPage.tsx", import.meta.url),
  "utf8",
);

test("community members accept a permission filter while preserving the role alias", () => {
  assert.match(schema, /'community-members'[\s\S]*'permission'[\s\S]*'all', 'member', 'creator', 'collaborator'/);
  assert.match(nativeShortcodes, /\$permission = 'all' !== \$a\['permission'\] \? \$a\['permission'\] : \$a\['role'\]/);
  assert.match(storefrontShortcodes, /attributes\.permission && attributes\.permission !== "all"/);
  assert.match(storefrontShortcodes, /member\.role === permission/);
  assert.match(library, /\["permission", \["all", "member", "creator", "collaborator"\]\]/);
  assert.match(library, /\["role \(legacy alias\)"/);
});
