/** Minimal fetch-based WPGraphQL client — this project has no Apollo/urql client, and
 * doesn't need one yet for the handful of queries/mutations the frontend prototype
 * makes (auth, payment-gateway availability). Every call safely resolves to `null`
 * data with no network request when `VITE_GRAPHQL_ENDPOINT` isn't configured, matching
 * the rest of this codebase's graceful-fallback convention. */

import { GRAPHQL_ENDPOINT, isBackendConfigured } from "./env";

export type GraphqlResponse<T> = {
  data: T | null;
  errors?: { message: string }[];
};

/** Executes a GraphQL request against `VITE_GRAPHQL_ENDPOINT`. Pass `authToken` to
 * attach it as a Bearer token (e.g. for `login`/`refreshToken` follow-up calls that
 * need an authenticated session) — most calls in this prototype are public queries
 * and don't need one. */
export async function graphqlRequest<T>(query: string, variables?: Record<string, unknown>, authToken?: string | null): Promise<GraphqlResponse<T>> {
  if (!isBackendConfigured || !GRAPHQL_ENDPOINT) {
    return { data: null, errors: [{ message: "No GraphQL endpoint configured (VITE_GRAPHQL_ENDPOINT)" }] };
  }

  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
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
    });

    const payload = (await response.json()) as GraphqlResponse<T>;
    if (!response.ok && !payload?.errors) {
      return { data: null, errors: [{ message: `GraphQL request failed with status ${response.status}` }] };
    }
    return payload;
  } catch (error) {
    return { data: null, errors: [{ message: error instanceof Error ? error.message : "GraphQL request failed" }] };
  }
}
