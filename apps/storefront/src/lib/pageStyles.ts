import type { CmsThemeStyles } from "./pages";

type MountedStyle = {
  count: number;
  element: HTMLLinkElement | HTMLStyleElement;
};

const mountedStyles = new Map<string, MountedStyle>();
const MAX_THEME_FONT_FACES = 8;
const MAX_WORDPRESS_STYLESHEETS = 2;
const FONT_PROXY_VERSIONS = new Set(["2", "3"]);
const WORDPRESS_TYPOGRAPHY_PROPERTIES = new Set([
  "column-count",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "letter-spacing",
  "line-height",
  "text-decoration",
  "text-indent",
  "text-transform",
  "writing-mode",
]);
const WORDPRESS_TEXT_MARGIN_PROPERTIES = new Set([
  "margin",
  "margin-block",
  "margin-block-end",
  "margin-block-start",
  "margin-bottom",
  "margin-top",
]);

export const WORDPRESS_BLOCK_COMPATIBILITY_CSS = `
.wp-site-blocks.entry-content {
  --wp--style--global--content-size: var(--funky-content-max-width, 1280px);
  display: flow-root !important;
  max-width: 100% !important;
  min-width: 0 !important;
  width: 100% !important;
}

.wp-site-blocks.entry-content > * {
  box-sizing: border-box;
}

.wp-site-blocks.entry-content > * + * {
  margin-block-start: var(--wp--style--block-gap, 1rem);
}

:where(.wp-site-blocks.entry-content h1, .wp-site-blocks.entry-content h2, .wp-site-blocks.entry-content h3, .wp-site-blocks.entry-content h4, .wp-site-blocks.entry-content h5, .wp-site-blocks.entry-content h6):not([style*="margin"]) {
  margin-block: 0.5em 0.3em;
}

:where(.wp-site-blocks.entry-content p):not([style*="margin"]) {
  margin-block: 0.35em;
}

.wp-site-blocks.entry-content .has-text-align-left {
  text-align: left !important;
}

.wp-site-blocks.entry-content .has-text-align-center {
  text-align: center !important;
}

.wp-site-blocks.entry-content .has-text-align-right {
  text-align: right !important;
}

.wp-site-blocks.entry-content .has-text-align-justify {
  text-align: justify !important;
}

.wp-site-blocks.entry-content .wp-block-image.aligncenter > :where(img, a > img) {
  margin-inline: auto;
}

.wp-site-blocks.entry-content .alignleft {
  float: left !important;
  margin-inline: 0 1.5rem !important;
  margin-block: 0.5rem 1rem !important;
}

.wp-site-blocks.entry-content .alignright {
  float: right !important;
  margin-inline: 1.5rem 0 !important;
  margin-block: 0.5rem 1rem !important;
}

.wp-site-blocks.entry-content > .alignwide,
.wp-site-blocks.entry-content > .wp-content-fragment > .alignwide {
  clear: both;
  inline-size: min(var(--funky-shell-inner-width), calc(100vw - (2 * var(--funky-shell-gutter)))) !important;
  margin-inline: calc((100% - min(var(--funky-shell-inner-width), calc(100vw - (2 * var(--funky-shell-gutter))))) / 2) !important;
  max-inline-size: none !important;
}

.wp-site-blocks.entry-content > .alignfull,
.wp-site-blocks.entry-content > .wp-content-fragment > .alignfull {
  clear: both;
  inline-size: 100vw !important;
  margin-inline: calc(50% - 50vw) !important;
  max-inline-size: none !important;
}

@supports (inline-size: 100cqi) {
  .wp-site-blocks.entry-content > .alignwide,
  .wp-site-blocks.entry-content > .wp-content-fragment > .alignwide {
    inline-size: min(var(--funky-shell-inner-width), calc(100cqi - (2 * var(--funky-shell-gutter)))) !important;
    margin-inline: calc((100% - min(var(--funky-shell-inner-width), calc(100cqi - (2 * var(--funky-shell-gutter))))) / 2) !important;
  }

  .wp-site-blocks.entry-content > .alignfull,
  .wp-site-blocks.entry-content > .wp-content-fragment > .alignfull {
    inline-size: 100cqi !important;
    margin-inline: calc(50% - 50cqi) !important;
  }
}

.wp-site-blocks.entry-content .alignfull .alignfull {
  inline-size: 100% !important;
  margin-inline: 0 !important;
  max-inline-size: 100% !important;
}

.wp-site-blocks.entry-content .alignfull .alignwide {
  margin-inline: auto !important;
}

.wp-site-blocks.entry-content :where(main, .container) {
  box-sizing: border-box !important;
  margin-inline: 0 !important;
  max-width: 100% !important;
  min-width: 0 !important;
  overflow: visible !important;
  padding-inline: 0 !important;
  width: 100% !important;
}

.wp-site-blocks.entry-content {
  min-width: 0;
  overflow-wrap: anywhere;
}

.wp-site-blocks.entry-content :where(.wp-content-fragment, .wp-block-group, .wp-block-columns, .wp-block-column, .wp-block-media-text) {
  min-width: 0;
}

.wp-site-blocks.entry-content pre {
  max-width: 100%;
  overflow-x: auto;
  overflow-wrap: normal;
  white-space: pre;
  word-break: normal;
}

.wp-site-blocks.entry-content code {
  display: inline-block;
  max-width: 100%;
  overflow-x: auto;
  overflow-wrap: normal;
  vertical-align: bottom;
  white-space: pre;
  word-break: normal;
}

.wp-site-blocks.entry-content pre > code {
  display: block;
  max-width: none;
  overflow: visible;
}

.wp-site-blocks.entry-content table {
  display: block;
  max-width: 100%;
  overflow-x: auto;
}

:where(.wp-site-blocks.entry-content .wp-block-group.is-layout-constrained > :not(.alignwide):not(.alignfull)) {
  box-sizing: border-box;
  max-inline-size: var(--wp--style--global--content-size, var(--funky-content-max-width, 1280px));
  max-width: var(--wp--style--global--content-size, var(--funky-content-max-width, 1280px));
  margin-inline: auto;
}

:where(.wp-site-blocks.entry-content .wp-block-group.is-layout-constrained > .alignwide) {
  box-sizing: border-box;
  inline-size: min(100%, var(--wp--style--global--wide-size, 1200px));
  max-inline-size: var(--wp--style--global--wide-size, 1200px);
  max-width: var(--wp--style--global--wide-size, 1200px);
  margin-inline: auto;
}

:where(.wp-site-blocks.entry-content .wp-block-cover__inner-container.is-layout-constrained > :not(.alignwide):not(.alignfull)) {
  box-sizing: border-box;
  max-inline-size: var(--wp--style--global--content-size, var(--funky-content-max-width, 1280px));
  max-width: var(--wp--style--global--content-size, var(--funky-content-max-width, 1280px));
  margin-inline: auto;
}

:where(.wp-site-blocks.entry-content .wp-block-cover__inner-container.is-layout-constrained > .alignwide) {
  box-sizing: border-box;
  inline-size: min(100%, var(--wp--style--global--wide-size, 1200px));
  max-inline-size: var(--wp--style--global--wide-size, 1200px);
  max-width: var(--wp--style--global--wide-size, 1200px);
  margin-inline: auto;
}

.wp-site-blocks.entry-content .wp-block-cover__inner-container {
  box-sizing: border-box;
  margin-inline: auto;
  max-inline-size: var(--wp--style--global--content-size, var(--funky-content-max-width, 1280px));
  padding-left: var(--wp--style--root--padding-left, var(--funky-shell-gutter, 1rem));
  padding-right: var(--wp--style--root--padding-right, var(--funky-shell-gutter, 1rem));
}

:where(.wp-site-blocks.entry-content .wp-block-group > .alignfull) {
  inline-size: 100%;
  max-inline-size: none;
  max-width: none;
  margin-inline: 0;
}

.wp-site-blocks.entry-content :where(img, video, iframe) {
  max-width: 100%;
}

.wp-site-blocks.entry-content :where(img, video) {
  height: auto;
}

.wp-site-blocks.entry-content :where(.wp-block-image.alignfull > img, .wp-block-video.alignfull > video) {
  display: block;
  inline-size: 100%;
  max-inline-size: 100%;
}

.wp-site-blocks.entry-content :where(figure, .wp-block-image, .wp-block-embed) {
  margin-inline: 0;
}

.wp-site-blocks.entry-content :where(figcaption, .wp-element-caption) {
  color: currentColor;
  font-size: 0.875em;
  margin-block-start: 0.5rem;
  text-align: center;
}

.wp-site-blocks.entry-content .alignfull > :where(figcaption, .wp-element-caption) {
  box-sizing: border-box;
  inline-size: min(var(--funky-shell-inner-width), calc(100% - (2 * var(--funky-shell-gutter))));
  margin-inline: auto;
}

.wp-site-blocks.entry-content :where(.wp-block-group, .wp-block-cover, .wp-block-media-text) {
  box-sizing: border-box;
}

.wp-site-blocks.entry-content
  .wp-block-cover:not([style*="border-radius"]):not([style*="border-top-left-radius"]):not([style*="border-top-right-radius"]):not([style*="border-bottom-left-radius"]):not([style*="border-bottom-right-radius"]) {
  border-radius: var(--theme-radius);
}

.wp-site-blocks.entry-content
  .wp-block-cover
  > :where(
    .wp-block-cover__image-background,
    .wp-block-cover__video-background,
    .wp-block-cover__background,
    .wp-block-cover__gradient-background
  ) {
  border-radius: inherit !important;
}

.wp-site-blocks.entry-content .is-layout-flex {
  display: flex;
}

:where(.wp-site-blocks.entry-content .is-layout-flex) {
  flex-wrap: wrap;
}

.wp-site-blocks.entry-content .is-layout-flex.is-vertical {
  flex-direction: column;
}

.wp-site-blocks.entry-content .is-layout-flex.is-nowrap {
  flex-wrap: nowrap;
}

.wp-site-blocks.entry-content .is-layout-grid {
  display: grid;
}

:where(.wp-site-blocks.entry-content .is-layout-grid) {
  min-inline-size: 0;
  grid-template-columns: repeat(auto-fit, minmax(min(12rem, 100%), 1fr));
}

:where(.wp-site-blocks.entry-content .is-layout-flex, .wp-site-blocks.entry-content .is-layout-grid) {
  gap: var(--wp--style--block-gap, 1rem);
}

.wp-site-blocks.entry-content .is-layout-flex:not(.is-vertical).is-content-justification-left {
  justify-content: flex-start;
}

.wp-site-blocks.entry-content .is-layout-flex:not(.is-vertical).is-content-justification-center {
  justify-content: center;
}

.wp-site-blocks.entry-content .is-layout-flex:not(.is-vertical).is-content-justification-right {
  justify-content: flex-end;
}

.wp-site-blocks.entry-content .is-layout-flex:not(.is-vertical).is-content-justification-space-between {
  justify-content: space-between;
}

.wp-site-blocks.entry-content .is-layout-flex.is-vertical.is-content-justification-left {
  align-items: flex-start;
}

.wp-site-blocks.entry-content .is-layout-flex.is-vertical.is-content-justification-center {
  align-items: center;
}

.wp-site-blocks.entry-content .is-layout-flex.is-vertical.is-content-justification-right {
  align-items: flex-end;
}

.wp-site-blocks.entry-content .is-layout-flex.is-vertical.is-content-justification-stretch {
  align-items: stretch;
}

.wp-site-blocks.entry-content .is-layout-flex:not(.is-vertical).are-vertically-aligned-top {
  align-items: flex-start;
}

.wp-site-blocks.entry-content .is-layout-flex:not(.is-vertical).are-vertically-aligned-center {
  align-items: center;
}

.wp-site-blocks.entry-content .is-layout-flex:not(.is-vertical).are-vertically-aligned-bottom {
  align-items: flex-end;
}

.wp-site-blocks.entry-content .is-layout-flex.is-vertical.are-vertically-aligned-top {
  justify-content: flex-start;
}

.wp-site-blocks.entry-content .is-layout-flex.is-vertical.are-vertically-aligned-center {
  justify-content: center;
}

.wp-site-blocks.entry-content .is-layout-flex.is-vertical.are-vertically-aligned-bottom {
  justify-content: flex-end;
}

.wp-site-blocks.entry-content .is-layout-flex.is-vertical.are-vertically-aligned-space-between {
  justify-content: space-between;
}

.wp-site-blocks.entry-content .wp-block-columns {
  align-items: normal;
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap !important;
  gap: var(--wp--style--block-gap, 1.5rem);
}

.wp-site-blocks.entry-content .wp-block-columns.is-not-stacked-on-mobile {
  flex-wrap: nowrap !important;
}

.wp-site-blocks.entry-content .wp-block-column {
  flex-basis: 0;
  flex-grow: 1;
  min-width: 0;
  overflow-wrap: break-word;
  word-break: break-word;
}

.wp-site-blocks.entry-content :where(
  [data-funkycommerce-render-slot],
  [data-rendered-cms-shortcode]
) {
  box-sizing: border-box;
  max-inline-size: 100%;
  min-inline-size: 0;
}

.wp-site-blocks.entry-content .wp-block-buttons {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.wp-site-blocks.entry-content :where(.wp-block-button__link, .wp-element-button) {
  cursor: pointer;
  display: inline-block;
  text-align: center;
  text-decoration: none !important;
}

.wp-site-blocks.entry-content .wp-block-button:not(.is-style-outline):not([class*="is-style-outline--"]) > :where(.wp-block-button__link, .wp-element-button):not(.is-style-outline):not([class*="is-style-outline--"]):not(.has-background) {
  background-color: rgb(var(--brand-600)) !important;
  border-color: rgb(var(--brand-600)) !important;
  color: #fff !important;
}

.wp-site-blocks.entry-content :is(
  .wp-block-button:is(.is-style-outline, [class*="is-style-outline--"]) > :where(.wp-block-button__link, .wp-element-button),
  .wp-block-button > :is(.wp-block-button__link, .wp-element-button):is(.is-style-outline, [class*="is-style-outline--"])
) {
  background-color: transparent !important;
  border-color: rgb(var(--brand-600)) !important;
  border-style: solid !important;
  border-width: 1px !important;
  color: rgb(var(--brand-600)) !important;
  text-decoration: none !important;
}

.wp-site-blocks.entry-content :where(.wp-block-button__link, .wp-element-button):is(:hover, :focus, :active, :visited) {
  text-decoration: none !important;
}

.wp-site-blocks.entry-content :where(
  .wp-block-button__link,
  .wp-element-button,
  button,
  input[type="button"],
  input[type="submit"],
  input[type="reset"]
):not([style*="border-radius"]):not([class*="rounded-"]):not(.has-border-radius):not([class*="-border-radius"]):not([data-funky-preserve-radius]) {
  border-radius: var(--theme-radius);
}

.wp-site-blocks.entry-content .wp-block-gallery {
  align-items: normal;
  display: flex;
  flex-wrap: wrap;
  gap: var(--wp--style--block-gap, 1rem);
  list-style: none;
  padding: 0;
}

.wp-site-blocks.entry-content .wp-block-gallery > figure {
  flex-grow: 1;
  margin: 0;
}

.wp-site-blocks.entry-content .wp-block-cover {
  align-items: center;
  display: flex;
  justify-content: center;
  min-height: 430px;
  overflow: hidden;
  position: relative;
}

.wp-site-blocks.entry-content .wp-block-cover__image-background,
.wp-site-blocks.entry-content .wp-block-cover__video-background {
  height: 100%;
  inset: 0;
  object-fit: cover;
  position: absolute;
  width: 100%;
  z-index: 0;
}

.wp-site-blocks.entry-content .wp-block-cover__background {
  inset: 0;
  opacity: 0.5;
  position: absolute;
}

.wp-site-blocks.entry-content .wp-block-cover__background.has-background-dim:not([class*="-background-color"]) {
  background-color: #000;
}

.wp-site-blocks.entry-content .wp-block-cover__background.has-background-gradient {
  background-color: transparent;
}

.wp-site-blocks.entry-content .wp-block-cover__background.has-background-dim-0 { opacity: 0; }
.wp-site-blocks.entry-content .wp-block-cover__background.has-background-dim-10 { opacity: 0.1; }
.wp-site-blocks.entry-content .wp-block-cover__background.has-background-dim-20 { opacity: 0.2; }
.wp-site-blocks.entry-content .wp-block-cover__background.has-background-dim-30 { opacity: 0.3; }
.wp-site-blocks.entry-content .wp-block-cover__background.has-background-dim-40 { opacity: 0.4; }
.wp-site-blocks.entry-content .wp-block-cover__background.has-background-dim-50 { opacity: 0.5; }
.wp-site-blocks.entry-content .wp-block-cover__background.has-background-dim-60 { opacity: 0.6; }
.wp-site-blocks.entry-content .wp-block-cover__background.has-background-dim-70 { opacity: 0.7; }
.wp-site-blocks.entry-content .wp-block-cover__background.has-background-dim-80 { opacity: 0.8; }
.wp-site-blocks.entry-content .wp-block-cover__background.has-background-dim-90 { opacity: 0.9; }
.wp-site-blocks.entry-content .wp-block-cover__background.has-background-dim-100 { opacity: 1; }

.wp-site-blocks.entry-content .wp-block-cover__inner-container {
  position: relative;
  width: 100%;
  z-index: 1;
}

.wp-site-blocks.entry-content .wp-block-media-text {
  display: grid;
  grid-template-columns: 50% 1fr;
  grid-template-rows: auto;
}

.wp-site-blocks.entry-content .wp-block-media-text.has-media-on-the-right {
  grid-template-columns: 1fr 50%;
}

.wp-site-blocks.entry-content .wp-block-media-text__media {
  grid-column: 1;
  grid-row: 1;
  margin: 0;
}

.wp-site-blocks.entry-content .wp-block-media-text__content {
  align-self: center;
  direction: ltr;
  grid-column: 2;
  grid-row: 1;
  padding: 0 8%;
  word-break: break-word;
}

.wp-site-blocks.entry-content .wp-block-media-text.has-media-on-the-right .wp-block-media-text__media {
  grid-column: 2;
}

.wp-site-blocks.entry-content .wp-block-media-text.has-media-on-the-right .wp-block-media-text__content {
  grid-column: 1;
}

.wp-site-blocks.entry-content :where(.wp-block-table, .wp-block-table table) {
  width: 100%;
}

.wp-site-blocks.entry-content .wp-block-table {
  overflow-x: auto;
}

.wp-site-blocks.entry-content .wp-block-table table {
  border-collapse: collapse;
}

.wp-site-blocks.entry-content .wp-block-separator {
  border: 0;
  border-top: 2px solid currentColor;
  clear: both;
}

.wp-site-blocks.entry-content .wp-block-spacer {
  clear: both;
}

.wp-site-blocks.entry-content .screen-reader-text {
  border: 0;
  clip-path: inset(50%);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  width: 1px;
  word-wrap: normal !important;
}

@media (max-width: 781px) {
  .wp-site-blocks.entry-content .wp-block-columns:not(.is-not-stacked-on-mobile) > .wp-block-column {
    flex-basis: 100% !important;
  }

  .wp-site-blocks.entry-content .wp-block-media-text.is-stacked-on-mobile {
    grid-template-columns: 100% !important;
  }

  .wp-site-blocks.entry-content .wp-block-media-text.is-stacked-on-mobile .wp-block-media-text__media,
  .wp-site-blocks.entry-content .wp-block-media-text.is-stacked-on-mobile .wp-block-media-text__content {
    grid-column: 1 !important;
  }

  .wp-site-blocks.entry-content .wp-block-media-text.is-stacked-on-mobile .wp-block-media-text__media {
    grid-row: 1;
  }

  .wp-site-blocks.entry-content .wp-block-media-text.is-stacked-on-mobile .wp-block-media-text__content {
    grid-row: 2;
  }

  .wp-site-blocks.entry-content :where(.alignleft, .alignright) {
    float: none !important;
    margin-inline: 0 !important;
    max-width: 100%;
  }
}

@media (min-width: 782px) {
  .wp-site-blocks.entry-content .wp-block-columns {
    flex-wrap: nowrap !important;
  }
}
`;

