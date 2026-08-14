import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  discoverNativeAssistantProvider,
  parseAssistantConfigPayload,
  parseJsonObjectPayload,
  resolveAssistantRuntime,
  resolveAssistantThemeConfig,
  resolveLauncherAppearance,
  validateAssistantAssetUrl,
  validateAssistantIframeSource,
} from "./aiAssistant.ts";

const headerSource = readFileSync(
  new URL("../../../../packages/ui/src/layout/HeaderMockup.tsx", import.meta.url),
  "utf8",
);
const assistantSource = readFileSync(
  new URL("../components/AiShoppingAssistant.tsx", import.meta.url),
  "utf8",
);
const navigationSource = readFileSync(new URL("navigation.ts", import.meta.url), "utf8");
const robotSource = readFileSync(new URL("assistantRobotRenderer.ts", import.meta.url), "utf8");
const robotComponentSource = readFileSync(
  new URL("../components/AssistantRobot3D.tsx", import.meta.url),
  "utf8",
);
const localeDropdownSource = readFileSync(
  new URL("../../../../packages/ui/src/locale/Dropdowns.tsx", import.meta.url),
  "utf8",
);

test("imports the Command component used by the assistant header icon registry", () => {
  assert.match(headerSource, /import\s*\{[\s\S]*?\bCommand,\s*[\s\S]*?\}\s*from "lucide-react"/);
  assert.match(headerSource, /command:\s*Command/);
});

test("accepts production configurations without new header icon fields", () => {
  assert.match(assistantSource, /headerIcons\?\.assistant/);
  assert.match(assistantSource, /headerIconMedia\?\.assistant/);
});

