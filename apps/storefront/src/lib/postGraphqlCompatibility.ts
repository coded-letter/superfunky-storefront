import { createCompatibleBlogDataQuery } from "./blogGraphqlCompatibility.ts";
import { removeGraphqlFieldSelections, type GraphqlCompatibilityRule } from "./graphqlFieldFallback.ts";

const malformedPostCommentsRule: GraphqlCompatibilityRule = {
  matches: (message) => message.includes("Cannot access offset of type string on string"),
  transform: (query) => createCompatibleBlogDataQuery(
    removeGraphqlFieldSelections(query, "comments"),
  ),
};

const malformedLanguageEnumRule: GraphqlCompatibilityRule = {
  matches: (message) =>
    message.includes("Expected a value of type LanguageCodeEnum but received: false")
    || message.includes("Cannot serialize value as enum: false"),
  transform: createCompatibleBlogDataQuery,
};

export const POST_GRAPHQL_COMPATIBILITY_RULES = [
  malformedPostCommentsRule,
  malformedLanguageEnumRule,
] as const;
