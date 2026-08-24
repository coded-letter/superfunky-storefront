import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { stripBootstrapOverlay } from "./static-html.mjs";

const mainSource = await readFile(new URL("../src/main.tsx", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/App.tsx", import.meta.url), "utf8");
const cmsPageSource = await readFile(new URL("../src/components/CmsPageContent.tsx", import.meta.url), "utf8");
const smartLinksSource = await readFile(new URL("../src/components/SmartLinkNavigation.tsx", import.meta.url), "utf8");
const indexSource = await readFile(new URL("../index.html", import.meta.url), "utf8");
const prerenderSource = await readFile(new URL("./prerender.mjs", import.meta.url), "utf8");
const routePrefetchSource = await readFile(new URL("../src/lib/routePrefetch.ts", import.meta.url), "utf8");
const documentWarmupSource = await readFile(new URL("../src/lib/storefrontDocumentWarmup.ts", import.meta.url), "utf8");
const serviceWorkerSource = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
const netlifySource = await readFile(new URL("../../../netlify.toml", import.meta.url), "utf8");
const cmsBehaviorsSource = await readFile(new URL("../src/lib/cmsBehaviors.ts", import.meta.url), "utf8");
const headerSource = await readFile(new URL("../../../packages/ui/src/layout/HeaderMockup.tsx", import.meta.url), "utf8");
const dropdownsSource = await readFile(new URL("../../../packages/ui/src/locale/Dropdowns.tsx", import.meta.url), "utf8");
const authSource = await readFile(new URL("../src/lib/auth.ts", import.meta.url), "utf8");
const cartStateSource = await readFile(new URL("../../../packages/ui/src/state/CartContext.tsx", import.meta.url), "utf8");
const savedCollectionSource = await readFile(new URL("../../../packages/ui/src/state/createPersistedIdCollection.tsx", import.meta.url), "utf8");
const storefrontStylesSource = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const productCardSource = await readFile(new URL("../../../packages/ui/src/catalog/ProductCard.tsx", import.meta.url), "utf8");
const staticNavigationRuntimeSource = await readFile(new URL("../src/lib/staticNavigationRuntime.js", import.meta.url), "utf8");
const assistantSource = await readFile(new URL("../src/components/AiShoppingAssistant.tsx", import.meta.url), "utf8");
const cookieConsentSource = await readFile(new URL("../../../packages/ui/src/layout/CookieConsentBanner.tsx", import.meta.url), "utf8");

test("managed storefronts preserve mobile performance and hydrate without scroll gates", () => {
  assert.match(mainSource, /const MIN_BOOTSTRAP_MS = hasPrerenderedChrome \? 0 : 320/);
  assert.match(mainSource, /isFlagshipStorefront/);
  assert.match(mainSource, /isManagedStorefront/);
  assert.match(mainSource, /location\.hostname\.endsWith\("--superfunky\.netlify\.app"\)/);
  assert.doesNotMatch(mainSource, /FLAGSHIP_SHADOW_VISIT_KEY|FLAGSHIP_BACKGROUND_MOUNT_DELAY_MS/);
  assert.doesNotMatch(mainSource, /scheduleFlagshipShadowApplication|storefront-react-shadow-mount/);
  assert.match(mainSource, /else if \(isManagedStorefront\) \{/);
  assert.match(mainSource, /hasPreparedApplicationVisit = localStorage\.getItem\(RETURNING_PREPARATION_KEY\) === "1"/);
  assert.match(mainSource, /if \(hasPreparedApplicationVisit\) \{\s*document\.documentElement\.classList\.add\("storefront-instant-handoff"\);\s*requestReactActivation\(\)/);
  assert.match(mainSource, /COLD_DESKTOP_ACTIVATION_DELAY_MS = 2_500/);
  assert.match(mainSource, /if \(window\.matchMedia\("\(max-width: 767px\)"\)\.matches\) return/);
  assert.match(mainSource, /COLD_DESKTOP_ACTIVATION_DELAY_MS - \(performance\.now\(\) - bootstrapStartedAt\)/);
  assert.match(mainSource, /\[data-static-mobile-backdrop\]\.is-open, \.storefront-static-nav-item\.is-open/);
  assert.match(mainSource, /window\.setTimeout\(activateWhenStaticControlsIdle, 1_000\)/);
  assert.match(mainSource, /window\.requestIdleCallback\(activate, \{ timeout: 2_000 \}\)/);
  assert.match(mainSource, /scheduleManagedStorefrontActivation\(\)/);
  assert.match(appSource, /hasPendingVisibleContent/);
  assert.doesNotMatch(mainSource, /const preparationEvents = \[[^\]]*"wheel"/);
  assert.match(mainSource, /preparationEvents\.forEach\(\(eventName\) =>/);
  assert.match(mainSource, /target\?\.closest\("a\[href\]"\)\) return/);
  assert.match(mainSource, /\[data-storefront-activate\]/);
  assert.match(mainSource, /"pointerover", "focusin", "pointerdown"/);
  assert.match(mainSource, /initialRoot\.addEventListener\("click", activateStaticControl, true\)/);
  assert.match(mainSource, /performance\.mark\("storefront:activation-requested"\);\s*removePreparationListeners\(\)/);
  assert.match(mainSource, /const removeActivationListeners = \(\) => \{\s*removePreparationListeners\(\);/);
  assert.match(mainSource, /replayControlActivation\(\)/);
  assert.match(mainSource, /replayControlActivation\(attempt \+ 1\)/);
  assert.match(mainSource, /data-storefront-control=/);
  assert.match(prerenderSource, /data-static-control=.*data-storefront-activate/);
  assert.match(prerenderSource, /hasInteractiveStaticChrome/);
  assert.match(mainSource, /if \(!activationRequested\) activationScrollY = window\.scrollY/);
  assert.match(mainSource, /const handoffScrollY = activationScrollY/);
  assert.doesNotMatch(mainSource, /restoreHandoffScrollPosition\(targetScrollY, attempt \+ 1\)/);
  assert.match(mainSource, /restoreHandoffScrollPosition\(handoffScrollY, true\)/);
  assert.match(mainSource, /prerenderRoot\.replaceWith\(root\)/);
  assert.match(mainSource, /root\.style\.removeProperty\("top"\);\s*void root\.offsetHeight;\s*root\.removeAttribute\("inert"\);\s*root\.id = "root"/);
  assert.match(mainSource, /root\.style\.top = `\$\{Math\.max\(0, window\.scrollY \+ staticMain\.getBoundingClientRect\(\)\.top\)\}px`/);
  assert.match(mainSource, /activationRequested = true;\s*alignHiddenReactStage\(\);/);
  assert.doesNotMatch(mainSource, /prerenderRoot\.classList\.add\("is-replaced"\)/);
  assert.match(indexSource, /#storefront-react-root\[inert\] \{[\s\S]*display: block;[\s\S]*visibility: hidden;/);
  assert.match(mainSource, /resizeObserver\.observe\(root\)/);
  assert.match(mainSource, /stopTimer = setTimeout\(stop, 2_000\)/);
  assert.match(mainSource, /activationShortcodeAnchor/);
  assert.match(mainSource, /data-funkycommerce-shortcode=/);
  assert.match(mainSource, /\[data-prerendered-shortcode\]/);
  assert.match(mainSource, /section\.matches\('\[role="status"\]\[aria-label\^="Loading"\]'\)/);
  assert.match(mainSource, /\[role="status"\]\[aria-label\^="Loading"\]/);
  assert.match(mainSource, /rootMargin: "200px 0px"/);
  assert.match(mainSource, /dynamicSections\.forEach\(\(section\) => observer\.observe\(section\)\)/);
  assert.match(mainSource, /observeDynamicSections\(\);/);
  assert.match(mainSource, /data-generated-route-snapshot\]\[data-route-type\$="Product"/);
  assert.match(mainSource, /window\.requestAnimationFrame\(\(\) => requestReactActivation\(\)\)/);
  assert.match(mainSource, /const loadStaticHydrationPayloads = \(\) =>/);
  assert.match(
    mainSource,
    /const hydrationPayloads = loadStaticHydrationPayloads\(\);[\s\S]*Promise\.all\(\[[\s\S]*hydrationPayloads,[\s\S]*for \(const payload of payloads\)/,
  );
  assert.doesNotMatch(appSource, /!navigationRevalidating/);
  assert.doesNotMatch(appSource, /\}, 180\);\s*\};\s*const observer/);
});

test("client landing pages retain an idle hydration path without interactive controls", () => {
  assert.match(prerenderSource, /data-prerender-activation="idle"/);
  assert.match(mainSource, /const prerenderActivationMode = prerenderRoot/);
  assert.match(mainSource, /if \(prerenderActivationMode === "idle"\)/);
  assert.match(mainSource, /requestIdleCallback\(requestReactActivation, \{ timeout: 500 \}\)/);
  assert.match(mainSource, /DOMContentLoaded", scheduleIdleActivation/);
  assert.doesNotMatch(mainSource, /addEventListener\("load", scheduleIdleActivation/);
});

test("route loading covers the viewport while application styles settle", () => {
  assert.match(appSource, /fixed inset-0 z-\[2147483646\] grid min-h-\[100dvh\]/);
  assert.match(appSource, /bg-\[rgb\(var\(--theme-background,250_250_250\)\)\]/);
  assert.match(indexSource, /#storefront-bootstrap \{[\s\S]*?min-height: 100dvh;/);
});

test("a failed homepage refresh preserves the prerendered CMS snapshot", () => {
  assert.match(cmsPageSource, /if \(\(isLoading \|\| error\) && initialMarkup\)/);
  assert.match(cmsPageSource, /data-prerendered-cms-snapshot/);
});

test("the first prerendered language-switcher click is replayed after activation", () => {
  assert.match(mainSource, /prerenderRoot\.addEventListener\("click", activateLanguageSwitcher\)/);
  assert.match(mainSource, /requestReactActivation = \(event\?: Event \| IdleDeadline\)/);
  assert.match(mainSource, /\.storefront-static-switcher--language/);
  assert.match(mainSource, /pendingLanguageSwitcherActivation = true/);
  assert.match(mainSource, /requestAnimationFrame\(\(\) => replayLanguageSwitcherActivation/);
  assert.match(mainSource, /trigger\.click\(\)/);
  assert.match(mainSource, /prerenderRoot\?\.removeEventListener\("click", activateLanguageSwitcher\)/);
});

test("static header controls replay the matching React control", () => {
  assert.match(headerSource, /data-storefront-control="theme"[\s\S]{0,160}onClick=\{toggleDarkMode\}/);
  assert.match(headerSource, /data-storefront-control="push"[\s\S]{0,160}onClick=\{onPushToggle\}/);
  assert.match(headerSource, /data-storefront-control="cart"[\s\S]{0,160}onClick=\{handleCartTriggerClick\}/);
  assert.match(headerSource, /data-storefront-control="menu"[\s\S]{0,160}onClick=\{openMobileMenu\}/);
  assert.doesNotMatch(headerSource, /data-storefront-control="theme"[\s\S]{0,160}setIsSearchExpanded/);
  assert.equal(dropdownsSource.match(/data-storefront-control="currency"/g)?.length, 1);
  assert.match(dropdownsSource, /function CurrencySwitcher[\s\S]*data-storefront-control="currency"/);
  assert.match(prerenderSource, /<button type="button" class="storefront-static-switcher storefront-static-switcher--language"/);
  assert.match(prerenderSource, /data-static-control=".*" aria-hidden="true"/);
});

test("flagship static navigation supports submenus and breadcrumbs before activation", () => {
  assert.match(prerenderSource, /data-static-submenu-toggle/);
  assert.match(prerenderSource, /storefront-static-submenu/);
  assert.match(prerenderSource, /mapMenuItems\(items/);
  assert.match(prerenderSource, /getMegaMenuConfiguration\(item\.cssClasses/);
  assert.match(prerenderSource, /storefront-static-submenu-grid/);
  assert.match(prerenderSource, /storefront-static-menu-description/);
  assert.match(prerenderSource, /item\.linkRelationship/);
  assert.match(prerenderSource, /renderStaticMobileNavigation/);
  assert.match(prerenderSource, /data-static-mobile-expand/);
  assert.match(prerenderSource, /data-static-navigation-runtime/);
  assert.match(prerenderSource, /staticNavigationRuntimeSource/);
  assert.match(prerenderSource, /STATIC_HEADER_ASSISTANT_QUERY/);
  assert.doesNotMatch(prerenderSource, /storefront-static-control-placeholder/);
  assert.match(prerenderSource, /staticHeaderControl\("assistant"/);
  assert.match(prerenderSource, /renderStaticFloatingControls\(route\)/);
  assert.match(prerenderSource, /data-storefront-control="assistant-fixed"/);
  assert.match(prerenderSource, /data-storefront-control="\$\{escapeAttribute\(role\)\}"/);
  assert.match(prerenderSource, /synchronizeStaticAssistantWithHydrationSeed\(navigationResult\.value\)/);
  assert.match(prerenderSource, /configuration\?\.headerIcons\?\.assistant/);
  assert.match(prerenderSource, /data-static-cookie-banner/);
  assert.match(prerenderSource, /data-static-cookie-settings/);
  assert.match(prerenderSource, /storefront-static-header-row/);
  assert.match(prerenderSource, /storefront-static-header-nav-row/);
  assert.match(prerenderSource, /promoHtml: sanitizeCmsHtml/);
  assert.match(prerenderSource, /storefront-static-announcement.*staticChromeConfig\.promoHtml/);
  assert.match(prerenderSource, /storefront-static-announcement-content/);
  assert.match(prerenderSource, /renderStaticBreadcrumbs/);
  assert.match(prerenderSource, /route\.breadcrumbs/);
  assert.match(prerenderSource, /sanitizeCmsStyleAttribute\(decodeAttributeEntities\(value\)\)/);
  assert.match(prerenderSource, /showBreadcrumbs/);
  assert.match(prerenderSource, /announcementBarScrollEffect/);
  assert.match(prerenderSource, /data-static-announcement-scroll=/);
  assert.match(mainSource, /installStaticSubmenus\(prerenderRoot\)/);
  assert.match(mainSource, /installStaticMobileNavigation\(prerenderRoot\)/);
  assert.match(mainSource, /window\.__funkyStorefrontStaticNavigation/);
  assert.match(staticNavigationRuntimeSource, /container\.dataset\.staticNavigationReady = "true"/);
  assert.match(staticNavigationRuntimeSource, /mobileToggle\.addEventListener\("click"/);
  assert.match(staticNavigationRuntimeSource, /container\.addEventListener\("pointerover"/);
  assert.match(staticNavigationRuntimeSource, /--storefront-static-submenu-max-height/);
  assert.match(mainSource, /header\.dataset\.staticAnnouncementScroll !== "false"/);
  assert.match(mainSource, /header\.style\.setProperty\("--storefront-static-header-height", measuredHeight\)/);
  assert.match(mainSource, /\.storefront-static-mobile-backdrop/);
  assert.match(mainSource, /event\.key === "ArrowDown"/);
  assert.match(mainSource, /restoreFocus\?\.focus/);
  assert.match(mainSource, /event\.key !== "Tab"/);
  assert.match(headerSource, /const toggleMenu = \(\) =>/);
  assert.match(headerSource, /openedByClickRef/);
  assert.match(headerSource, /onClick=\{toggleMenu\}/);
  assert.match(headerSource, /dialogRef\.current\?\.querySelectorAll<HTMLElement>/);
  assert.match(headerSource, /previousFocusRef\.current\?\.focus/);
  assert.match(indexSource, /\.storefront-static-submenu \.storefront-static-submenu-column > a/);
  assert.match(indexSource, /\.storefront-static-submenu-entry:not\(\.storefront-static-submenu-column\) > \.storefront-static-menu-description/);
  assert.match(indexSource, /width: min\(calc\(100vw - 2rem\), calc\(var\(--storefront-static-menu-columns\) \* 13rem\)\)/);
  assert.match(indexSource, /top: calc\(100% \+ \.5rem\)/);
  assert.match(indexSource, /flex: 1 1 20rem/);
  assert.match(indexSource, /\.storefront-static-submenu-entry > a \{[\s\S]*overflow-wrap: anywhere/);
  assert.match(indexSource, /\.storefront-static-menu-description \{[\s\S]*overflow-wrap: anywhere/);
  assert.match(indexSource, /storefront-static-submenu:not\(\.storefront-static-submenu--mega\) > \.storefront-static-submenu-entry/);
  assert.match(headerSource, /"grid w-72 gap-1 overflow-y-auto p-2"/);
  assert.match(headerSource, /max-w-full break-words px-3 pb-2/);
  assert.match(headerSource, /Math\.min\(rect\.left, window\.innerWidth - width - viewportPadding\)/);
  assert.match(mainSource, /submenu\.style\.setProperty\("--storefront-static-submenu-left"/);
  assert.match(mainSource, /submenu\.style\.setProperty\("--storefront-static-submenu-max-width"/);
  assert.match(mainSource, /const observer = new IntersectionObserver/);
  assert.match(mainSource, /observer\.disconnect\(\)/);
  assert.match(mainSource, /cancelIdleCallback/);
  assert.match(prerenderSource, /renderStaticFooter\(route\)/);
  assert.match(prerenderSource, /storefront-static-footer/);
  assert.match(indexSource, /\.storefront-static-footer \{/);
  assert.match(mainSource, /activationRequested \|\| dynamicHydrationObserver/);
  assert.match(indexSource, /\.storefront-static-controls \{[\s\S]*justify-content: flex-end;[\s\S]*margin-left: auto;/);
  assert.match(indexSource, /\.storefront-static-header nav \{[\s\S]*flex-wrap: wrap;/);
  assert.match(indexSource, /row-gap: \.375rem/);
  assert.match(indexSource, /\.storefront-static-header-main \{[\s\S]*display: grid;[\s\S]*gap: \.75rem;/);
  assert.match(indexSource, /\.storefront-static-header-nav-row \{[\s\S]*padding-top: \.625rem/);
  assert.match(indexSource, /\.storefront-static-announcement :where\(p, ul, ol\)/);
  assert.match(indexSource, /\[data-static-react-parity\] \.storefront-static-header-nav-row/);
  assert.match(indexSource, /\.storefront-static-search \{[\s\S]*display: none/);
  assert.match(indexSource, /@media \(min-width: 1024px\) \{[\s\S]*\.storefront-static-search \{ display: flex; \}/);
  assert.match(headerSource, /ml-auto flex flex-wrap items-center justify-end gap-2/);
  assert.match(headerSource, /\[&_ol\]:m-0 \[&_p\]:m-0 \[&_ul\]:m-0/);
  assert.match(assistantSource, /reserveHeaderAction = themeConfig\.enabled && themeConfig\.showHeader/);
  assert.match(assistantSource, /const \[pendingOpen, setPendingOpen\] = useState\(false\)/);
  assert.match(assistantSource, /data-storefront-control="assistant-fixed"/);
  assert.doesNotMatch(assistantSource, /headerIconButtonClassName\} invisible/);
  assert.match(cookieConsentSource, /data-storefront-control="cookie-settings-banner"/);
  assert.match(cookieConsentSource, /data-storefront-control="cookie-accept-all"/);
  assert.match(cookieConsentSource, /data-storefront-control="cookie-settings"/);
  assert.match(headerSource, /style=\{\{ height: headerHeight \}\} className="shrink-0"/);
  assert.doesNotMatch(headerSource, /transition-\[height\]/);
  assert.match(indexSource, /\.storefront-static-mobile-backdrop\.is-open/);
  assert.match(indexSource, /max-height: var\(--storefront-static-submenu-max-height/);
  assert.doesNotMatch(indexSource, /transform: translateY\(-1rem\)/);
  assert.doesNotMatch(prerenderSource, /storefront-static-menu-columns:\$\{megaMenu\.columns\};width:/);
});

test("remembered user and commerce state restore outside the critical render path", () => {
  assert.match(authSource, /useBackgroundAuthSnapshot/);
  assert.match(authSource, /requestIdleCallback\(loadSnapshot, \{ timeout: 1_000 \}\)/);
  assert.match(cartStateSource, /useEffect\(\(\) => \{[\s\S]*readStoredCartItems/);
  assert.match(savedCollectionSource, /useEffect\(\(\) => \{[\s\S]*window\.localStorage\.getItem\(storageKey\)/);
  assert.match(savedCollectionSource, /enqueue\(accountScope, async \(\) =>/);
});

test("the service worker has a single application-owned registration path", () => {
  assert.doesNotMatch(indexSource, /register-service-worker\.js/);
  assert.match(mainSource, /registerServiceWorker/);
});

test("intent prefetch warms documents while navigations prefer current deploys", () => {
  assert.match(routePrefetchSource, /warmStorefrontDocument/);
  assert.match(documentWarmupSource, /headers: \{ Accept: "text\/html" \}/);
  assert.match(documentWarmupSource, /credentials: "same-origin"/);
  assert.match(mainSource, /installStaticDocumentWarmup\(prerenderRoot\)/);
  assert.doesNotMatch(documentWarmupSource, /warmIdleDocuments|maximumIdleDocuments/);
  assert.match(documentWarmupSource, /warmedAssets\.get\(href\)/);
  assert.doesNotMatch(documentWarmupSource, /link\.target === "_blank"/);
  assert.match(documentWarmupSource, /addEventListener\("pointerdown", warmFromIntent/);
  assert.match(documentWarmupSource, /addEventListener\("touchstart", warmFromIntent/);
  assert.match(serviceWorkerSource, /navigationPreload\?\.enable\(\)/);
  assert.match(serviceWorkerSource, /Promise\.resolve\(event\.preloadResponse\)/);
  assert.match(serviceWorkerSource, /caches\.match\(request, \{ ignoreVary: true \}\)/);
  assert.match(serviceWorkerSource, /network\.catch\(async \(\) =>/);
  assert.doesNotMatch(serviceWorkerSource, /if \(!cached\) return network;/);
  assert.match(serviceWorkerSource, /__FUNKYCOMMERCE_BUILD_VERSION__/);
  assert.match(prerenderSource, /process\.env\.NETLIFY === "true"/);
  assert.match(prerenderSource, /stampServiceWorkerVersion\(generatedAt\)/);
});

test("generated static HTML omits the loader and keeps styles render-blocking", () => {
  const html = '<head><link rel="stylesheet" href="/assets/app.css"></head><body><div id="storefront-bootstrap">Loading</div><noscript>fallback</noscript><div id="root">static</div></body>';
  const stripped = stripBootstrapOverlay(html);
  assert.doesNotMatch(stripped, /storefront-bootstrap/);
  assert.match(stripped, /<link rel="stylesheet" href="\/assets\/app\.css">/);
  assert.doesNotMatch(stripped, /data-storefront-deferred-style|media="print"/);
  assert.match(mainSource, /hasPrerenderedChrome \? domReady : initialVisualsReady/);
  assert.match(prerenderSource, /<link rel="stylesheet" href=.*data-wordpress-static-style-source=/);
  assert.match(prerenderSource, /<link rel="preload" as="style"/);
  assert.match(prerenderSource, /const heroSrcSet = decodeAttributeEntities/);
  assert.doesNotMatch(prerenderSource, /staticStyleAsset\?\.inlineCss/);
});

test("flagship theme state and React-parity chrome apply before first paint", () => {
  const themeScriptIndex = indexSource.indexOf('localStorage.getItem("funkycommerce-mockup-theme")');
  const criticalStyleIndex = indexSource.indexOf("<style>");
  assert.ok(themeScriptIndex > 0 && themeScriptIndex < criticalStyleIndex);
  assert.match(indexSource, /document\.documentElement\.classList\.toggle\("dark", nextDark\)/);
  assert.match(indexSource, /document\.documentElement\.style\.colorScheme = nextDark \? "dark" : "light"/);
  assert.match(indexSource, /data-static-theme-toggle/);
  assert.match(indexSource, /funky:storefront-theme-change/);
  assert.match(prerenderSource, /data-static-theme-toggle aria-pressed="false"/);
  assert.doesNotMatch(prerenderSource, /data-static-theme-toggle[^>]*data-storefront-activate/);
  assert.match(mainSource, /installStaticHeaderBehavior\(prerenderRoot\)/);
  assert.match(mainSource, /data-static-header-spacer/);
  assert.match(indexSource, /\.storefront-static-header-spacer/);
  assert.match(indexSource, /data-storefront-flagship/);
  assert.match(indexSource, /\.dark #root\.storefront-prerender-stage/);
  assert.match(indexSource, /\.dark \[data-static-react-parity\] \.storefront-static-search/);
  assert.match(indexSource, /\[data-static-react-parity\] \.storefront-static-brand strong/);
  assert.match(indexSource, /\.dark \[data-static-react-parity\] \.storefront-static-control/);
  assert.match(prerenderSource, /data-static-react-parity/);
  assert.match(prerenderSource, /data-storefront-flagship/);
  assert.match(prerenderSource, /createWordPressElementTypographyCss\(styles\.globalStyles\)/);
  assert.match(prerenderSource, /themeMaxWidthPx/);
  assert.match(prerenderSource, /--storefront-static-max-width:\$\{themeMaxWidthPx\}px/);
  assert.match(indexSource, /max-width: var\(--storefront-static-max-width, 1280px\)/);
  assert.match(indexSource, /\.storefront-static-header nav a \{[\s\S]*line-height: 1\.25rem/);
});

test("first-paint video heroes and product galleries preserve their full geometry", () => {
  assert.match(
    storefrontStylesSource,
    /shortcode-prerender-hero--fullbleed\[data-prerendered-shortcode="video-hero"\]:not\(\[data-prerender-min-height\]\)[\s\S]*height: 100dvh;[\s\S]*min-height: 100dvh;/,
  );
  assert.match(
    storefrontStylesSource,
    /\[data-funkycommerce-render-slot\]\[data-funkycommerce-fullwidth="true"\][\s\S]*:where\([\s\S]*\.sf-hero img,[\s\S]*\.sf-hero video,[\s\S]*\.wp-block-cover__image-background,[\s\S]*\.wp-block-cover__video-background/,
  );
  assert.match(
    storefrontStylesSource,
    /\.shortcode-prerender-hero__image \{[\s\S]*block-size: 100% !important;[\s\S]*inline-size: 100% !important;[\s\S]*object-fit: cover !important;/,
  );
  assert.match(
    storefrontStylesSource,
    /\.shortcode-prerender-hero--fullbleed\[data-prerendered-shortcode="video-hero"\] \{[\s\S]*inline-size: 100vw !important;[\s\S]*margin-inline: calc\(50% - 50vw\) !important;/,
  );
  assert.match(
    productCardSource,
    /className="flex max-w-full snap-x snap-mandatory gap-1\.5 overflow-x-auto overscroll-x-contain px-0\.5 pb-1 pt-0\.5"/,
  );
});

test("interactive activation shows a bounded delayed loader without shifting the SSG page", () => {
  assert.match(mainSource, /activationStatusTimer = window\.setTimeout/);
  assert.match(mainSource, /if \(reactVisibleReady \|\| !waitingControl\) return/);
  assert.match(mainSource, /}, 250\)/);
  assert.match(mainSource, /showInteractionLoader\(\)/);
  assert.match(mainSource, /showInteractionFailure\(\)/);
  assert.match(mainSource, /dismissInteractionLoader\(\)/);
  assert.match(mainSource, /waitingControl\?\.classList\.remove\("storefront-control-waiting"\)/);
  assert.match(indexSource, /\.storefront-control-waiting \{/);
  assert.match(indexSource, /\.storefront-interaction-loader \{[\s\S]*pointer-events: none;[\s\S]*position: fixed;/);
  assert.match(indexSource, /\.storefront-interaction-loader\.is-error/);
});

test("non-zero reload waits for fonts before revealing the restored viewport", () => {
  assert.match(mainSource, /const SCROLL_RELOAD_STATE_KEY = "storefront:scroll-reload-state"/);
  assert.match(mainSource, /window\.addEventListener\("pagehide"/);
  assert.match(mainSource, /navigationEntry\?\.type === "reload"/);
  assert.match(mainSource, /savedReloadScrollY > 0/);
  assert.match(mainSource, /const RELOAD_FONT_SETTLE_TIMEOUT_MS = 3_000/);
  assert.match(mainSource, /const reloadFontsReady = Promise\.race/);
  assert.match(mainSource, /document\.visibilityState === "hidden"/);
  assert.match(mainSource, /window\.scrollTo\(\{ top: savedReloadScrollY, behavior: "auto" \}\)/);
  assert.match(indexSource, /\.storefront-scroll-restore-pending #root \{[\s\S]*?visibility: hidden/);
  assert.match(indexSource, /\.storefront-scroll-reload-status \{/);
});

test("interaction intent prepares code without replacing the SSG document", () => {
  assert.match(mainSource, /window\.addEventListener\(eventName, requestReactPreparation/);
  assert.match(mainSource, /function requestReactPreparation\(event: Event\)/);
  assert.match(mainSource, /void prepareApplication\(\)/);
  assert.doesNotMatch(mainSource, /window\.addEventListener\(eventName, requestReactActivation/);
  assert.match(mainSource, /localStorage\.getItem\(RETURNING_PREPARATION_KEY\)/);
  assert.match(mainSource, /window\.requestIdleCallback\(prepare/);
  assert.doesNotMatch(mainSource, /dynamicObserverIdleCallback/);
  assert.match(mainSource, /observeDynamicSections\(\);/);
});

test("fleet prerendered CMS content mounts lightweight native behaviors while idle", () => {
  assert.match(mainSource, /if \(!isFlagshipStorefront\) \{[\s\S]*import\("\.\/lib\/cmsBehaviors"\)/);
  assert.match(mainSource, /mountCmsBehaviors\(content\)/);
  assert.match(mainSource, /stopStaticCmsBehaviors\(\)/);
  assert.match(mainSource, /Static CMS behaviors could not be loaded/);
});

test("developer and fleet sites receive bounded automatic hydration", () => {
  assert.match(mainSource, /configuredHostname\.endsWith\("\.superfunky\.pro"\)/);
  assert.match(mainSource, /import\.meta\.env\.VITE_GRAPHQL_ENDPOINT/);
  assert.match(mainSource, /configuredBackendHostname\.endsWith\("\.superfunky\.pro"\)/);
  assert.match(mainSource, /location\.hostname\.endsWith\("\.superfunky\.pro"\)/);
  assert.match(mainSource, /location\.hostname\.endsWith\("\.netlify\.app"\)/);
  assert.match(mainSource, /scheduleManagedStorefrontActivation/);
  assert.doesNotMatch(mainSource, /developerActivationEvents|activateDeveloperApplication/);
  assert.match(prerenderSource, /const hasInteractiveStaticChrome = \[configuredSiteHostname, configuredBackendHostname\]/);
  assert.match(prerenderSource, /const mobileNavigation = hasInteractiveStaticChrome/);
  assert.doesNotMatch(appSource, /isGeneratedHome && generatedPayload && !Object\.values\(requirements\)\.some\(Boolean\)/);
  assert.match(appSource, /<CommunityDataProvider[\s\S]*enabled=\{enabled && requirements\.community\}/);
});

test("service worker does not precache deployment-racy HTML", () => {
  assert.doesNotMatch(serviceWorkerSource, /APP_SHELL_URLS = \["\/"/);
  assert.doesNotMatch(serviceWorkerSource, /caches\.match\("\/"\)/);
});

test("fleet media origins use the shared image optimization pipeline", () => {
  assert.match(prerenderSource, /const isUnsplashImage = mediaUrl\.hostname === "images\.unsplash\.com"/);
  assert.match(cmsBehaviorsSource, /const isUnsplashImage = mediaUrl\.hostname === "images\.unsplash\.com"/);
  assert.match(netlifySource, /\(\?:v\[0-9\]\+\|dev\|blog\|shop\|sample\)/);
  assert.match(netlifySource, /images\\\\\.unsplash\\\\\.com/);
});

test("core CMS navigation remains split out of the static-first bundle", () => {
  assert.match(appSource, /const ContentNodeRoute = lazy/);
  assert.doesNotMatch(appSource, /void loadContentNodeRoute\(\)/);
  assert.doesNotMatch(smartLinksSource, /startTransition/);
});

test("remembered authentication refreshes only after paint and never gates content", () => {
  assert.match(authSource, /const initialCheck = window\.setTimeout\(refreshIfNeeded, 0\)/);
  assert.match(authSource, /if \(shouldRefresh\) void performRefresh\(\)/);
  assert.match(authSource, /document\.addEventListener\("visibilitychange", handleVisibility\)/);
  assert.doesNotMatch(appSource, /StorefrontVisibleReadySignal[\s\S]{0,1000}(?:auth|accountId)/);
});