test("keeps overlay composer focus stable while typing", () => {
  assert.match(assistantSource, /const closeAssistant = useCallback\(/);
  assert.match(assistantSource, /data-assistant-composer/);
  assert.match(assistantSource, /querySelector<HTMLElement>\("\[data-assistant-composer\]"\)/);
});

test("keeps the site header lightweight while preserving the animated chat identity", () => {
  assert.match(assistantSource, /allow3d=\{false\}/);
  assert.match(assistantSource, /priority size="chat-header"/);
  assert.match(assistantSource, /h-11 w-11[\s\S]*bg-brand-gradient/);
  assert.match(assistantSource, /useIsNearPageBottom\(\)/);
});

test("preloads real robot assets and never renders the legacy CSS robot", () => {
  assert.match(robotComponentSource, /scheduleAssistantRobotPreload/);
  assert.match(robotComponentSource, /requestIdleCallback/);
  assert.match(robotComponentSource, /MODEL_URLS\.forEach/);
  assert.doesNotMatch(robotComponentSource, /AssistantRobotFallback|animate-\[bounce/);
  assert.match(assistantSource, /const \[hasOpened, setHasOpened\] = useState\(isOpen\)/);
});

test("keeps fixed 3d launchers hidden until ready and while chat is open", () => {
  assert.match(assistantSource, /hidden=\{isNearPageBottom \|\| \(runtime\.kind !== "native" && open\)\}/);
  assert.match(assistantSource, /const \[visualReady, setVisualReady\] = useState\(appearance\.kind !== "3d"\)/);
  assert.match(assistantSource, /const visuallyHidden = hidden \|\| !visualReady/);
  assert.match(assistantSource, /showFallbackWhileLoading=\{size !== "launcher"\}/);
  assert.match(assistantSource, /priority=\{priority \|\| size === "launcher"\}/);
  assert.match(assistantSource, /on3dStatusChange=\{\(status\) => setVisualReady\(status !== "loading"\)\}/);
});

test("renders chat header identity without a colored background", () => {
  assert.match(assistantSource, /h-11 w-11 shrink-0 place-items-center overflow-hidden text-brand-600/);
  assert.doesNotMatch(assistantSource, /h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-brand-gradient/);
});

test("does not render the default chat icon before appearance discovery completes", () => {
  assert.match(assistantSource, /const \[runtimeReady, setRuntimeReady\] = useState\(false\)/);
  assert.match(assistantSource, /setRuntimeReady\(false\)/);
  assert.match(assistantSource, /setRuntimeReady\(true\)/);
  assert.match(assistantSource, /const headerActionSlot = !runtimeReady \|\|/);
  assert.match(assistantSource, /const floatingAssistantSlot = !runtimeReady \|\|/);
});

test("matches legacy robot interaction without blocking model readiness on HDR", () => {
  assert.match(robotSource, /toneMappingExposure = 1/);
  assert.match(robotSource, /shadowMap\.enabled = true/);
  assert.match(robotSource, /gaze\.lerp\(pointer, 0\.08\)/);
  assert.match(robotSource, /eyeTarget\.lerp\(gazeTarget, 0\.15\)/);
  assert.match(robotSource, /const environmentPromise = hdrLoader\.loadAsync/);
  assert.doesNotMatch(robotSource, /Promise\.all\(\[[\s\S]*hdrLoader\.loadAsync/);
});

test("shows the ringing bell state with consistent header control sizing", () => {
  assert.match(headerSource, /name=\{pushSubscribed \? "bell-ring" : headerIcons\?\.push\}/);
  assert.match(headerSource, /className=\{`\$\{iconButtonClass\}/);
  assert.match(localeDropdownSource, /"inline-flex h-10 items-center/);
  assert.match(headerSource, /loadedHeaderIconUrls/);
  assert.match(headerSource, /fetchPriority="high"/);
});

test("keeps removed push-icon fields out of the core navigation query", () => {
  const headerIconsSelection = navigationSource.match(/headerIcons\s*\{([^}]*)\}/)?.[1] || "";
  assert.doesNotMatch(headerIconsSelection, /\bpush\b/);
});

test("prefers the canonical native assistant provider before the legacy global", () => {
  const canonicalProvider = { open: () => undefined };
  const discovery = discoverNativeAssistantProvider({
    aoAgenticShoppingAssistant: { open: () => undefined },
    funkycommerceAiAssistant: canonicalProvider,
  });

  assert.equal(discovery.status, "ready");
  if (discovery.status !== "ready") return;
  assert.equal(discovery.source, "canonical");
  assert.equal(discovery.provider, canonicalProvider);
});

test("normalizes legacy header placement to the overlay surface", () => {
  assert.equal(
    resolveAssistantThemeConfig({ enabled: true, placement: "header" }).placement,
    "header-command-overlay",
  );
});

test("recovers assistant config JSON after WordPress diagnostics", () => {
  assert.deepEqual(
    parseAssistantConfigPayload(
      '<br><b>Notice</b>: diagnostic output<br>\n{"has_api_key":true,"appearance":{"launcher_mode":"3d"}}\nDeprecated: shutdown warning',
    ),
    {
      has_api_key: true,
      appearance: { launcher_mode: "3d" },
    },
  );
});

test("recovers chat JSON after WordPress diagnostics", () => {
  assert.deepEqual(
    parseJsonObjectPayload('<b>Deprecated {diagnostic}</b><br>\n{"content":"Hello {world}"}\nWarning'),
    { content: "Hello {world}" },
  );
});

test("keeps an enabled native plugin visible while REST configuration is loading", () => {
  const runtime = resolveAssistantRuntime({
    currentOrigin: "https://store.example",
    nativeDiscovery: { status: "unavailable" },
    themeConfig: {
      enabled: true,
      nativeProviderActive: true,
      placement: "header",
    },
  });

  assert.equal(runtime.kind, "rest");
  if (runtime.kind !== "rest") return;
  assert.equal(runtime.configured, true);
});

test("surfaces native REST configuration errors instead of falling back to iframe", () => {
  const runtime = resolveAssistantRuntime({
    currentOrigin: "https://store.example",
    fetchedConfig: { has_api_key: false },
    nativeDiscovery: { status: "unavailable" },
    themeConfig: {
      enabled: true,
      iframeUrl: "https://assistant.example/embed",
    },
  });

  assert.equal(runtime.kind, "rest");
  if (runtime.kind !== "rest") return;
  assert.equal(runtime.configured, false);
});

test("falls back to a validated iframe only when no native provider is available", () => {
  const runtime = resolveAssistantRuntime({
    currentOrigin: "https://store.example",
    nativeDiscovery: { status: "unavailable" },
    themeConfig: {
      enabled: true,
      iframeUrl: "https://assistant.example/embed?theme=dark",
    },
  });

  assert.equal(runtime.kind, "iframe");
  if (runtime.kind !== "iframe") return;
  assert.equal(runtime.iframe.origin, "https://assistant.example");
});

test("validates iframe sources against secure protocols and allowed origins", () => {
  assert.equal(
    validateAssistantIframeSource("javascript:alert(1)", {
      currentOrigin: "https://store.example",
    }),
    null,
  );
  assert.equal(
    validateAssistantIframeSource("https://elsewhere.example/embed", {
      allowedOrigins: ["https://assistant.example"],
      currentOrigin: "https://store.example",
    }),
    null,
  );

  assert.deepEqual(
    validateAssistantIframeSource("/assistant/embed#ignore-me", {
      allowedOrigins: ["https://store.example"],
      currentOrigin: "https://store.example",
    }),
    {
      origin: "https://store.example",
      src: "https://store.example/assistant/embed",
    },
  );
});

test("validates custom launcher assets with the same secure URL rules", () => {
  assert.equal(validateAssistantAssetUrl("data:image/svg+xml;base64,AAAA", "https://store.example"), null);
  assert.equal(
    validateAssistantAssetUrl("http://assistant.example/icon.svg", "https://store.example"),
    null,
  );
  assert.equal(
    validateAssistantAssetUrl("https://assistant.example/icon.svg#decorative", "https://store.example"),
    "https://assistant.example/icon.svg",
  );
});

test("maps native launcher appearance to custom, 3d, and flat modes", () => {
  const theme = resolveAssistantThemeConfig({ launcherLabel: "Launch" });

  assert.deepEqual(
    resolveLauncherAppearance(theme, {
      appearance: { custom_icon_url: "https://assistant.example/icon.svg", launcher_label: "Native launch" },
    }, "https://store.example"),
    {
      kind: "custom",
      customIconUrl: "https://assistant.example/icon.svg",
      iconPreset: "message-circle",
      label: "Native launch",
    },
  );

  assert.deepEqual(
    resolveLauncherAppearance(theme, {
      appearance: { launcher_mode: "3d", icon_preset: "sparkles" },
    }, "https://store.example"),
    {
      kind: "3d",
      environmentUrl: null,
      iconPreset: "sparkles",
      label: "Launch",
      textureUrl: null,
    },
  );

  assert.deepEqual(
    resolveLauncherAppearance(theme, {
      appearance: { launcher_mode: "icon", icon_preset: "bot" },
    }, "https://store.example"),
    {
      kind: "flat",
      iconPreset: "bot",
      label: "Launch",
    },
  );
});