export function mountPageStyles(styles: CmsThemeStyles | null | undefined, trustedBackendUrl?: string): () => void {
  const keys = [
    mountInlineStyle("wordpress-font-faces", sanitizeWordPressFontFaces(styles?.fontFaceStyles || "")),
    mountInlineStyle("wordpress-global-styles", sanitizeWordPressGlobalStyles(styles?.globalStyles || "")),
    // Core block styles must follow global element defaults so variants such as
    // Button "Outline" can override the generic button background and border.
    ...sanitizeWordPressStylesheetUrls(styles?.stylesheets || [], trustedBackendUrl).map(mountStylesheet),
    mountInlineStyle("wordpress-custom-css", styles?.customCss || ""),
    // Always mounted last so block semantics survive Tailwind and theme collisions.
    mountInlineStyle("wordpress-block-compatibility", WORDPRESS_BLOCK_COMPATIBILITY_CSS, true),
  ].filter((key): key is string => Boolean(key));
  orderMountedPageStyles();

  return () => {
    keys.forEach((key) => {
      const mounted = mountedStyles.get(key);
      if (!mounted) return;
      mounted.count -= 1;
      if (mounted.count > 0) return;
      mounted.element.remove();
      mountedStyles.delete(key);
    });
  };
}

export function sanitizeWordPressStylesheetUrls(urls: string[], trustedBackendUrl?: string): string[] {
  if (!trustedBackendUrl) return [];

  let trustedOrigin: string;
  try {
    trustedOrigin = new URL(trustedBackendUrl).origin;
  } catch {
    return [];
  }

  const accepted = new Set<string>();
  for (const value of urls) {
    if (accepted.size >= MAX_WORDPRESS_STYLESHEETS) break;
    try {
      const url = new URL(value);
      const parameters = Array.from(url.searchParams.keys());
      if (
        url.protocol !== "https:"
        || url.origin !== trustedOrigin
        || url.username
        || url.password
        || url.hash
        || !/\/wp-includes\/css\/dist\/block-library\/(?:style|theme)\.min\.css$/.test(url.pathname)
        || parameters.length !== 1
        || parameters[0] !== "ver"
        || !/^\d+(?:\.\d+){1,3}$/.test(url.searchParams.get("ver") || "")
      ) {
        continue;
      }
      accepted.add(url.href);
    } catch {
      // Invalid stylesheet URLs are not mounted.
    }
  }
  return Array.from(accepted);
}

