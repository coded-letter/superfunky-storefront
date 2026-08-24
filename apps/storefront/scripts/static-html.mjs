export function stripBootstrapOverlay(html) {
  return html.replace(/\s*<div id="storefront-bootstrap"[\s\S]*?(?=<noscript>)/, "");
}
