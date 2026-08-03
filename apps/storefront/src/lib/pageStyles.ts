import type { CmsThemeStyles } from "./pages";

type MountedStyle = {
  count: number;
  element: HTMLLinkElement | HTMLStyleElement;
};

const mountedStyles = new Map<string, MountedStyle>();

const WORDPRESS_BLOCK_COMPATIBILITY_CSS = `
.wp-site-blocks.entry-content {
  display: flow-root !important;
}

.wp-site-blocks.entry-content > * {
  box-sizing: border-box;
}

.wp-site-blocks.entry-content > * + * {
  margin-block-start: var(--wp--style--block-gap, 1rem);
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

.wp-site-blocks.entry-content .aligncenter {
  clear: both;
  display: table;
  margin-inline: auto !important;
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

.wp-site-blocks.entry-content .alignwide {
  clear: both;
  margin-inline: auto !important;
  max-width: min(100%, var(--wp--style--global--wide-size, 1200px)) !important;
  width: 100% !important;
}

.wp-site-blocks.entry-content .alignfull {
  clear: both;
  margin-inline: calc(50% - 50vw) !important;
  max-width: 100vw !important;
  width: 100vw !important;
}

.wp-site-blocks.entry-content :where(img, video, iframe) {
  max-width: 100%;
}

.wp-site-blocks.entry-content :where(img, video) {
  height: auto;
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

.wp-site-blocks.entry-content :where(.wp-block-group, .wp-block-cover, .wp-block-media-text) {
  box-sizing: border-box;
}

.wp-site-blocks.entry-content .is-layout-flex {
  display: flex;
  flex-wrap: wrap;
}

.wp-site-blocks.entry-content .is-layout-flex.is-vertical {
  flex-direction: column;
}

.wp-site-blocks.entry-content .is-layout-grid {
  display: grid;
}

.wp-site-blocks.entry-content :where(.is-layout-flex, .is-layout-grid) {
  gap: var(--wp--style--block-gap, 1rem);
}

.wp-site-blocks.entry-content .is-content-justification-left {
  justify-content: flex-start;
}

.wp-site-blocks.entry-content .is-content-justification-center {
  justify-content: center;
}

.wp-site-blocks.entry-content .is-content-justification-right {
  justify-content: flex-end;
}

.wp-site-blocks.entry-content .is-content-justification-space-between {
  justify-content: space-between;
}

.wp-site-blocks.entry-content .are-vertically-aligned-top {
  align-items: flex-start;
}

.wp-site-blocks.entry-content .are-vertically-aligned-center {
  align-items: center;
}

.wp-site-blocks.entry-content .are-vertically-aligned-bottom {
  align-items: flex-end;
}

.wp-site-blocks.entry-content .wp-block-columns {
  align-items: normal;
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap !important;
  gap: var(--wp--style--block-gap, 1.5rem);
}

.wp-site-blocks.entry-content .wp-block-column {
  flex-basis: 0;
  flex-grow: 1;
  min-width: 0;
  overflow-wrap: break-word;
  word-break: break-word;
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
  text-decoration: none;
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
`;

export function mountPageStyles(styles: CmsThemeStyles): () => void {
  const keys = [
    ...styles.stylesheets.map((href) => mountStylesheet(href)),
    mountInlineStyle("wordpress-font-faces", styles.fontFaceStyles),
    mountInlineStyle("wordpress-global-styles", styles.globalStyles),
    mountInlineStyle("wordpress-custom-css", styles.customCss),
    // Always mounted last so block semantics survive Tailwind and theme collisions.
    mountInlineStyle("wordpress-block-compatibility", WORDPRESS_BLOCK_COMPATIBILITY_CSS, true),
  ].filter((key): key is string => Boolean(key));

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

export function applyThemePresetVariables(styles: CmsThemeStyles): () => void {
  const rootStyle = document.documentElement.style;
  const previousValues = new Map<string, { value: string; priority: string }>();
  const variables = new Map<string, string>();

  styles.colors.forEach(({ slug, color }) => variables.set(presetVariable("color", slug), color));
  styles.gradients.forEach(({ slug, gradient }) => variables.set(presetVariable("gradient", slug), gradient));
  styles.fontFamilies.forEach(({ slug, fontFamily }) => variables.set(presetVariable("font-family", slug), fontFamily));
  styles.fontSizes.forEach(({ slug, size }) => variables.set(presetVariable("font-size", slug), size));
  styles.spacingSizes.forEach(({ slug, size }) => variables.set(presetVariable("spacing", slug), size));
  if (styles.contentSize) variables.set("--wp--style--global--content-size", styles.contentSize);
  if (styles.wideSize) variables.set("--wp--style--global--wide-size", styles.wideSize);

  variables.forEach((value, property) => {
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

function presetVariable(category: string, slug: string): string {
  return `--wp--preset--${category}--${slug.toLowerCase().replace(/[^a-z0-9-]/g, "-")}`;
}

function mountStylesheet(href: string): string | null {
  if (!href) return null;
  const key = `link:${href}`;
  const existing = mountedStyles.get(key);
  if (existing) {
    existing.count += 1;
    return key;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.dataset.wordpressPageStyle = "block-library";
  document.head.appendChild(link);
  mountedStyles.set(key, { count: 1, element: link });
  return key;
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
