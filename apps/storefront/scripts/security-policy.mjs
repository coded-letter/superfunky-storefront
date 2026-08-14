const INLINE_STYLE_SOURCE = "'unsafe-inline'";
const BASE_STYLE_SOURCES = ["'self'", INLINE_STYLE_SOURCE];
const BASE_SCRIPT_SOURCES = ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:", "blob:"];

export function withStorefrontEditorPolicy(policy, cmsEndpoint) {
  const directives = parsePolicy(policy);
  const cmsOrigin = safeHttpsOrigin(cmsEndpoint);
  const elementSources = [...BASE_STYLE_SOURCES, ...(cmsOrigin ? [cmsOrigin] : [])];
  const existing = new Map(directives);
  const mergeSources = (...sources) => [...new Set(sources.flat())];
  const scriptDirectives = new Map([
    ["script-src", mergeSources(BASE_SCRIPT_SOURCES, existing.get("script-src") || [])],
    ["script-src-elem", mergeSources(BASE_SCRIPT_SOURCES, existing.get("script-src-elem") || [])],
    ["script-src-attr", ["'none'"]],
  ]);
  const integrationDirectives = new Map([
    ["connect-src", mergeSources(["'self'", "https:", "wss:"], existing.get("connect-src") || [])],
    ["frame-src", mergeSources(["'self'", "https:"], existing.get("frame-src") || [])],
    ["worker-src", mergeSources(["'self'", "https:", "blob:"], existing.get("worker-src") || [])],
  ]);
  const styleDirectives = new Map([
    ["style-src", elementSources],
    ["style-src-elem", elementSources],
    ["style-src-attr", [INLINE_STYLE_SOURCE]],
  ]);

  const output = [];
  let insertedEditorPolicy = false;
  for (const [name, sources] of directives) {
    if (name.startsWith("style-src") || name.startsWith("script-src") || integrationDirectives.has(name)) {
      if (!insertedEditorPolicy) {
        output.push(...scriptDirectives, ...styleDirectives, ...integrationDirectives);
        insertedEditorPolicy = true;
      }
      continue;
    }
    output.push([name, sources]);
    if (name === "default-src" && !insertedEditorPolicy) {
      output.push(...scriptDirectives, ...styleDirectives, ...integrationDirectives);
      insertedEditorPolicy = true;
    }
  }
  if (!insertedEditorPolicy) output.unshift(...scriptDirectives, ...styleDirectives, ...integrationDirectives);

  return output.map(([name, sources]) => `${name}${sources.length ? ` ${sources.join(" ")}` : ""}`).join("; ");
}

export function policyAllowsEditorCode(policy) {
  const directives = new Map(parsePolicy(policy));
  return ["style-src", "style-src-elem", "style-src-attr"].every((name) => directives.get(name)?.includes(INLINE_STYLE_SOURCE))
    && ["script-src", "script-src-elem"].every((name) => {
      const sources = directives.get(name);
      return sources?.includes("'unsafe-inline'")
        && sources.includes("'unsafe-eval'")
        && sources.includes("https:");
    })
    && directives.get("script-src-attr")?.length === 1
    && directives.get("script-src-attr")?.[0] === "'none'"
    && directives.get("connect-src")?.includes("https:")
    && directives.get("connect-src")?.includes("wss:")
    && directives.get("frame-src")?.includes("https:")
    && directives.get("worker-src")?.includes("https:");
}

function parsePolicy(policy) {
  return String(policy || "")
    .split(";")
    .map((directive) => directive.trim())
    .filter(Boolean)
    .map((directive) => {
      const [name, ...sources] = directive.split(/\s+/);
      return [name.toLowerCase(), sources];
    });
}

function safeHttpsOrigin(endpoint) {
  if (!endpoint) return "";
  try {
    const parsed = new URL(endpoint);
    return parsed.protocol === "https:" ? parsed.origin : "";
  } catch {
    return "";
  }
}