export function sanitizeWordPressFontFaces(css: string): string {
  const faces: string[] = [];
  const descriptors = new Set<string>();

  for (const match of css.matchAll(/@font-face\s*\{([^{}]*)\}/gi)) {
    if (faces.length >= MAX_THEME_FONT_FACES) break;
    const declarations = match[1];
    const source = declarations.match(/(?:^|;)\s*src\s*:\s*url\(\s*(['"]?)([^)'"]+)\1\s*\)\s*format\(\s*(['"]?)(woff2?|truetype|opentype)\3\s*\)/i);
    const family = declarations.match(/(?:^|;)\s*font-family\s*:\s*([^;]+)/i)?.[1].trim();
    const style = declarations.match(/(?:^|;)\s*font-style\s*:\s*([^;]+)/i)?.[1].trim().toLowerCase() || "normal";
    const weight = declarations.match(/(?:^|;)\s*font-weight\s*:\s*([^;]+)/i)?.[1].trim().toLowerCase() || "400";
    if (!source || !family || !isTrustedFontProxyUrl(source[2], source[4])) continue;

    const descriptor = `${family.toLowerCase()}|${style}|${weight}`;
    if (descriptors.has(descriptor)) continue;
    descriptors.add(descriptor);
    faces.push(`@font-face{${declarations.replace(/font-display\s*:\s*(?:auto|block|fallback|optional|swap)/gi, "font-display:swap").trim()}}`);
  }

  return faces.join("\n");
}

