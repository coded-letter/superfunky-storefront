import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../components/ChatAssistantShortcode.tsx", import.meta.url), "utf8");
const rendererRegistry = readFileSync(new URL("../components/wordpressShortcodes.tsx", import.meta.url), "utf8");
const themeFunctions = readFileSync(
  new URL("../../../../../backend/wordpress/themes/free/funkycommerce-headless/functions.php", import.meta.url),
  "utf8",
);

test("renders chat_assistant with the lightweight headless component", () => {
  assert.match(rendererRegistry, /lazy\(\(\)\s*=>\s*[\s\S]*import\("\.\/ChatAssistantShortcode"\)/);
  assert.match(rendererRegistry, /chat_assistant:\s*\(\)\s*=>\s*\([\s\S]*<LazyChatAssistantShortcode \/>/);
  assert.match(source, /fetch\(endpoints\.config/);
  assert.match(source, /fetch\(endpoints\.chat/);
  assert.match(source, /<ConfiguredIcon config=\{config\} \/>/);
  assert.match(themeFunctions, /'chat_assistant'\s*=>\s*array\(\)/);
  assert.match(themeFunctions, /'chat_assistant'\s*===\s*\$shortcode_tag[\s\S]*funkycommerce_is_headless_mode/);
});

test("headless renderer has no 3D assistant dependency", () => {
  assert.doesNotMatch(source, /AssistantRobot3D|assistant-robot|three/);
});
