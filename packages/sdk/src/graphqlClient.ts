/** Minimal fetch-based WPGraphQL client — this project has no Apollo/urql client, and
 * doesn't need one yet for the handful of queries/mutations the frontend prototype
 * makes (auth, payment-gateway availability). Every call safely resolves to `null`
 * data with no network request when `VITE_GRAPHQL_ENDPOINT` isn't configured, matching
 * the rest of this codebase's graceful-fallback convention. */

import { GRAPHQL_ENDPOINT, isBackendConfigured } from "./environment.ts";

export type GraphqlResponse<T> = {
  data: T | null;
  errors?: {
    message: string;
    extensions?: { debugMessage?: string };
  }[];
};

const MAX_CONCURRENT_GRAPHQL_REQUESTS = 2;
const GRAPHQL_REQUEST_TIMEOUT_MS = 60_000;
let activeGraphqlRequests = 0;
const graphqlRequestQueue: (() => void)[] = [];

async function acquireGraphqlRequestSlot(): Promise<void> {
  if (activeGraphqlRequests < MAX_CONCURRENT_GRAPHQL_REQUESTS) {
    activeGraphqlRequests += 1;
    return;
  }
  await new Promise<void>((resolve) => graphqlRequestQueue.push(resolve));
}

function releaseGraphqlRequestSlot(): void {
  const nextRequest = graphqlRequestQueue.shift();
  if (nextRequest) {
    nextRequest();
    return;
  }
  activeGraphqlRequests = Math.max(0, activeGraphqlRequests - 1);
}

export function hasOnlyMissingGraphqlFields(
  errors: GraphqlResponse<unknown>["errors"],
  fieldNames: readonly string[],
): boolean {
  return Boolean(errors?.length) && errors.every(({ message }) => {
    const normalizedMessage = message.toLowerCase();
    if (normalizedMessage.includes('unknown type "languagecodefilterenum"')) {
      return true;
    }
    return fieldNames.some((fieldName) => {
      const normalizedFieldName = fieldName.toLowerCase();
      return (
        message.includes(`Cannot query field "${fieldName}"`)
        || message.includes(`Field "${fieldName}" is not defined by type`)
        || message.includes(`Unknown type "${fieldName}"`)
        || message.includes(`Unknown argument "${fieldName}"`)
        || normalizedMessage.includes(`cannot query field "${normalizedFieldName}"`)
        || normalizedMessage.includes(`field "${normalizedFieldName}" is not defined by type`)
        || normalizedMessage.includes(`unknown type "${normalizedFieldName}"`)
        || normalizedMessage.includes(`unknown argument "${normalizedFieldName}"`)
      );
    });
  });
}

/** Executes a GraphQL request against `VITE_GRAPHQL_ENDPOINT`. Pass `authToken` to
 * attach it as a Bearer token (e.g. for `login`/`refreshToken` follow-up calls that
 * need an authenticated session) — most calls in this prototype are public queries
 * and don't need one. */
export async function graphqlRequest<T>(query: string, variables?: Record<string, unknown>, authToken?: string | null): Promise<GraphqlResponse<T>> {
  if (!isBackendConfigured || !GRAPHQL_ENDPOINT) {
    return { data: null, errors: [{ message: "No GraphQL endpoint configured (VITE_GRAPHQL_ENDPOINT)" }] };
  }

  await acquireGraphqlRequestSlot();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GRAPHQL_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...(authToken
          ? {
              Authorization: `Bearer ${authToken}`,
              "X-WPGraphQL-Login-Token": authToken,
            }
          : {}),
      },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });

    const payload = (await response.json()) as GraphqlResponse<T>;
    if (!response.ok && !payload?.errors) {
      return { data: null, errors: [{ message: `GraphQL request failed with status ${response.status}` }] };
    }
    return payload;
  } catch (error) {
    const message = error instanceof Error && error.name === "AbortError"
      ? `GraphQL request timed out after ${GRAPHQL_REQUEST_TIMEOUT_MS / 1000} seconds`
      : error instanceof Error
        ? error.message
        : "GraphQL request failed";
    return { data: null, errors: [{ message }] };
  } finally {
    clearTimeout(timeout);
    releaseGraphqlRequestSlot();
  }
}
