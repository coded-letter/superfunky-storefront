import { hasOnlyMissingRootField } from "./optional-graphql.mjs";

const MAX_CONTENT_BYTES = 50_000_000;
const MAX_PAGES = 100;
const EDITOR_FIELDS = ["content(format: RENDERED)", "headlessContent"];
const SOURCES = [
  { root: "pages", fields: EDITOR_FIELDS, optionalFields: ["headlessContent"] },
  { root: "posts", fields: [...EDITOR_FIELDS, "excerpt(format: RENDERED)"], optionalFields: ["headlessContent"] },
  { root: "communityPosts", optional: true, fields: ["content(format: RENDERED)", "description"], optionalFields: ["description"] },
  {
    root: "products", optional: true,
    fields: ["description(format: RENDERED)", "shortDescription(format: RENDERED)", "headlessDescription", "headlessShortDescription"],
    optionalFields: ["headlessDescription", "headlessShortDescription"],
  },
  { root: "mediaItems", fields: ["caption(format: RENDERED)", "description(format: RENDERED)"] },
  ...["categories", "tags", "productCategories", "productTags", "productBrands"].map((root) => ({
    root, optional: root.startsWith("product"), fields: ["description"],
  })),
  { root: "users", fields: ["description"] },
  { root: "menuItems", optional: true, fields: ["description", "cssClasses"] },
];

export async function requestCmsGraphql(endpoint, query, variables, fetchImpl, storefrontOrigin) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(storefrontOrigin ? { Origin: storefrontOrigin } : {}),
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok && !response.headers.get("content-type")?.includes("application/json")) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!response.ok && !payload?.errors?.length) throw new Error(`HTTP ${response.status}`);
      if (!payload || typeof payload !== "object") throw new Error("invalid GraphQL response");
      return payload;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 500));
    }
  }
  throw new Error(`CMS Tailwind content query failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

function graphqlError(root, errors) {
  return new Error(`CMS Tailwind ${root} query failed: ${errors.map(({ message }) => message).join("; ")}`);
}

function fieldName(selection) {
  return selection.split("(")[0];
}

function hasBrokenPluginConnection(errors) {
  return errors?.length && errors.every(({ extensions }) =>
    extensions?.debugMessage?.includes("Cannot access offset of type string on string"));
}

async function fetchConnection(source, request, addDocument, productFallback) {
  let fields = [...source.fields];
  let after = null;
  const cursors = new Set();
  for (let page = 0; page < MAX_PAGES;) {
    const query = `
      query StorefrontTailwindContent($after: String) {
        ${source.root}(first: 50, after: $after) {
          nodes { id ${fields.join("\n")} }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    const payload = await request(query, { after });
    if (payload.errors?.length) {
      if (source.root === "products" && (
        hasOnlyMissingRootField(payload.errors, source.root)
        || hasBrokenPluginConnection(payload.errors)
      )) {
        console.warn("[cms-tailwind] products GraphQL connection is unavailable; extracting public WooCommerce Store API descriptions.");
        await productFallback(hasOnlyMissingRootField(payload.errors, source.root));
        return;
      }
      if (source.optional && after === null && hasOnlyMissingRootField(payload.errors, source.root)) {
        console.log(`[cms-tailwind] ${source.root} is not exposed by this CMS; skipping.`);
        return;
      }
      let nextFields = [...fields];
      const compatible = payload.errors.every(({ message }) => {
        const missing = message.match(/Cannot query field "([^"]+)" on type "[^"]+"/i)?.[1];
        if (missing && source.optionalFields?.includes(missing)) {
          nextFields = nextFields.filter((field) => fieldName(field) !== missing);
          return true;
        }
        if (/Unknown argument "format"/i.test(message)) {
          nextFields = nextFields.map(fieldName);
          return true;
        }
        return false;
      });
      if (!compatible || fields.join() === nextFields.join()) throw graphqlError(source.root, payload.errors);
      console.warn(`[cms-tailwind] ${source.root}: using schema-compatible fields (${payload.errors.map(({ message }) => message).join("; ")}).`);
      fields = nextFields;
      continue;
    }
    const connection = payload.data?.[source.root];
    if (!Array.isArray(connection?.nodes) || typeof connection.pageInfo?.hasNextPage !== "boolean") {
      throw new Error(`CMS Tailwind ${source.root} response omitted nodes or pagination metadata.`);
    }
    if (!connection.nodes.length && connection.pageInfo.hasNextPage) {
      throw new Error(`CMS Tailwind ${source.root} returned an incomplete page.`);
    }
    for (const node of connection.nodes) {
      if (!node || typeof node.id !== "string") throw new Error(`CMS Tailwind ${source.root} returned an invalid node.`);
      for (const field of fields.map(fieldName)) {
        const value = node[field];
        const location = `${source.root}/${node.id}.${field}`;
        if (field === "cssClasses") {
          if (value !== null && (!Array.isArray(value) || value.some((token) => typeof token !== "string"))) {
            throw new Error(`CMS Tailwind ${location} returned invalid class names.`);
          }
          const escaped = (value || []).join(" ").replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
          addDocument(`<div class="${escaped}"></div>`, location);
        } else {
          if (value !== null && typeof value !== "string") throw new Error(`CMS Tailwind ${location} omitted its HTML field.`);
          if (value) addDocument(value, location);
        }
      }
    }
    page += 1;
    if (!connection.pageInfo.hasNextPage) return;
    const next = connection.pageInfo.endCursor;
    if (typeof next !== "string" || !next || cursors.has(next)) {
      throw new Error(`CMS Tailwind ${source.root} pagination returned an invalid cursor.`);
    }
    cursors.add(next);
    after = next;
  }
  throw new Error(`CMS Tailwind ${source.root} pagination exceeded ${MAX_PAGES} pages.`);
}

