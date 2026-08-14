import Prism from "prismjs";
import "prismjs/components/prism-bash.js";
import "prismjs/components/prism-json.js";
import "prismjs/components/prism-jsx.js";
import "prismjs/components/prism-markup.js";
import "prismjs/components/prism-markup-templating.js";
import "prismjs/components/prism-php.js";
import "prismjs/components/prism-python.js";
import "prismjs/components/prism-sql.js";
import "prismjs/components/prism-tsx.js";
import "prismjs/components/prism-typescript.js";

const LANGUAGE_ALIASES: Record<string, string> = {
  bash: "bash",
  css: "css",
  html: "markup",
  js: "javascript",
  javascript: "javascript",
  json: "json",
  jsx: "jsx",
  markup: "markup",
  php: "php",
  py: "python",
  python: "python",
  shell: "bash",
  sh: "bash",
  sql: "sql",
  ts: "typescript",
  tsx: "tsx",
  typescript: "typescript",
  xml: "markup",
};

export function normalizeCodeLanguage(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase().replace(/^language-/, "") || "";
  return LANGUAGE_ALIASES[normalized] || null;
}

function declaredLanguageClass(element: HTMLElement): string | null {
  const classes = [
    ...element.classList,
    ...(element.parentElement?.tagName === "PRE" ? [...element.parentElement.classList] : []),
  ];
  return classes.find((className) => className.startsWith("language-") || normalizeCodeLanguage(className)) || null;
}

function removeDeclaredLanguageClasses(element: HTMLElement): void {
  [...element.classList].forEach((className) => {
    if (className.startsWith("language-") || normalizeCodeLanguage(className)) {
      element.classList.remove(className);
    }
  });
}

export function mountCmsCodeHighlighting(container: HTMLElement): () => void {
  const candidates = [
    ...(container.matches("code") ? [container] : []),
    ...container.querySelectorAll<HTMLElement>("code"),
  ];

  candidates.forEach((code) => {
    if (code.dataset.cmsHighlighted === "true") return;
    const pre = code.parentElement?.tagName === "PRE" ? code.parentElement : null;
    const languageClass = declaredLanguageClass(code);
    if (!pre && !languageClass) return;

    const language = normalizeCodeLanguage(languageClass);
    const languageLabel = languageClass?.replace(/^language-/, "").toLowerCase() || "";
    code.dataset.cmsHighlighted = "true";
    if (languageLabel) {
      (pre || code).dataset.codeLanguage = languageLabel;
    }
    if (!pre) {
      code.dataset.codeStandalone = "true";
    }
    if (!language || !Prism.languages[language]) {
      code.classList.add("language-none");
      return;
    }

    removeDeclaredLanguageClasses(code);
    if (pre) removeDeclaredLanguageClasses(pre);
    code.classList.add(`language-${language}`);
    pre?.classList.add(`language-${language}`);
    Prism.highlightElement(code);
  });

  return () => undefined;
}
