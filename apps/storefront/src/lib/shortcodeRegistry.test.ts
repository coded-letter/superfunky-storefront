import assert from "node:assert/strict";
import test from "node:test";
import { CONTENT_SHORTCODE_NAMES, SUPPORTED_SHORTCODE_NAMES } from "./shortcodeRegistry.mjs";
import { normalizeSupportedShortcodes, findRenderableShortcodeMarkers } from "./shortcodeMarkup.ts";
import { chatAssistantEndpoints, resolveFlatAssistantIcon } from "./chatAssistant.ts";

test("registers spotify radio as globally renderable content", () => {
  assert.ok(CONTENT_SHORTCODE_NAMES.includes("spotify-radio"));
  assert.ok(SUPPORTED_SHORTCODE_NAMES.includes("spotify-radio"));

  const html = normalizeSupportedShortcodes(
    '[spotify-radio uri="spotify:episode:1234567890AB" content_type="episode" height="232"]',
    SUPPORTED_SHORTCODE_NAMES,
  );
  assert.deepEqual(findRenderableShortcodeMarkers(html)[0], {
    name: "spotify-radio",
    attributes: {
      uri: "spotify:episode:1234567890AB",
      "content-type": "episode",
      height: "232",
    },
    start: 0,
    end: html.length,
  });
});

test("registers and resolves the headless chat assistant shortcode", () => {
  assert.ok(CONTENT_SHORTCODE_NAMES.includes("chat_assistant"));
  assert.ok(SUPPORTED_SHORTCODE_NAMES.includes("chat_assistant"));
  const html = normalizeSupportedShortcodes("[chat_assistant]", SUPPORTED_SHORTCODE_NAMES);
  assert.equal(findRenderableShortcodeMarkers(html)[0]?.name, "chat_assistant");
});

test("headless chat uses canonical endpoints and only flat configured icons", () => {
  assert.deepEqual(chatAssistantEndpoints("https://cms.example/"), {
    config: "https://cms.example/wp-json/funkycommerce-ai-assistant/v1/config",
    chat: "https://cms.example/wp-json/funkycommerce-ai-assistant/v1/chat",
  });
  assert.equal(resolveFlatAssistantIcon("sparkles"), "sparkles");
  assert.equal(resolveFlatAssistantIcon("3d"), "message-circle");
});