function isTrustedFontProxyUrl(value: string, format: string): boolean {
  try {
    const url = new URL(value);
    const filename = url.searchParams.get("funkycommerce_font") || "";
    const extension = filename.split(".").pop()?.toLowerCase();
    const expectedExtension = format.toLowerCase() === "woff2"
      ? "woff2"
      : format.toLowerCase() === "woff"
        ? "woff"
        : format.toLowerCase() === "truetype"
          ? "ttf"
          : "otf";
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && url.pathname === "/"
      && FONT_PROXY_VERSIONS.has(url.searchParams.get("funkycommerce_font_v") || "")
      && /^[A-Za-z0-9._-]+\.(?:woff2?|ttf|otf)$/.test(filename)
      && extension === expectedExtension;
  } catch {
    return false;
  }
}

export function applyThemePresetVariables(styles: CmsThemeStyles): () => void {
  const rootStyle = document.documentElement.style;
  const previousValues = new Map<string, { value: string; priority: string }>();
  const variables = new Map<string, string>();

  styles.colors.forEach(({ slug, color }) => variables.set(presetVariable("color", slug), color));
  styles.gradients.forEach(({ slug, gradient }) => variables.set(presetVariable("gradient", slug), gradient));
  styles.fontFamilies.forEach(({ slug, fontFamily }) => variables.set(presetVariable("font-family", slug), fontFamily));
  styles.fontSizes.forEach(({ slug, size }) => variables.set(presetVariable("font-size", slug), size));
  styles.spacingSizes.forEach(({ slug, size }) => variables.set(presetVariable("spacing", slug), size));

  variables.forEach((value, property) => {
    if (cssDefinesCustomProperty(styles.globalStyles, property)) return;
    previousValues.set(property, {
      value: rootStyle.getPropertyValue(property),
      priority: rootStyle.getPropertyPriority(property),
    });
    rootStyle.setProperty(property, value);
  });

  return () => {
    previousValues.forEach(({ value, priority }, property) => {
      if (value) rootStyle.setProperty(property, value, priority);
      else rootStyle.removeProperty(property);
    });
  };
}

