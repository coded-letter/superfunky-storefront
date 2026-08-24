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
import {
  CODE_THEME_OPTIONS,
  normalizeCodeTheme,
  resolveAutomaticCodeTheme,
  type CodeThemePreference,
} from "./codeThemes.ts";

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

const LANGUAGE_OPTIONS = [
  ["none", "Plain text"],
  ["bash", "Shell"],
  ["css", "CSS"],
  ["markup", "HTML/XML"],
  ["javascript", "JavaScript"],
  ["json", "JSON"],
  ["jsx", "JSX"],
  ["php", "PHP"],
  ["python", "Python"],
  ["sql", "SQL"],
  ["typescript", "TypeScript"],
  ["tsx", "TSX"],
] as const;

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

let codeThemeStylesPromise: Promise<void> | null = null;

function ensureCodeThemeStyles(): Promise<void> {
  codeThemeStylesPromise ??= import("./codeThemeStyles.ts").then(({ mountCodeThemeStyles }) => {
    mountCodeThemeStyles();
  });
  return codeThemeStylesPromise;
}

function requestCodeThemeStyles(): void {
  void ensureCodeThemeStyles().catch((error: unknown) => {
    console.error("Could not load syntax color themes.", error);
  });
}

function applyCodeTheme(anchor: HTMLElement, code: HTMLElement, preference: CodeThemePreference): void {
  const theme = preference === "auto" ? resolveAutomaticCodeTheme() : preference;
  anchor.dataset.codeThemePreference = preference;
  anchor.dataset.codeTheme = theme;
  code.dataset.codeThemePreference = preference;
  code.dataset.codeTheme = theme;
}

function addCodeControls(
  anchor: HTMLElement,
  code: HTMLElement,
  language: string,
  themePreference: CodeThemePreference,
): HTMLElement {
  const controls = document.createElement("div");
  controls.className = "cms-code-controls";
  const languageSelect = document.createElement("select");
  languageSelect.className = "cms-code-language-select";
  languageSelect.setAttribute("aria-label", "Syntax highlighting language");
  LANGUAGE_OPTIONS.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = value === language;
    languageSelect.append(option);
  });
  languageSelect.addEventListener("change", () => {
    const source = code.textContent || "";
    removeDeclaredLanguageClasses(code);
    removeDeclaredLanguageClasses(anchor);
    code.classList.add(`language-${languageSelect.value}`);
    anchor.classList.add(`language-${languageSelect.value}`);
    anchor.dataset.codeLanguage = languageSelect.selectedOptions[0]?.textContent || languageSelect.value;
    code.textContent = source;
    if (languageSelect.value !== "none") Prism.highlightElement(code);
  });
  controls.append(languageSelect);

  const themeSelect = document.createElement("select");
  themeSelect.className = "cms-code-theme-select";
  themeSelect.setAttribute("aria-label", "Syntax highlighting color theme");
  CODE_THEME_OPTIONS.forEach(({ value, label }) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = value === themePreference;
    themeSelect.append(option);
  });
  themeSelect.addEventListener("change", () => {
    applyCodeTheme(anchor, code, normalizeCodeTheme(themeSelect.value));
    requestCodeThemeStyles();
  });
  controls.append(themeSelect);

  if (!anchor.classList.contains("no-copy") && !code.classList.contains("no-copy")) {
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "cms-code-copy";
    copy.textContent = "Copy";
    copy.setAttribute("aria-label", "Copy code");
    copy.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code.textContent || "");
        copy.textContent = "Copied";
      } catch {
        copy.textContent = "Copy failed";
      }
    });
    controls.append(copy);
  }

  anchor.append(controls);
  return controls;
}

export function mountCmsCodeHighlighting(container: HTMLElement): () => void {
  const controls: HTMLElement[] = [];
  const themedBlocks: Array<{ anchor: HTMLElement; code: HTMLElement }> = [];
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
    const controlLanguage = language || "none";
    const languageLabel = languageClass?.replace(/^language-/, "").toLowerCase() || "";
    const themePreference = normalizeCodeTheme(pre?.dataset.codeTheme || code.dataset.codeTheme);
    code.dataset.cmsHighlighted = "true";
    if (languageLabel) {
      (pre || code).dataset.codeLanguage = languageLabel;
    }
    if (!pre) {
      code.dataset.codeStandalone = "true";
    }
    applyCodeTheme(pre || code, code, themePreference);
    themedBlocks.push({ anchor: pre || code, code });
    if (!language || !Prism.languages[language]) {
      code.classList.add("language-none");
      pre?.classList.add("language-none");
      if (pre) controls.push(addCodeControls(pre, code, controlLanguage, themePreference));
      return;
    }

    removeDeclaredLanguageClasses(code);
    if (pre) removeDeclaredLanguageClasses(pre);
    code.classList.add(`language-${language}`);
    pre?.classList.add(`language-${language}`);
    Prism.highlightElement(code);
    if (pre) controls.push(addCodeControls(pre, code, controlLanguage, themePreference));
  });

  if (candidates.some((code) => code.dataset.cmsHighlighted === "true")) {
    requestCodeThemeStyles();
  }
  const themeObserver = themedBlocks.length
    ? new window.MutationObserver(() => {
        themedBlocks.forEach(({ anchor, code }) => {
          if (normalizeCodeTheme(anchor.dataset.codeThemePreference) === "auto") {
            applyCodeTheme(anchor, code, "auto");
          }
        });
      })
    : null;
  themeObserver?.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "data-cms-code-light-theme", "data-cms-code-dark-theme"],
  });

  return () => {
    themeObserver?.disconnect();
    controls.forEach((control) => control.remove());
    candidates.forEach((code) => delete code.dataset.cmsHighlighted);
  };
}
