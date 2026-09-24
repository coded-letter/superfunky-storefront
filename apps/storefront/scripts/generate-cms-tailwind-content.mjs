import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { loadEnv } from "vite";

import {
  buildTailwindContentSource,
  collectCmsTailwindClasses,
} from "./cms-tailwind-content.mjs";

const QUERY = /* GraphQL */ `
  query StorefrontTailwindContent($after: String) {
    contentNodes(first: 50, after: $after) {
      nodes {
        ... on NodeWithContentEditor {
          content
        }
        ... on Page {
          headlessContent
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const MAX_CONTENT_CHARACTERS = 10_000_000;
const MAX_PAGES = 100;
const viteEnvironment = loadEnv("production", process.cwd(), "");

function validateEndpoint(value, label = "VITE_GRAPHQL_ENDPOINT") {
  const endpoint = new URL(value);
  const localHttp = endpoint.protocol === "http:" && ["127.0.0.1", "localhost", "::1"].includes(endpoint.hostname);
  if ((endpoint.protocol !== "https:" && !localHttp) || endpoint.username || endpoint.password) {
    throw new Error(`${label} must be a credential-free HTTPS URL (or local HTTP URL).`);
  }
  return endpoint.href;
}

async function requestGraphql(endpoint, variables, fetchImpl, storefrontOrigin) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(storefrontOrigin ? { Origin: storefrontOrigin } : {}),
        },
        body: JSON.stringify({ query: QUERY, variables }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload.errors?.length) throw new Error(payload.errors.map(({ message }) => message).join("; "));
      if (!payload.data?.contentNodes) throw new Error("response omitted contentNodes");
      return payload.data.contentNodes;
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 500));
    }
  }
  throw new Error(`CMS Tailwind content query failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

export async function fetchCmsTailwindDocuments(endpoint, fetchImpl = fetch, storefrontOrigin) {
  const documents = [];
  let contentCharacters = 0;
  let after = null;
  let pageCount = 0;

  do {
    pageCount += 1;
    if (pageCount > MAX_PAGES) throw new Error(`CMS Tailwind pagination exceeded ${MAX_PAGES} pages.`);
    const connection = await requestGraphql(endpoint, { after }, fetchImpl, storefrontOrigin);
    for (const node of connection.nodes || []) {
      for (const content of [node.content, node.headlessContent]) {
        if (typeof content !== "string" || !content) continue;
        contentCharacters += content.length;
        if (contentCharacters > MAX_CONTENT_CHARACTERS) {
          throw new Error("CMS Tailwind content exceeded the 10 MB extraction limit.");
        }
        documents.push(content);
      }
    }

    if (!connection.pageInfo?.hasNextPage) break;
    const nextCursor = connection.pageInfo.endCursor;
    if (typeof nextCursor !== "string" || !nextCursor || nextCursor === after) {
      throw new Error("CMS Tailwind pagination returned an invalid cursor.");
    }
    after = nextCursor;
  } while (true);

  return documents;
}

export async function generateCmsTailwindContent({
  endpoint = (process.env.VITE_GRAPHQL_ENDPOINT || viteEnvironment.VITE_GRAPHQL_ENDPOINT)?.trim(),
  outputPath = resolve(".tailwind/cms-content.html"),
  fetchImpl = fetch,
  requireCms = process.env.CMS_TAILWIND_REQUIRED === "true",
  siteUrl = (process.env.VITE_SITE_URL || viteEnvironment.VITE_SITE_URL)?.trim(),
  auditCms = true,
} = {}) {
  let documents = [];
  if (auditCms && endpoint) {
    const validatedEndpoint = validateEndpoint(endpoint);
    const storefrontOrigin = siteUrl ? new URL(validateEndpoint(siteUrl, "VITE_SITE_URL")).origin : undefined;
    try {
      documents = await fetchCmsTailwindDocuments(validatedEndpoint, fetchImpl, storefrontOrigin);
    } catch (error) {
      if (requireCms) throw error;
      console.warn(
        `[cms-tailwind] ${error instanceof Error ? error.message : String(error)}; validating the stable contract only.`,
      );
    }
  }
  if (auditCms && !endpoint) {
    console.warn("[cms-tailwind] VITE_GRAPHQL_ENDPOINT is not configured; validating the stable contract only.");
  }

  const { classes, dynamic, rejected } = collectCmsTailwindClasses(documents);
  for (const { token, reason } of rejected) {
    console.warn(`[cms-tailwind] ignored malformed Tailwind-like class "${token}": ${reason}.`);
  }

  await mkdir(resolve(outputPath, ".."), { recursive: true });
  await writeFile(outputPath, buildTailwindContentSource(classes), "utf8");
  console.log(
    `[cms-tailwind] generated ${classes.length} stable utilities`
      + (auditCms
        ? `; audited ${documents.length} CMS content fields, found ${dynamic.length} route-CSS utilities`
        : " without querying CMS content")
      + (rejected.length ? `; rejected ${rejected.length} unsupported token(s).` : "."),
  );
  return { classes, dynamic, rejected };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  generateCmsTailwindContent({
    auditCms: !process.argv.includes("--contract-only"),
  }).catch((error) => {
    console.error(`[cms-tailwind] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