export function createWordPressElementTypographyCss(globalStyles: string): string {
  const rules: string[] = [];
  const bodyDeclarations = findTypographyDeclarations(
    globalStyles,
    (selector) => selectorListContainsElement(selector, "body"),
  );
  const linkDeclarations = findTypographyDeclarations(
    globalStyles,
    (selector) => selector.includes("a:where(") || selectorListContainsElement(selector, "a"),
  );
  const headingDeclarations = findTypographyDeclarations(
    globalStyles,
    (selector) => ["h1", "h2", "h3", "h4", "h5", "h6"].some((heading) => selectorListContainsElement(selector, heading)),
  );
  const captionDeclarations = findTypographyDeclarations(
    globalStyles,
    (selector) => /(?:wp-element-caption|figcaption|(?:^|[,(\s])caption(?:[),\s]|$))/i.test(selector),
  );
  const buttonDeclarations = findTypographyDeclarations(
    globalStyles,
    (selector) => /(?:wp-element-button|wp-block-button__link)/i.test(selector),
  );
  const bodyFont = bodyDeclarations.get("font-family");
  const linkFont = linkDeclarations.get("font-family") || bodyFont;
  const headingFont = headingDeclarations.get("font-family") || bodyFont;
  const captionFont = captionDeclarations.get("font-family") || bodyFont;
  const buttonFont = buttonDeclarations.get("font-family") || bodyFont;

  if (bodyFont) rules.push(`body{font-family:${bodyFont}!important}`);
  if (linkFont) rules.push(`body :where(a:not(.wp-element-button):not(.wp-block-button__link)):not(.has-custom-css){font-family:${linkFont}!important}`);
  if (headingFont) rules.push(`body :where(h1,h2,h3,h4,h5,h6,.wp-block-heading,.funky-brand-heading):not(.has-custom-css){font-family:${headingFont}!important}`);
  if (captionFont) rules.push(`body :where(figcaption,.wp-element-caption,caption):not(.has-custom-css){font-family:${captionFont}!important}`);
  if (buttonFont && buttonFont !== "inherit") {
    rules.push(`body :where(.wp-element-button,.wp-block-button__link,button,input[type="button"],input[type="submit"],input[type="reset"]):not(.has-custom-css){font-family:${buttonFont}!important}`);
  }

  const addRules = (
    target: string,
    matchesSelector: (selector: string) => boolean,
    allowBlockOverrides = true,
  ) => {
    const declarations = findTypographyDeclarations(globalStyles, matchesSelector);
    declarations.forEach((value, property) => {
      const guard = allowBlockOverrides ? typographyOverrideGuard(property) : "";
      rules.push(`${target}${guard}{${property}:${value}!important}`);
    });
  };

  addRules(
    ".wp-site-blocks.entry-content",
    (selector) => selectorListContainsElement(selector, "body"),
    false,
  );
  addRules(
    ".wp-site-blocks.entry-content :where(a:not(.wp-element-button):not(.wp-block-button__link))",
    (selector) => selector.includes("a:where(") || selectorListContainsElement(selector, "a"),
  );
  for (const heading of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
    addRules(
      `.wp-site-blocks.entry-content :where(${heading})`,
      (selector) => selectorListContainsElement(selector, heading),
    );
  }
  addRules(
    ".wp-site-blocks.entry-content :where(figcaption, .wp-element-caption, caption)",
    (selector) => /(?:wp-element-caption|figcaption|(?:^|[,(\s])caption(?:[),\s]|$))/i.test(selector),
  );
  addRules(
    ".wp-site-blocks.entry-content :where(.wp-element-button, .wp-block-button__link)",
    (selector) => /(?:wp-element-button|wp-block-button__link)/i.test(selector),
  );

  const addMarginRules = (
    target: string,
    matchesSelector: (selector: string) => boolean,
  ) => {
    const declarations = findDeclarations(globalStyles, matchesSelector, WORDPRESS_TEXT_MARGIN_PROPERTIES);
    declarations.forEach((value, property) => {
      rules.push(`${target}:not([style*="margin"]){${property}:${value}}`);
    });
  };

  addMarginRules(
    ":where(.wp-site-blocks.entry-content p)",
    (selector) => selectorListContainsElement(selector, "p") || selector.includes(".wp-block-paragraph"),
  );
  for (const heading of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
    addMarginRules(
      `:where(.wp-site-blocks.entry-content ${heading})`,
      (selector) => selector.includes(".wp-block-heading") || selectorListContainsElement(selector, heading),
    );
  }

  return rules.join("");
}

