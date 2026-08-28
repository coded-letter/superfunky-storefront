import type { CmsPageScript } from "./pages";

const CMS_SCRIPT_SELECTOR = 'script[data-wp-block-html="js"]';
const EXECUTED_ATTRIBUTE = "data-funky-cms-executed";
const REJECTED_ATTRIBUTE = "data-funky-cms-rejected";
const HTML_PAYLOAD_PATTERN = /^\s*<(?!\!--)/;
const BUNDLED_SCRIPT_HANDLES = new Set([
  "wc-add-to-cart",
  "woocommerce",
]);
const warnedScripts = new Set<string>();

function decodeHtmlEntities(value: string): string {
  const decoder = document.createElement("textarea");
  return value.replace(/&(?:#\d+|#x[\da-f]+|[a-z][\w-]+);/gi, (entity) => {
    decoder.innerHTML = entity;
    return decoder.value;
  });
}

function executeCmsScript(source: HTMLScriptElement): void {
  if (source.hasAttribute(EXECUTED_ATTRIBUTE) || source.hasAttribute(REJECTED_ATTRIBUTE)) return;

  const executable = document.createElement("script");
  for (const attribute of Array.from(source.attributes)) {
    executable.setAttribute(attribute.name, attribute.value);
  }
  executable.setAttribute(EXECUTED_ATTRIBUTE, "true");

  if (source.src && !source.hasAttribute("async")) {
    executable.async = false;
  } else if (!source.src) {
    const scriptText = decodeHtmlEntities(source.textContent ?? "");
    if (HTML_PAYLOAD_PATTERN.test(scriptText)) {
      source.setAttribute(REJECTED_ATTRIBUTE, "true");
      console.error(
        "[CMS content] Refused to execute an inline script because its body contains HTML instead of JavaScript.",
        source,
      );
      return;
    }
    executable.text = scriptText;
  }

  source.replaceWith(executable);
}

function executeCmsScriptsIn(node: ParentNode): void {
  if (node instanceof HTMLScriptElement && node.matches(CMS_SCRIPT_SELECTOR)) {
    executeCmsScript(node);
    return;
  }

  for (const script of node.querySelectorAll<HTMLScriptElement>(CMS_SCRIPT_SELECTOR)) {
    executeCmsScript(script);
  }
}

export function mountCmsScripts(root: HTMLElement): () => void {
  executeCmsScriptsIn(root);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of Array.from(record.addedNodes)) {
        if (node instanceof HTMLElement) {
          executeCmsScriptsIn(node);
        }
      }
    }
  });
  observer.observe(root, { childList: true, subtree: true });

  return () => observer.disconnect();
}

export function mountEnqueuedScripts(scripts: CmsPageScript[]): () => void {
  scripts.forEach((script) => {
    const identifier = script.handle || script.id;
    if (BUNDLED_SCRIPT_HANDLES.has(identifier)) return;
    if (warnedScripts.has(identifier)) return;
    warnedScripts.add(identifier);
    console.warn(
      `[CMS content] Ignoring WordPress script "${identifier}". CMS scripts require a reviewed, bundled behavior or an explicit URL and integrity allowlist.`,
    );
  });
  return () => undefined;
}
