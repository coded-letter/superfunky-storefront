import { createCompatibleBlogDataQuery } from "./blogGraphqlCompatibility.ts";
import { hasOnlyMissingGraphqlFields } from "@funky/sdk";
import {
  removeGraphqlFieldSelections,
  type GraphqlCompatibilityRule,
} from "./graphqlFieldFallback.ts";

export function createCompatibleAuthorArchiveQuery(query: string): string {
  const compatibleQuery = createCompatibleBlogDataQuery(
    removeGraphqlFieldSelections(query, "storefrontDescription"),
  )
    .replace(/^[\t ]*\$(?:authorName|language):[^\n]+\n/gm, "")
    .replace(/posts\((first:\s*(?:\d+|\$first)(?:,\s*after:\s*\$after)?),\s*where:\s*\{[^{}]*\}\)/g, "posts($1)");
  return removeGraphqlFieldSelections(
    removeGraphqlFieldSelections(compatibleQuery, "content"),
    "seo",
  );
}

export const AUTHOR_ARCHIVE_COMPATIBILITY_RULE: GraphqlCompatibilityRule = {
  matches: (message) =>
    message.includes("Cannot access offset of type string on string")
    || message.includes('Variable "$language" of type "LanguageCodeFilterEnum!" used in position expecting type "String!"')
    || message.includes("Expected a value of type LanguageCodeEnum but received: false")
    || message.includes("Cannot serialize value as enum: false")
    || hasOnlyMissingGraphqlFields([{ message }], ["language", "translations"]),
  transform: createCompatibleAuthorArchiveQuery,
};