export function sanitizeWordPressGlobalStyles(css: string): string {
  return css;
}

function presetVariable(category: string, slug: string): string {
  return `--wp--preset--${category}--${slug.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
}

function cssDefinesCustomProperty(css: string, property: string): boolean {
  return new RegExp(`${property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`, "i").test(css);
}

function findTypographyDeclarations(
  css: string,
  matchesSelector: (selector: string) => boolean,
): Map<string, string> {
  return findDeclarations(css, matchesSelector, WORDPRESS_TYPOGRAPHY_PROPERTIES);
}

function findDeclarations(
  css: string,
  matchesSelector: (selector: string) => boolean,
  acceptedProperties: ReadonlySet<string>,
): Map<string, string> {
  const declarations = new Map<string, string>();
  for (const match of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!matchesSelector(match[1])) continue;
    for (const declaration of match[2].split(";")) {
      const separator = declaration.indexOf(":");
      if (separator < 1) continue;
      const property = declaration.slice(0, separator).trim().toLowerCase();
      if (!acceptedProperties.has(property)) continue;
      const value = declaration.slice(separator + 1).trim().replace(/\s*!important\s*$/i, "");
      if (value) declarations.set(property, value);
    }
  }
  return declarations;
}

function selectorListContainsElement(selector: string, element: string): boolean {
  return selector.split(",").some((part) => {
    const normalized = part.trim()
      .replace(/^:root\s+/, "")
      .replace(/^:where\(([^()]*)\)$/, "$1")
      .trim();
    return normalized === element;
  });
}

function typographyOverrideGuard(property: string): string {
  const customCssGuard = ":not(.has-custom-css)";
  const inlineGuard = `:not([style*="${property}"])`;
  if (property === "font-size") return `${customCssGuard}:not([class*="-font-size"])${inlineGuard}`;
  if (property === "font-family") return `${customCssGuard}:not([class*="-font-family"])${inlineGuard}`;
  return `${customCssGuard}${inlineGuard}`;
}

function mountStylesheet(href: string): string {
  const key = `link:${href}`;
  const existing = mountedStyles.get(key);
  if (existing) {
    existing.count += 1;
    return key;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.wordpressPageStyle = "wordpress-block-library";
  document.head.appendChild(link);
  mountedStyles.set(key, { count: 1, element: link });
  return key;
}

function orderMountedPageStyles(): void {
  const priority: Record<string, number> = {
    "wordpress-font-faces": 0,
    "wordpress-global-styles": 1,
    "wordpress-block-library": 2,
    "wordpress-custom-css": 3,
    "wordpress-block-compatibility": 4,
  };
  const elements = Array.from(document.head.querySelectorAll<HTMLLinkElement | HTMLStyleElement>("[data-wordpress-page-style]"));
  elements
    .map((element, index) => ({ element, index }))
    .sort((left, right) => {
      const leftPriority = priority[left.element.dataset.wordpressPageStyle || ""] ?? 99;
      const rightPriority = priority[right.element.dataset.wordpressPageStyle || ""] ?? 99;
      return leftPriority - rightPriority || left.index - right.index;
    })
    .forEach(({ element }) => document.head.appendChild(element));
}

function mountInlineStyle(name: string, css: string, moveToEnd = false): string | null {
  if (!css.trim()) return null;
  const key = `style:${name}:${hashCss(css)}`;
  const existing = mountedStyles.get(key);
  if (existing) {
    existing.count += 1;
    if (moveToEnd) document.head.appendChild(existing.element);
    return key;
  }

  const style = document.createElement("style");
  style.dataset.wordpressPageStyle = name;
  style.textContent = css;
  document.head.appendChild(style);
  mountedStyles.set(key, { count: 1, element: style });
  return key;
}

function hashCss(css: string): string {
  let hash = 5381;
  for (let index = 0; index < css.length; index += 1) hash = (hash * 33) ^ css.charCodeAt(index);
  return (hash >>> 0).toString(36);
}
