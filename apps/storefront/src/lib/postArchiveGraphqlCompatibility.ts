import {
  removeGraphqlFieldSelections,
  type GraphqlCompatibilityRule,
} from "./graphqlFieldFallback.ts";

export function createCompatiblePostArchiveQuery(query: string): string {
  return removeGraphqlFieldSelections(
    removeGraphqlFieldSelections(
      removeGraphqlFieldSelections(
        removeGraphqlFieldSelections(query, "content"),
        "seo",
      ),
      "enqueuedScripts",
    ),
    "language",
  )
    .replace(/(categories|tags)\(([^)]*?),\s*where:\s*\{[^{}]*\}\)/g, "$1($2)")
    .replace(/(categories|tags)\(\s*where:\s*\{[^{}]*\}\s*\)/g, "$1");
}

export const MALFORMED_POST_ARCHIVE_RULE: GraphqlCompatibilityRule = {
  matches: (message) => message.includes("Cannot access offset of type string on string"),
  transform: createCompatiblePostArchiveQuery,
};