async function fetchStoreProducts(endpoint, fetchImpl, storefrontOrigin, addDocument, optional) {
  const url = new URL(endpoint);
  url.pathname = url.pathname.replace(/\/graphql\/?$/, "/wp-json/wc/store/v1/products");
  if (!url.pathname.endsWith("/wp-json/wc/store/v1/products")) throw new Error("CMS Tailwind cannot derive the WooCommerce Store API from this GraphQL URL.");
  url.search = "";
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    url.searchParams.set("per_page", "50");
    url.searchParams.set("page", String(page));
    const response = await fetchImpl(url.href, {
      headers: storefrontOrigin ? { Origin: storefrontOrigin } : {},
      signal: AbortSignal.timeout(20_000),
    });
    const payload = await response.json();
    if (optional && page === 1 && response.status === 404 && payload?.code === "rest_no_route") {
      console.log("[cms-tailwind] WooCommerce is not exposed by this CMS; skipping products.");
      return;
    }
    if (!response.ok) throw new Error(`CMS Tailwind Store API query failed: HTTP ${response.status}`);
    if (!Array.isArray(payload)) throw new Error("CMS Tailwind Store API returned invalid products.");
    const totalPages = response.headers.get("x-wp-totalpages");
    if (totalPages === null || !/^\d+$/.test(totalPages) || Number(totalPages) > MAX_PAGES) {
      throw new Error("CMS Tailwind Store API returned invalid or excessive pagination.");
    }
    for (const product of payload) {
      for (const field of ["description", "short_description"]) {
        if (!product?.id || typeof product[field] !== "string") throw new Error("CMS Tailwind Store API omitted a product description.");
        if (product[field]) addDocument(product[field], `products/${product.id}.${field}`);
      }
    }
    if (page >= Number(totalPages)) return;
    if (!payload.length) throw new Error("CMS Tailwind Store API returned an incomplete product page.");
  }
  throw new Error(`CMS Tailwind Store API pagination exceeded ${MAX_PAGES} pages.`);
}

