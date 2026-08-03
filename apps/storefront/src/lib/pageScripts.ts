import type { CmsPageScript } from "./pages";

const warnedMissingDependencies = new Set<string>();

export function executeContentScripts(container: HTMLElement): void {
  container.querySelectorAll("script").forEach((oldScript) => {
    const newScript = document.createElement("script");
    Array.from(oldScript.attributes).forEach(({ name, value }) => newScript.setAttribute(name, value));
    newScript.textContent = oldScript.textContent;
    oldScript.replaceWith(newScript);
  });
}

export function mountEnqueuedScripts(scripts: CmsPageScript[]): () => void {
  const mounted: HTMLScriptElement[] = [];
  const loading = new Map<string, Promise<void>>();
  let active = true;

  const appendInline = (script: CmsPageScript, code: string) => {
    if (!active) return;
    const element = document.createElement("script");
    element.dataset.wpHandle = script.handle || script.id;
    element.textContent = code;
    getTarget(script).appendChild(element);
    mounted.push(element);
  };

  const loadScript = (script: CmsPageScript): Promise<void> => {
    const existing = loading.get(script.id);
    if (existing) return existing;

    const promise = (async () => {
      if (script.src && script.dependencies === null) {
        const identifier = script.handle || script.id;
        if (!warnedMissingDependencies.has(identifier)) {
          warnedMissingDependencies.add(identifier);
          console.warn(`Skipping WordPress script "${identifier}" because its dependency metadata is unavailable.`);
        }
        return;
      }

      await Promise.all((script.dependencies || []).map(loadScript));
      if (!active) return;

      script.before.forEach((code) => appendInline(script, code));

      if (script.src) {
        const src = script.src;
        await new Promise<void>((resolve, reject) => {
          const element = document.createElement("script");
          element.dataset.wpHandle = script.handle || script.id;
          element.src = src;
          element.async = script.strategy === "ASYNC";
          element.defer = script.strategy === "DEFER";
          element.addEventListener("load", () => resolve(), { once: true });
          element.addEventListener("error", () => reject(new Error(`Failed to load WordPress script "${script.handle || script.id}"`)), {
            once: true,
          });
          getTarget(script).appendChild(element);
          mounted.push(element);
        });
      }

      script.after.forEach((code) => appendInline(script, code));
    })();

    loading.set(script.id, promise);
    return promise;
  };

  scripts.forEach((script) => {
    void loadScript(script).catch((error: Error) => console.error(error.message));
  });

  return () => {
    active = false;
    mounted.forEach((element) => element.remove());
  };
}

function getTarget(script: CmsPageScript): HTMLElement {
  return script.groupLocation === "HEADER" ? document.head : document.body;
}
