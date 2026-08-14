import {
  removeGraphqlFieldSelections,
  type GraphqlCompatibilityRule,
} from "./graphqlFieldFallback.ts";

export function createCompatiblePostArchiveQuery(query: string): string {
  return removeGraphqlFieldSelections(
    removeGraphqlFieldSelections(
      removeGraphqlFieldSelections(query, "content"),
      "seo",
    ),
    "enqueuedScripts",
  );
}

export const MALFORMED_POST_ARCHIVE_RULE: GraphqlCompatibilityRule = {
  matches: (message) => message.includes("Cannot access offset of type string on string"),
  transform: createCompatiblePostArchiveQuery,
};