async function fetchChrome(request, addDocument, configuredLanguages) {
  const languages = new Set([null, ...configuredLanguages]);
  let languagePayload = await request("query StorefrontTailwindLanguages { languages { code slug } }", {});
  let discovered;
  if (languagePayload.errors?.length) {
    const absent = hasOnlyMissingRootField(languagePayload.errors, "languages");
    if (!absent && !hasBrokenPluginConnection(languagePayload.errors)) throw graphqlError("languages", languagePayload.errors);
    console.warn("[cms-tailwind] using storefront configuration for language discovery.");
    languagePayload = await request("query StorefrontTailwindConfigLanguages { funkycommerceStorefrontConfig { languages { code } } }", {});
    if (languagePayload.errors?.length) {
      if (!absent || !hasOnlyMissingRootField(languagePayload.errors, "funkycommerceStorefrontConfig")) {
        throw graphqlError("configuration languages", languagePayload.errors);
      }
      discovered = [];
    } else {
      discovered = languagePayload.data?.funkycommerceStorefrontConfig?.languages;
    }
  } else {
    discovered = languagePayload.data?.languages;
  }
  if (!Array.isArray(discovered)) throw new Error("CMS Tailwind languages response omitted languages.");
  for (const language of discovered) {
    const code = language?.slug || language?.code;
    if (typeof code !== "string" || !code) throw new Error("CMS Tailwind returned an invalid language.");
    languages.add(code.toLowerCase());
  }
  for (const language of languages) {
    let brandingFields = ["promoHtml"];
    let footerFields = ["extraHtml", "copyrightText", "themeCredit", "newsletterPrivacyLabel"];
    let localized = true;
    for (;;) {
      const query = `query StorefrontTailwindChrome${localized ? "($language: String)" : ""} {
        funkycommerceStorefrontConfig${localized ? "(language: $language)" : ""} {
          __typename
          ${brandingFields.length ? `branding { ${brandingFields.join("\n")} }` : ""}
          ${footerFields.length ? `footer { ${footerFields.join("\n")} }` : ""}
        }
      }`;
      const payload = await request(query, localized ? { language } : {});
      if (payload.errors?.length) {
        if (hasOnlyMissingRootField(payload.errors, "funkycommerceStorefrontConfig")) {
          console.log("[cms-tailwind] Storefront chrome configuration is not exposed by this CMS; skipping.");
          return;
        }
        const previous = JSON.stringify([brandingFields, footerFields, localized]);
        const compatible = payload.errors.every(({ message }) => {
          const missing = message.match(/Cannot query field "([^"]+)" on type "[^"]+"/i)?.[1];
          if (missing === "branding" && brandingFields.length) { brandingFields = []; return true; }
          if (missing === "footer" && footerFields.length) { footerFields = []; return true; }
          if (brandingFields.includes(missing)) { brandingFields = brandingFields.filter((field) => field !== missing); return true; }
          if (footerFields.includes(missing)) { footerFields = footerFields.filter((field) => field !== missing); return true; }
          if (localized && /Unknown argument "language"/i.test(message)) { localized = false; return true; }
          return false;
        });
        if (!compatible || previous === JSON.stringify([brandingFields, footerFields, localized])) throw graphqlError("chrome", payload.errors);
        console.warn(`[cms-tailwind] using compatible chrome fields: ${payload.errors.map(({ message }) => message).join("; ")}.`);
        continue;
      }
      const config = payload.data?.funkycommerceStorefrontConfig;
      if (!config) throw new Error("CMS Tailwind chrome response omitted configuration.");
      for (const [group, fields] of [["branding", brandingFields], ["footer", footerFields]]) {
        for (const field of fields) {
          const value = config[group]?.[field];
          if (value !== null && typeof value !== "string") throw new Error(`CMS Tailwind chrome omitted ${group}.${field}.`);
          if (value) addDocument(value, `chrome/${language || "default"}/${group}.${field}`);
        }
      }
      break;
    }
  }
}

export async function fetchCmsTailwindDocuments(endpoint, fetchImpl = fetch, storefrontOrigin, languages = []) {
  const documents = [];
  let contentBytes = 0;
  const addDocument = (html, source) => {
    contentBytes += Buffer.byteLength(html);
    if (contentBytes > MAX_CONTENT_BYTES) throw new Error(`CMS Tailwind content exceeded the 50 MB extraction limit at ${source}.`);
    documents.push({ html, source });
  };
  const request = (query, variables) => requestCmsGraphql(endpoint, query, variables, fetchImpl, storefrontOrigin);
  // Core connections avoid plugin failures in WordPress's generic contentNodes resolver.
  const productFallback = (optional) => fetchStoreProducts(endpoint, fetchImpl, storefrontOrigin, addDocument, optional);
  // Match the storefront's two-worker budget without serializing independent inventories.
  for (let index = 0; index < SOURCES.length; index += 2) {
    const results = await Promise.allSettled(SOURCES.slice(index, index + 2).map(async (source) => {
      const startedAt = performance.now();
      await fetchConnection(source, request, addDocument, productFallback);
      console.log(`[cms-tailwind] ${source.root} extracted in ${((performance.now() - startedAt) / 1000).toFixed(1)}s.`);
    }));
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
  }
  await fetchChrome(request, addDocument, languages);
  return documents;
}
