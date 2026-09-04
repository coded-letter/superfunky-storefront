import { normalizeDisplayLabel, type SearchResultItem } from "@funky/ui";
import {
  graphqlRequest,
  STOREFRONT_BACKEND_PROFILE,
  STOREFRONT_EXPECTED_LOCALES,
} from "@funky/sdk";
import {
  mapStorefrontSearchResults,
  type StorefrontSearchQueryResult,
} from "./searchMapping.ts";
import {
  COMPATIBLE_SEARCH_QUERY,
  isLegacyCommunityMemberSearchSchema,
  isSearchCompatibilitySchemaError,
  LEGACY_SEARCH_QUERY,
  SEARCH_QUERY,
  SINGLE_LANGUAGE_SEARCH_QUERY,
} from "./searchQuery.ts";
import { searchWordPressRest } from "./searchRest.ts";

export { mapStorefrontSearchResults, SEARCH_QUERY };
export type { StorefrontSearchQueryResult };

export async function searchStorefront(
  query: string,
  backendLanguageCode: string,
  routeLanguageCode: string,
  t: (key: string) => string = (key) => key,
): Promise<SearchResultItem[]> {
  if (STOREFRONT_BACKEND_PROFILE === "blog") {
    return searchWordPressRest(query, routeLanguageCode, t, {
      normalizeLabel: normalizeDisplayLabel,
    });
  }

  const variables = {
    search: query,
    language: backendLanguageCode,
  };
  const primaryQuery = STOREFRONT_EXPECTED_LOCALES.length > 1
    ? SEARCH_QUERY
    : SINGLE_LANGUAGE_SEARCH_QUERY;
  let response = await graphqlRequest<StorefrontSearchQueryResult>(primaryQuery, variables);
  if (isLegacyCommunityMemberSearchSchema(response.errors)) {
    const legacyQuery = primaryQuery === SEARCH_QUERY
      ? LEGACY_SEARCH_QUERY
      : primaryQuery.replace("communityMembers(search: $search, first: 6)", "communityMembers");
    response = await graphqlRequest<StorefrontSearchQueryResult>(legacyQuery, variables);
  }
  if (isSearchCompatibilitySchemaError(response.errors)) {
    response = await graphqlRequest<StorefrontSearchQueryResult>(COMPATIBLE_SEARCH_QUERY, {
      search: query,
    });
  }
  const { data, errors } = response;
  if (errors?.length) throw new Error(errors.map(({ message }) => message).join("; "));
  if (!data) throw new Error("The storefront search returned no data");

  return mapStorefrontSearchResults(data, query, routeLanguageCode, t, normalizeDisplayLabel);
}
